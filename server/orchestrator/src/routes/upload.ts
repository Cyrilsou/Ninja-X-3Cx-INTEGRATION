import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { DatabaseService } from '../services/database';
import { QueueService } from '../services/queue';
import { logger } from '../utils/logger';
import { authMiddleware } from '../middleware/auth';


const router = Router();

// Configuration multer pour l'upload
const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const uploadDir = process.env.UPLOAD_PATH || '/tmp/uploads';
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `recording-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB max
  },
  fileFilter: (_req, file, cb) => {
    // Accept audio files only
    const allowedTypes = ['audio/wav', 'audio/wave', 'audio/x-wav', 'audio/mpeg', 'audio/mp3'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format de fichier non supporté. Utilisez WAV ou MP3.'));
    }
  }
});

// Route pour upload d'enregistrement
router.post('/api/upload-recording', 
  authMiddleware, 
  upload.single('audio'), 
  async (req: any, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'Aucun fichier audio reçu' });
        return;
      }

      const callInfo = JSON.parse(req.body.callInfo || '{}');
      const extension = req.headers['x-extension'] || callInfo.extension;

      logger.info('Enregistrement reçu', {
        filename: req.file.filename,
        size: req.file.size,
        extension,
        callInfo
      });

      // Vérifier que l'extension correspond à l'agent authentifié
      if (req.agent && req.agent.extension !== extension) {
        res.status(403).json({ error: 'Extension non autorisée' });
        return;
      }

      // Sauvegarder les métadonnées en base
      const call = await DatabaseService.query(
        `INSERT INTO calls (
          external_id, extension, remote_number, direction, 
          duration, start_time, end_time, recording_path, 
          recording_size, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'recorded')
        RETURNING *`,
        [
          callInfo.callId,
          extension,
          callInfo.remoteNumber,
          callInfo.direction,
          callInfo.duration || 0,
          callInfo.startTime,
          callInfo.endTime,
          req.file.filename,
          req.file.size
        ]
      );

      // Chiffrer le fichier audio
      const encryptedPath = await encryptAudioFile(req.file.path);
      
      // Mettre à jour le chemin chiffré
      await DatabaseService.query(
        'UPDATE calls SET recording_path = $1 WHERE id = $2',
        [encryptedPath, call.rows[0].id]
      );

      // Supprimer le fichier non chiffré
      await fs.unlink(req.file.path);

      // Ajouter à la queue de transcription
      await QueueService.addTranscriptionJob({
        callId: call.rows[0].id,
        audioPath: encryptedPath,
        extension,
        priority: 'normal'
      });

      logger.info('Enregistrement ajouté à la queue de transcription', {
        callId: call.rows[0].id
      });

      res.json({
        success: true,
        callId: call.rows[0].id,
        message: 'Enregistrement reçu et en cours de traitement'
      });

    } catch (error) {
      logger.error('Erreur upload enregistrement', error);
      res.status(500).json({ 
        error: 'Erreur lors du traitement de l\'enregistrement' 
      });
    }
  }
);

// Fonction pour chiffrer le fichier audio
async function encryptAudioFile(filepath: string): Promise<string> {
  const algorithm = 'aes-256-cbc';
  const key = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');
  const iv = crypto.randomBytes(16);

  const encryptedPath = filepath + '.enc';
  
  const input = await fs.readFile(filepath);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  const encrypted = Buffer.concat([
    iv,
    cipher.update(input),
    cipher.final()
  ]);

  await fs.writeFile(encryptedPath, encrypted);
  
  return path.basename(encryptedPath);
}

// Route pour vérifier le statut d'une transcription
router.get('/api/transcription-status/:callId', authMiddleware, async (req: any, res): Promise<void> => {
  try {
    const { callId } = req.params;
    
    const result = await DatabaseService.query(
      `SELECT id, status, transcription_text, transcription_summary 
       FROM calls 
       WHERE id = $1 AND extension = $2`,
      [callId, req.agent?.extension]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Appel non trouvé' });
      return;
    }

    const call = result.rows[0];
    
    res.json({
      callId: call.id,
      status: call.status,
      transcription: call.transcription_text,
      summary: call.transcription_summary,
      ready: call.status === 'transcribed'
    });

  } catch (error) {
    logger.error('Erreur statut transcription', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;