import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { StorageService } from '../services/storage';
import { DatabaseService } from '../services/database';
import { QueueService } from '../services/queue';
import { WhisperConnector } from '../services/whisperConnector';
import { CallStatus } from '../types/database.types';

export async function downloadRecording(
  callId: string,
  recordingUrl: string
): Promise<string | null> {
  logger.info('Starting recording download', { callId, recordingUrl });

  try {
    // Update status to downloading
    await DatabaseService.updateCall(callId, {
      status: CallStatus.DOWNLOADING
    });

    // Download the recording
    const response = await axios.get(recordingUrl, {
      responseType: 'arraybuffer',
      headers: {
        'Authorization': `Bearer ${config.THREECX_API_KEY}`,
        'User-Agent': '3CX-Integration/1.0'
      },
      maxContentLength: config.MAX_FILE_SIZE,
      timeout: 30000 // 30 seconds timeout
    });

    const buffer = Buffer.from(response.data);
    
    // Generate filename and save
    const fileName = StorageService.generateFileName(callId, 'wav');
    const filePath = await StorageService.saveAudioFile(buffer, fileName, true);

    // Update database with local path
    await DatabaseService.updateCall(callId, {
      status: CallStatus.DOWNLOADED,
      localRecordingPath: fileName
    });

    logger.info('Recording downloaded successfully', { callId, fileName });

    // Add to transcription queue using WhisperConnector
    await WhisperConnector.submitTranscriptionJob(callId, fileName);

    return filePath;

  } catch (error) {
    logger.error('Failed to download recording', { callId, error });

    await DatabaseService.updateCall(callId, {
      status: CallStatus.FAILED,
      errorMessage: `Download failed: ${(error as Error).message}`
    });

    // Log audit event
    await DatabaseService.logAuditEvent(
      'RECORDING_DOWNLOAD_FAILED',
      'call',
      callId,
      undefined,
      undefined,
      { error: (error as Error).message }
    );

    return null;
  }
}

export async function processRecordingFromWebhook(
  callId: string,
  recordingUrl?: string
): Promise<void> {
  if (!recordingUrl) {
    logger.warn('No recording URL provided', { callId });
    return;
  }

  try {
    await downloadRecording(callId, recordingUrl);
  } catch (error) {
    logger.error('Failed to process recording from webhook', { callId, error });
  }
}