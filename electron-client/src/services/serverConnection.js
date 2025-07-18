const io = require('socket.io-client');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const log = require('electron-log');

/**
 * Connexion au serveur Whisper
 */
class ServerConnection {
  constructor(serverUrl, extension) {
    this.serverUrl = serverUrl;
    this.extension = extension;
    this.socket = null;
    this.connected = false;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      try {
        // Connexion WebSocket
        const wsUrl = this.serverUrl.replace('http:', 'ws:').replace('https:', 'wss:');
        this.socket = io(wsUrl, {
          path: '/ws',
          query: {
            extension: this.extension,
            type: 'agent'
          },
          transports: ['websocket'],
          reconnection: true,
          reconnectionDelay: 5000,
          reconnectionAttempts: 10
        });

        this.socket.on('connect', () => {
          log.info('Connecté au serveur');
          this.connected = true;
          resolve();
        });

        this.socket.on('disconnect', () => {
          log.warn('Déconnecté du serveur');
          this.connected = false;
        });

        this.socket.on('error', (error) => {
          log.error('Erreur WebSocket:', error);
          reject(error);
        });

        this.socket.on('transcription-ready', (data) => {
          log.info('Transcription reçue:', data);
          // Émettre un événement global
          if (global.mainWindow) {
            global.mainWindow.webContents.send('transcription-ready', data);
          }
        });

        // Timeout de connexion
        setTimeout(() => {
          if (!this.connected) {
            reject(new Error('Timeout de connexion'));
          }
        }, 10000);

      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
  }

  async testConnection() {
    try {
      const response = await axios.get(`${this.serverUrl}/health`, {
        timeout: 5000
      });
      return response.data;
    } catch (error) {
      throw new Error(`Impossible de se connecter au serveur: ${error.message}`);
    }
  }

  notifyCallStart(callInfo) {
    if (!this.socket || !this.connected) {
      log.warn('Socket non connecté pour notifier le début d\'appel');
      return;
    }

    this.socket.emit('call-started', {
      ...callInfo,
      timestamp: new Date().toISOString()
    });
  }

  async uploadRecording(filepath, callInfo) {
    try {
      log.info('Upload de l\'enregistrement:', filepath);

      // Vérifier que le fichier existe
      if (!fs.existsSync(filepath)) {
        throw new Error('Fichier audio introuvable');
      }

      const stats = fs.statSync(filepath);
      log.info('Taille du fichier:', stats.size);

      // Créer le formulaire multipart
      const formData = new FormData();
      formData.append('audio', fs.createReadStream(filepath), {
        filename: `call_${callInfo.callId}.wav`,
        contentType: 'audio/wav'
      });
      formData.append('callInfo', JSON.stringify(callInfo));

      // Envoyer au serveur
      const response = await axios.post(
        `${this.serverUrl}/api/upload-recording`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'X-Extension': this.extension
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 300000 // 5 minutes
        }
      );

      log.info('Upload réussi:', response.data);

      // Supprimer le fichier local après upload réussi
      try {
        fs.unlinkSync(filepath);
        log.info('Fichier local supprimé');
      } catch (err) {
        log.warn('Impossible de supprimer le fichier local:', err);
      }

      return response.data;

    } catch (error) {
      log.error('Erreur upload:', error);
      
      // En cas d'erreur, conserver le fichier pour réessayer plus tard
      this.queueForRetry(filepath, callInfo);
      
      throw error;
    }
  }

  queueForRetry(filepath, callInfo) {
    // Sauvegarder les infos pour réessayer plus tard
    const retryInfo = {
      filepath,
      callInfo,
      attempts: 0,
      lastAttempt: new Date().toISOString()
    };

    // Stocker dans un fichier JSON
    const retryFile = filepath.replace('.wav', '_retry.json');
    fs.writeFileSync(retryFile, JSON.stringify(retryInfo, null, 2));

    log.info('Enregistrement mis en file d\'attente pour réessai:', retryFile);
  }

  async retryFailedUploads() {
    // Chercher les fichiers en attente de réessai
    const { app } = require('electron');
    const recordingsDir = require('path').join(app.getPath('userData'), 'recordings');
    
    fs.readdir(recordingsDir, async (err, files) => {
      if (err) return;

      const retryFiles = files.filter(f => f.endsWith('_retry.json'));

      for (const retryFile of retryFiles) {
        try {
          const retryPath = require('path').join(recordingsDir, retryFile);
          const retryInfo = JSON.parse(fs.readFileSync(retryPath, 'utf8'));

          if (retryInfo.attempts < 3) {
            log.info('Réessai upload:', retryInfo.filepath);
            
            try {
              await this.uploadRecording(retryInfo.filepath, retryInfo.callInfo);
              // Succès, supprimer le fichier de retry
              fs.unlinkSync(retryPath);
            } catch (error) {
              // Incrémenter le compteur d'essais
              retryInfo.attempts++;
              retryInfo.lastAttempt = new Date().toISOString();
              fs.writeFileSync(retryPath, JSON.stringify(retryInfo, null, 2));
            }
          } else {
            log.warn('Trop de tentatives pour:', retryInfo.filepath);
          }
        } catch (error) {
          log.error('Erreur retry:', error);
        }
      }
    });
  }

  startRetryTimer() {
    // Réessayer les uploads échoués toutes les 5 minutes
    setInterval(() => {
      if (this.connected) {
        this.retryFailedUploads();
      }
    }, 5 * 60 * 1000);
  }
}

module.exports = { ServerConnection };