import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import CryptoJS from 'crypto-js';
import { config, derivedConfig } from '../config';
import { logger } from '../utils/logger';

export class StorageService {
  private static encryptionKey: string;

  static async initialize(): Promise<void> {
    this.encryptionKey = config.ENCRYPTION_KEY;

    // Ensure storage directories exist
    await this.ensureDirectories();
  }

  private static async ensureDirectories(): Promise<void> {
    const dirs = [
      derivedConfig.storage.audioPath,
      derivedConfig.storage.tempPath,
    ];

    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
        logger.info(`Storage directory ensured: ${dir}`);
      } catch (error) {
        logger.error(`Failed to create directory ${dir}`, error);
        throw error;
      }
    }
  }

  static generateFileName(callId: string, extension: string = 'wav'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const hash = crypto.createHash('sha256').update(callId).digest('hex').substring(0, 8);
    return `${timestamp}_${hash}.${extension}`;
  }

  static getAudioPath(fileName: string): string {
    return path.join(derivedConfig.storage.audioPath, fileName);
  }

  static async saveAudioFile(
    buffer: Buffer,
    fileName: string,
    encrypt: boolean = true
  ): Promise<string> {
    const filePath = this.getAudioPath(fileName);

    try {
      let dataToSave = buffer;

      if (encrypt) {
        // Encrypt the audio file
        const encrypted = CryptoJS.AES.encrypt(
          buffer.toString('base64'),
          this.encryptionKey
        ).toString();
        dataToSave = Buffer.from(encrypted);
      }

      await fs.writeFile(filePath, dataToSave);
      logger.info('Audio file saved', { fileName, encrypted: encrypt });

      return filePath;
    } catch (error) {
      logger.error('Failed to save audio file', { fileName, error });
      throw error;
    }
  }

  static async readAudioFile(
    fileName: string,
    decrypt: boolean = true
  ): Promise<Buffer> {
    const filePath = this.getAudioPath(fileName);

    try {
      const data = await fs.readFile(filePath);

      if (decrypt) {
        // Decrypt the audio file
        const decrypted = CryptoJS.AES.decrypt(
          data.toString(),
          this.encryptionKey
        ).toString(CryptoJS.enc.Base64);
        return Buffer.from(decrypted, 'base64');
      }

      return data;
    } catch (error) {
      logger.error('Failed to read audio file', { fileName, error });
      throw error;
    }
  }

  static async deleteAudioFile(fileName: string): Promise<void> {
    const filePath = this.getAudioPath(fileName);

    try {
      await fs.unlink(filePath);
      logger.info('Audio file deleted', { fileName });
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        logger.error('Failed to delete audio file', { fileName, error });
        throw error;
      }
    }
  }

  static async moveFromTemp(tempPath: string, fileName: string): Promise<string> {
    const finalPath = this.getAudioPath(fileName);

    try {
      await fs.rename(tempPath, finalPath);
      logger.info('File moved from temp', { tempPath, finalPath });
      return finalPath;
    } catch (error) {
      logger.error('Failed to move file from temp', { tempPath, error });
      throw error;
    }
  }

  static async getFileStats(fileName: string): Promise<fs.Stats | null> {
    const filePath = this.getAudioPath(fileName);

    try {
      return await fs.stat(filePath);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  static async cleanupOldFiles(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    let deletedCount = 0;

    try {
      const files = await fs.readdir(derivedConfig.storage.audioPath);

      for (const file of files) {
        const filePath = path.join(derivedConfig.storage.audioPath, file);
        const stats = await fs.stat(filePath);

        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          deletedCount++;
          logger.info('Deleted old file', { file, age: stats.mtime });
        }
      }

      logger.info('Cleanup completed', { deletedFiles: deletedCount });
      return deletedCount;
    } catch (error) {
      logger.error('Cleanup failed', error);
      throw error;
    }
  }
}