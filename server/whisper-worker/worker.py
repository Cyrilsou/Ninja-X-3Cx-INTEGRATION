import os
import time
import json
import asyncio
import tempfile
from pathlib import Path
from typing import Optional, Dict, Any
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

import redis
import structlog
from faster_whisper import WhisperModel
from pydantic import BaseModel, Field
from prometheus_client import Counter, Histogram, Gauge, start_http_server
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure structured logging
logger = structlog.get_logger()

# Prometheus metrics
transcription_counter = Counter('whisper_transcriptions_total', 'Total number of transcriptions')
transcription_errors = Counter('whisper_transcription_errors_total', 'Total number of transcription errors')
transcription_duration = Histogram('whisper_transcription_duration_seconds', 'Time spent on transcription')
queue_size = Gauge('whisper_queue_size', 'Current size of the transcription queue')
active_transcriptions = Gauge('whisper_active_transcriptions', 'Number of active transcriptions')

class TranscriptionJob(BaseModel):
    call_id: str = Field(..., alias='callId')
    audio_path: str = Field(..., alias='audioPath')
    priority: int = 0

    class Config:
        populate_by_name = True

class WorkerConfig(BaseModel):
    redis_url: str = Field(default="redis://localhost:6379")
    model_size: str = Field(default="large-v3")
    device: str = Field(default="cuda")
    compute_type: str = Field(default="float16")
    storage_path: str = Field(default="/app/storage")
    models_path: str = Field(default="/app/models")
    num_workers: int = Field(default=2)
    batch_size: int = Field(default=1)
    language: Optional[str] = Field(default=None)
    initial_prompt: Optional[str] = Field(default=None)
    vad_filter: bool = Field(default=True)
    word_timestamps: bool = Field(default=False)

class WhisperWorker:
    def __init__(self, config: WorkerConfig):
        self.config = config
        self.redis_client = redis.from_url(config.redis_url, decode_responses=True)
        self.model: Optional[WhisperModel] = None
        self.executor = ThreadPoolExecutor(max_workers=config.num_workers)
        self.running = False
        self.logger = logger.bind(component="whisper_worker")

    async def initialize(self):
        """Initialize the Whisper model and check GPU availability"""
        self.logger.info("Initializing Whisper worker", 
                        model=self.config.model_size,
                        device=self.config.device)
        
        try:
            # Check CUDA availability
            if self.config.device == "cuda":
                import torch
                if not torch.cuda.is_available():
                    raise RuntimeError("CUDA is not available but device is set to 'cuda'")
                self.logger.info(f"CUDA available: {torch.cuda.get_device_name(0)}")
            
            # Load Whisper model
            self.model = WhisperModel(
                self.config.model_size,
                device=self.config.device,
                compute_type=self.config.compute_type,
                download_root=self.config.models_path
            )
            
            self.logger.info("Whisper model loaded successfully")
            
        except Exception as e:
            self.logger.error("Failed to initialize Whisper model", error=str(e))
            raise

    async def start(self):
        """Start the worker loop"""
        self.running = True
        self.logger.info("Starting Whisper worker")
        
        # Start metrics server
        start_http_server(8080)
        
        # Main processing loop
        while self.running:
            try:
                # Get job from queue
                job_data = self.redis_client.brpoplpush(
                    "transcription:queue",
                    "transcription:processing",
                    timeout=5
                )
                
                if job_data:
                    queue_size.dec()
                    active_transcriptions.inc()
                    
                    try:
                        job = TranscriptionJob.parse_raw(job_data)
                        await self.process_job(job)
                    except Exception as e:
                        self.logger.error("Failed to process job", error=str(e), job=job_data)
                        transcription_errors.inc()
                    finally:
                        active_transcriptions.dec()
                        # Remove from processing queue
                        self.redis_client.lrem("transcription:processing", 1, job_data)
                
            except Exception as e:
                self.logger.error("Worker loop error", error=str(e))
                await asyncio.sleep(5)

    async def process_job(self, job: TranscriptionJob):
        """Process a single transcription job"""
        start_time = time.time()
        
        self.logger.info("Processing transcription job", 
                        call_id=job.call_id,
                        audio_path=job.audio_path)
        
        try:
            # Decrypt and load audio file
            audio_path = await self.prepare_audio(job.audio_path)
            
            # Run transcription in thread pool
            loop = asyncio.get_event_loop()
            transcript = await loop.run_in_executor(
                self.executor,
                self.transcribe_audio,
                audio_path
            )
            
            # Store result
            await self.store_result(job.call_id, transcript)
            
            # Update metrics
            duration = time.time() - start_time
            transcription_duration.observe(duration)
            transcription_counter.inc()
            
            self.logger.info("Transcription completed",
                           call_id=job.call_id,
                           duration=duration,
                           words=len(transcript.split()))
            
        except Exception as e:
            self.logger.error("Transcription failed",
                            call_id=job.call_id,
                            error=str(e))
            transcription_errors.inc()
            
            # Store error
            await self.store_error(job.call_id, str(e))
            raise

    async def prepare_audio(self, encrypted_path: str) -> str:
        """Decrypt audio file and prepare for transcription"""
        # In production, implement decryption here
        # For now, assume the path is the actual file path
        full_path = os.path.join(self.config.storage_path, encrypted_path)
        
        if not os.path.exists(full_path):
            raise FileNotFoundError(f"Audio file not found: {full_path}")
        
        return full_path

    def transcribe_audio(self, audio_path: str) -> str:
        """Transcribe audio file using Whisper"""
        if not self.model:
            raise RuntimeError("Model not initialized")
        
        # Transcribe with Whisper
        segments, info = self.model.transcribe(
            audio_path,
            language=self.config.language,
            initial_prompt=self.config.initial_prompt,
            vad_filter=self.config.vad_filter,
            word_timestamps=self.config.word_timestamps
        )
        
        # Collect transcript
        transcript_parts = []
        for segment in segments:
            transcript_parts.append(segment.text.strip())
        
        return " ".join(transcript_parts)

    async def store_result(self, call_id: str, transcript: str):
        """Store transcription result in Redis"""
        result = {
            "callId": call_id,
            "transcript": transcript,
            "timestamp": datetime.utcnow().isoformat(),
            "status": "completed"
        }
        
        # Store in Redis with expiration
        self.redis_client.setex(
            f"transcription:result:{call_id}",
            3600,  # 1 hour expiration
            json.dumps(result)
        )
        
        # Publish completion event
        self.redis_client.publish(
            "transcription:completed",
            json.dumps({"callId": call_id})
        )

    async def store_error(self, call_id: str, error: str):
        """Store transcription error in Redis"""
        result = {
            "callId": call_id,
            "error": error,
            "timestamp": datetime.utcnow().isoformat(),
            "status": "failed"
        }
        
        self.redis_client.setex(
            f"transcription:result:{call_id}",
            3600,
            json.dumps(result)
        )
        
        # Publish error event
        self.redis_client.publish(
            "transcription:failed",
            json.dumps({"callId": call_id, "error": error})
        )

    async def stop(self):
        """Stop the worker gracefully"""
        self.logger.info("Stopping Whisper worker")
        self.running = False
        self.executor.shutdown(wait=True)

async def main():
    """Main entry point"""
    config = WorkerConfig(
        redis_url=os.getenv("REDIS_URL", "redis://localhost:6379"),
        model_size=os.getenv("MODEL_SIZE", "large-v3"),
        device=os.getenv("DEVICE", "cuda"),
        compute_type=os.getenv("COMPUTE_TYPE", "float16"),
        storage_path=os.getenv("STORAGE_PATH", "/app/storage"),
        models_path=os.getenv("MODELS_PATH", "/app/models"),
        num_workers=int(os.getenv("NUM_WORKERS", "2"))
    )
    
    worker = WhisperWorker(config)
    
    try:
        await worker.initialize()
        await worker.start()
    except KeyboardInterrupt:
        logger.info("Received interrupt signal")
    except Exception as e:
        logger.error("Worker failed", error=str(e))
        raise
    finally:
        await worker.stop()

if __name__ == "__main__":
    asyncio.run(main())