import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { AudioChunk, Logger } from '@3cx-ninja/shared';
import config from 'config';

export class AudioProcessingService {
  private logger = new Logger('AudioProcessing');
  private tempDir: string;

  constructor() {
    this.tempDir = config.get('transcription.tempDir');
    this.ensureTempDir();
  }

  private async ensureTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create temp directory:', error);
    }
  }

  async chunksToFile(chunks: AudioChunk[], callId: string): Promise<string> {
    const tempFile = path.join(this.tempDir, `${callId}-${Date.now()}.raw`);
    const outputFile = path.join(this.tempDir, `${callId}-${Date.now()}.wav`);

    try {
      // Trier les chunks par séquence
      chunks.sort((a, b) => a.sequence - b.sequence);

      // Combiner les buffers
      const audioBuffer = Buffer.concat(chunks.map(c => c.data));
      await fs.writeFile(tempFile, audioBuffer);

      // Convertir en WAV
      await this.convertToWav(tempFile, outputFile);

      // Nettoyer le fichier temporaire
      await fs.unlink(tempFile);

      return outputFile;
    } catch (error) {
      this.logger.error('Failed to process audio chunks:', error);
      // Nettoyer en cas d'erreur
      try {
        await fs.unlink(tempFile);
      } catch {}
      throw error;
    }
  }

  private convertToWav(inputPath: string, outputPath: string): Promise<void> {
    const audioConfig = config.get('audio');

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .inputFormat('s16le') // PCM 16-bit little-endian
        .audioFrequency((audioConfig as any).sampleRate || 16000)
        .audioChannels((audioConfig as any).channels || 1)
        .audioCodec('pcm_s16le')
        .format('wav')
        .on('end', () => {
          this.logger.debug(`Audio converted: ${outputPath}`);
          resolve();
        })
        .on('error', (err) => {
          this.logger.error('FFmpeg error:', err);
          reject(err);
        })
        .save(outputPath);
    });
  }

  async mergeAudioFiles(files: string[], outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg();

      // Ajouter tous les fichiers
      files.forEach(file => {
        command.input(file);
      });

      command
        .on('end', () => {
          this.logger.info('Audio files merged successfully');
          resolve();
        })
        .on('error', (err) => {
          this.logger.error('Merge error:', err);
          reject(err);
        })
        .mergeToFile(outputPath, path.dirname(outputPath));
    });
  }

  async extractSegment(
    inputPath: string,
    startTime: number,
    duration: number
  ): Promise<string> {
    const segmentId = crypto.randomBytes(8).toString('hex');
    const outputPath = path.join(this.tempDir, `segment-${segmentId}.wav`);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(startTime)
        .setDuration(duration)
        .on('end', () => {
          resolve(outputPath);
        })
        .on('error', reject)
        .save(outputPath);
    });
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      this.logger.warn(`Failed to delete file ${filePath}:`, error);
    }
  }

  async cleanupOldFiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.tempDir);
      const now = Date.now();
      const maxAge = config.get('cleanup.maxAge');

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.stat(filePath);

        if (now - stats.mtime.getTime() > (maxAge as number)) {
          await fs.unlink(filePath);
          this.logger.debug(`Cleaned up old file: ${file}`);
        }
      }
    } catch (error) {
      this.logger.error('Cleanup failed:', error);
    }
  }
}

export default new AudioProcessingService();