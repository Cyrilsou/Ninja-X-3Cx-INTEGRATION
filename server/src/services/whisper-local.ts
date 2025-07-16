import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { Transcription, TranscriptionSegment } from '@3cx-ninja/shared';
import { Logger } from '@3cx-ninja/shared';
import config from 'config';

export class WhisperLocalService {
  private logger = new Logger('WhisperLocal');
  private modelPath: string;
  private whisperConfig: any;

  constructor() {
    this.modelPath = process.env.WHISPER_MODEL_PATH || './models/whisper';
    this.whisperConfig = config.get('whisper');
  }

  async initialize(): Promise<void> {
    // Vérifier que le modèle est installé
    const modelFile = path.join(this.modelPath, `ggml-${this.whisperConfig.model}.bin`);
    try {
      await fs.access(modelFile);
      this.logger.info(`Whisper model loaded: ${this.whisperConfig.model}`);
    } catch {
      throw new Error(`Whisper model not found at ${modelFile}. Run npm run setup:whisper`);
    }
  }

  async transcribeFile(audioPath: string, callId: string): Promise<Transcription> {
    return new Promise((resolve, reject) => {
      const startTime = new Date();
      const args = [
        '-m', path.join(this.modelPath, `ggml-${this.whisperConfig.model}.bin`),
        '-f', audioPath,
        '-l', this.whisperConfig.language,
        '-t', this.whisperConfig.threads.toString(),
        '-p', this.whisperConfig.processors.toString(),
        '--output-json',
        '--no-timestamps', // On gère les timestamps nous-mêmes
        '--print-progress'
      ];

      if (this.whisperConfig.translate) {
        args.push('--translate');
      }

      const whisperProcess = spawn(path.join(this.modelPath, 'main'), args);
      let output = '';
      let errorOutput = '';

      whisperProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      whisperProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        // Extraire la progression
        const progressMatch = data.toString().match(/progress = (\d+)%/);
        if (progressMatch) {
          this.logger.debug(`Transcription progress: ${progressMatch[1]}%`);
        }
      });

      whisperProcess.on('close', (code) => {
        if (code !== 0) {
          this.logger.error(`Whisper process exited with code ${code}: ${errorOutput}`);
          reject(new Error(`Transcription failed: ${errorOutput}`));
          return;
        }

        try {
          const result = this.parseWhisperOutput(output, callId, startTime);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async transcribeStream(
    audioStream: NodeJS.ReadableStream,
    callId: string,
    onPartial?: (segment: TranscriptionSegment) => void
  ): Promise<Transcription> {
    // Pour le streaming, on utilise une approche par chunks
    const tempFile = path.join(config.get('transcription.tempDir'), `${callId}-stream.wav`);
    const writeStream = await fs.open(tempFile, 'w');
    
    return new Promise((resolve, reject) => {
      let segments: TranscriptionSegment[] = [];
      let chunkIndex = 0;

      audioStream.on('data', async (chunk) => {
        // Écrire le chunk dans le fichier temporaire
        await writeStream.write(chunk);

        // Tous les X secondes, transcrire le chunk
        if (chunkIndex % 10 === 0) { // ~2.5 secondes à 16kHz
          try {
            const partialResult = await this.transcribeFile(tempFile, callId);
            if (partialResult.segments.length > segments.length && onPartial) {
              const newSegments = partialResult.segments.slice(segments.length);
              newSegments.forEach(seg => onPartial(seg));
              segments = partialResult.segments;
            }
          } catch (error) {
            this.logger.error('Partial transcription failed:', error);
          }
        }
        chunkIndex++;
      });

      audioStream.on('end', async () => {
        await writeStream.close();
        try {
          const finalResult = await this.transcribeFile(tempFile, callId);
          await fs.unlink(tempFile); // Nettoyer
          resolve(finalResult);
        } catch (error) {
          reject(error);
        }
      });

      audioStream.on('error', reject);
    });
  }

  private parseWhisperOutput(
    output: string,
    callId: string,
    startTime: Date
  ): Transcription {
    try {
      // Chercher le JSON dans la sortie
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON output from Whisper');
      }

      const jsonData = JSON.parse(jsonMatch[0]);
      const segments: TranscriptionSegment[] = [];
      let fullText = '';

      if (jsonData.segments) {
        jsonData.segments.forEach((seg: any, index: number) => {
          const segment: TranscriptionSegment = {
            id: `${callId}-${index}`,
            start: seg.start || index * 5,
            end: seg.end || (index + 1) * 5,
            text: seg.text.trim(),
            speaker: 'unknown', // À déterminer par analyse
            confidence: seg.avg_logprob ? Math.exp(seg.avg_logprob) : 0.9,
            timestamp: new Date(startTime.getTime() + (seg.start || 0) * 1000)
          };
          segments.push(segment);
          fullText += segment.text + ' ';
        });
      } else if (jsonData.text) {
        // Fallback si pas de segments
        fullText = jsonData.text;
        segments.push({
          id: `${callId}-0`,
          start: 0,
          end: 0,
          text: fullText,
          speaker: 'unknown',
          confidence: 0.9,
          timestamp: startTime
        });
      }

      return {
        callId,
        text: fullText.trim(),
        segments,
        language: jsonData.language || this.whisperConfig.language,
        startTime,
        endTime: new Date(),
        confidence: this.calculateAverageConfidence(segments)
      };
    } catch (error) {
      this.logger.error('Failed to parse Whisper output:', error);
      throw new Error('Failed to parse transcription results');
    }
  }

  private calculateAverageConfidence(segments: TranscriptionSegment[]): number {
    if (segments.length === 0) return 0;
    const sum = segments.reduce((acc, seg) => acc + seg.confidence, 0);
    return sum / segments.length;
  }

  async identifySpeakers(transcription: Transcription): Promise<Transcription> {
    // Analyse simple basée sur des patterns
    const updatedSegments = transcription.segments.map(segment => {
      const text = segment.text.toLowerCase();
      
      // Patterns pour identifier l'agent
      const agentPatterns = [
        /bonjour.*comment puis-je/,
        /service client/,
        /je vais vous aider/,
        /permettez-moi de/,
        /je comprends/
      ];

      // Patterns pour identifier l'appelant
      const callerPatterns = [
        /j'ai un problème/,
        /je voudrais/,
        /pouvez-vous m'aider/,
        /ça ne fonctionne pas/
      ];

      let speaker: 'agent' | 'caller' | 'unknown' = 'unknown';

      if (agentPatterns.some(pattern => pattern.test(text))) {
        speaker = 'agent';
      } else if (callerPatterns.some(pattern => pattern.test(text))) {
        speaker = 'caller';
      } else {
        // Utiliser l'alternance comme fallback
        const prevSegment = transcription.segments[transcription.segments.indexOf(segment) - 1];
        if (prevSegment) {
          speaker = prevSegment.speaker === 'agent' ? 'caller' : 'agent';
        }
      }

      return { ...segment, speaker };
    });

    return { ...transcription, segments: updatedSegments };
  }
}

export default new WhisperLocalService();