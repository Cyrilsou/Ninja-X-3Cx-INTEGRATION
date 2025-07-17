import Bull from 'bull';
import { AudioChunk, TranscriptionSegment, Logger } from '@3cx-ninja/shared';
import WhisperLocalService from './whisper-local';
import AnalysisLocalService from './analysis-local';
import AudioProcessingService from './audio-processing';
import config from 'config';

interface TranscriptionJob {
  callId: string;
  agentId: string;
  audioPath?: string;
  audioChunks?: AudioChunk[];
  type: 'chunk' | 'final';
  metadata?: any;
}

export class TranscriptionQueue {
  private queue: Bull.Queue<TranscriptionJob>;
  private logger = new Logger('TranscriptionQueue');
  private audioBuffers: Map<string, AudioChunk[]> = new Map();
  private socketManager: any; // Sera injecté

  constructor() {
    this.queue = new Bull('transcription', config.get('redis.url'), {
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    });

    this.setupWorkers();
  }

  setSocketManager(socketManager: any) {
    this.socketManager = socketManager;
  }

  private setupWorkers() {
    const concurrency = config.get('transcription.maxConcurrent');

    this.queue.process(Number(concurrency), async (job) => {
      this.logger.info(`Processing transcription job: ${job.id} (${job.data.type})`);

      try {
        if (job.data.type === 'chunk') {
          return await this.processChunkTranscription(job);
        } else {
          return await this.processFinalTranscription(job);
        }
      } catch (error) {
        this.logger.error('Transcription job failed:', error);
        throw error;
      }
    });

    this.queue.on('completed', (job, result) => {
      this.logger.info(`Job completed: ${job.id}`);
    });

    this.queue.on('failed', (job, err) => {
      this.logger.error(`Job failed: ${job.id}`, err);
    });
  }

  async addAudioChunk(chunk: AudioChunk): Promise<void> {
    const { callId } = chunk;

    // Ajouter au buffer
    if (!this.audioBuffers.has(callId)) {
      this.audioBuffers.set(callId, []);
    }
    this.audioBuffers.get(callId)!.push(chunk);

    // Vérifier si on doit traiter un chunk
    const chunks = this.audioBuffers.get(callId)!;
    const chunkDuration = config.get('transcription.chunkDuration');
    const samplesPerMs = 16; // 16kHz / 1000

    // Calculer la durée approximative
    const totalSamples = chunks.reduce((sum, c) => sum + c.data.length / 2, 0); // 16-bit = 2 bytes
    const durationMs = totalSamples / samplesPerMs;

    if (durationMs >= (chunkDuration as number)) {
      // Extraire les chunks à traiter
      const chunksToProcess = [...chunks];
      this.audioBuffers.set(callId, []); // Reset buffer

      // Ajouter à la queue
      await this.queue.add({
        callId,
        agentId: chunk.agentId,
        audioChunks: chunksToProcess,
        type: 'chunk'
      });
    }
  }

  async finalizeCall(callId: string): Promise<void> {
    // Traiter les chunks restants
    const remainingChunks = this.audioBuffers.get(callId);
    
    if (remainingChunks && remainingChunks.length > 0) {
      await this.queue.add({
        callId,
        agentId: remainingChunks[0].agentId,
        audioChunks: remainingChunks,
        type: 'final'
      });
    }

    // Nettoyer
    this.audioBuffers.delete(callId);
  }

  private async processChunkTranscription(job: Bull.Job<TranscriptionJob>) {
    const { callId, agentId, audioChunks } = job.data;

    if (!audioChunks || audioChunks.length === 0) {
      throw new Error('No audio chunks provided');
    }

    // Convertir les chunks en fichier audio
    const audioPath = await AudioProcessingService.chunksToFile(
      audioChunks.map(c => ({
        ...c,
        data: Buffer.from(c.data) // S'assurer que c'est un Buffer
      })),
      callId
    );

    try {
      // Transcrire avec callback pour les résultats partiels
      const transcription = await WhisperLocalService.transcribeFile(
        audioPath,
        callId
      );

      // Identifier les locuteurs
      const transcriptionWithSpeakers = await WhisperLocalService.identifySpeakers(
        transcription
      );

      // Émettre les segments en temps réel
      if (this.socketManager && transcriptionWithSpeakers.segments.length > 0) {
        const lastSegment = transcriptionWithSpeakers.segments[
          transcriptionWithSpeakers.segments.length - 1
        ];

        this.socketManager.emitTranscriptionPartial(agentId, {
          callId,
          segment: lastSegment,
          isFinal: false
        });
      }

      // Nettoyer
      await AudioProcessingService.deleteFile(audioPath);

      return transcriptionWithSpeakers;
    } catch (error) {
      // Nettoyer en cas d'erreur
      await AudioProcessingService.deleteFile(audioPath);
      throw error;
    }
  }

  private async processFinalTranscription(job: Bull.Job<TranscriptionJob>) {
    const { callId, agentId, audioChunks } = job.data;

    // Obtenir tous les chunks audio du call
    const redis = require('./redis-service').default;
    const allChunks = await redis.getAudioChunks(callId);

    // Ajouter les chunks finaux
    if (audioChunks && audioChunks.length > 0) {
      allChunks.push(...audioChunks);
    }

    // Créer le fichier audio complet
    const audioPath = await AudioProcessingService.chunksToFile(
      allChunks,
      callId
    );

    try {
      // Transcription complète
      const transcription = await WhisperLocalService.transcribeFile(
        audioPath,
        callId
      );

      // Identifier les locuteurs
      const finalTranscription = await WhisperLocalService.identifySpeakers(
        transcription
      );

      // Sauvegarder dans Redis
      await redis.setTranscription(callId, finalTranscription);

      // Émettre la transcription finale
      if (this.socketManager) {
        this.socketManager.emitTranscriptionFinal(callId, finalTranscription);
      }

      // Analyser l'appel
      const callData = await redis.getCall(callId);
      const analysis = await AnalysisLocalService.analyzeCall(
        finalTranscription,
        callData
      );

      // Sauvegarder l'analyse
      await redis.setAnalysis(callId, analysis);

      // Émettre l'analyse
      if (this.socketManager) {
        this.socketManager.emitAnalysisComplete(callId, analysis);
      }

      // Nettoyer
      await AudioProcessingService.deleteFile(audioPath);
      await redis.clearAudioChunks(callId);

      // Stats
      await redis.incrementStat('calls_transcribed');

      return { transcription: finalTranscription, analysis };
    } catch (error) {
      // Nettoyer en cas d'erreur
      await AudioProcessingService.deleteFile(audioPath);
      throw error;
    }
  }

  async getStats() {
    return this.queue.getJobCounts();
  }

  async clean() {
    await this.queue.clean(86400000); // 24h
  }
}

export default new TranscriptionQueue();