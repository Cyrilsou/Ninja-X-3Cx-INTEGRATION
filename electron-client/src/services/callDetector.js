const { EventEmitter } = require('events');
const activeWin = require('active-win');
const fs = require('fs');
const path = require('path');
const log = require('electron-log');

/**
 * Détecteur d'appels 3CX
 * Surveille l'activité du client 3CX pour détecter les appels
 */
class CallDetector extends EventEmitter {
  constructor(extension) {
    super();
    this.extension = extension;
    this.isMonitoring = false;
    this.currentCall = null;
    this.monitorInterval = null;
    this.callStates = new Map();
  }

  start() {
    if (this.isMonitoring) return;
    
    log.info('Démarrage de la détection d\'appels 3CX');
    this.isMonitoring = true;
    
    // Surveillance toutes les secondes
    this.monitorInterval = setInterval(() => {
      this.checkForCalls();
    }, 1000);
    
    // Surveillance du fichier de log 3CX si disponible
    this.watch3CXLogs();
  }

  stop() {
    if (!this.isMonitoring) return;
    
    log.info('Arrêt de la détection d\'appels');
    this.isMonitoring = false;
    
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    
    if (this.logWatcher) {
      this.logWatcher.close();
    }
  }

  async checkForCalls() {
    try {
      // Méthode 1: Vérifier la fenêtre active
      const activeWindow = await activeWin();
      
      if (activeWindow && activeWindow.title) {
        const title = activeWindow.title.toLowerCase();
        
        // Patterns pour détecter un appel 3CX
        const callPatterns = [
          'call with',
          'appel avec',
          'calling',
          'en appel',
          'incoming call',
          'appel entrant',
          this.extension
        ];
        
        const isCallWindow = callPatterns.some(pattern => 
          title.includes(pattern.toLowerCase())
        );
        
        if (isCallWindow && !this.currentCall) {
          // Nouvel appel détecté
          const callInfo = this.parseCallInfo(activeWindow.title);
          this.handleNewCall(callInfo);
        } else if (!isCallWindow && this.currentCall) {
          // Appel terminé
          this.handleCallEnd();
        }
      }
      
      // Méthode 2: Vérifier les processus 3CX
      this.check3CXProcesses();
      
    } catch (error) {
      log.error('Erreur lors de la vérification des appels:', error);
    }
  }

  parseCallInfo(windowTitle) {
    // Extraire les informations de l'appel du titre de la fenêtre
    const callInfo = {
      callId: `3cx_${Date.now()}`,
      extension: this.extension,
      remoteNumber: 'Unknown',
      direction: 'unknown',
      startTime: new Date()
    };
    
    // Patterns pour extraire le numéro
    const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/;
    const phoneMatch = windowTitle.match(phoneRegex);
    
    if (phoneMatch) {
      callInfo.remoteNumber = phoneMatch[0];
    }
    
    // Déterminer la direction
    if (windowTitle.toLowerCase().includes('incoming') || 
        windowTitle.toLowerCase().includes('entrant')) {
      callInfo.direction = 'inbound';
    } else if (windowTitle.toLowerCase().includes('calling') || 
               windowTitle.toLowerCase().includes('sortant')) {
      callInfo.direction = 'outbound';
    }
    
    return callInfo;
  }

  handleNewCall(callInfo) {
    log.info('Nouvel appel détecté:', callInfo);
    
    this.currentCall = {
      ...callInfo,
      startTime: new Date()
    };
    
    this.emit('callStarted', this.currentCall);
  }

  handleCallEnd() {
    if (!this.currentCall) return;
    
    const endTime = new Date();
    const duration = Math.floor((endTime - this.currentCall.startTime) / 1000);
    
    const callInfo = {
      ...this.currentCall,
      endTime,
      duration
    };
    
    log.info('Appel terminé:', callInfo);
    
    this.emit('callEnded', callInfo);
    this.currentCall = null;
  }

  watch3CXLogs() {
    // Chemins possibles pour les logs 3CX
    const possiblePaths = [
      'C:\\ProgramData\\3CXPhone for Windows\\Logs',
      'C:\\Users\\' + process.env.USERNAME + '\\AppData\\Local\\3CXPhone for Windows\\Logs',
      'C:\\Program Files\\3CXPhone\\Logs'
    ];
    
    for (const logPath of possiblePaths) {
      if (fs.existsSync(logPath)) {
        log.info('Surveillance des logs 3CX:', logPath);
        
        const chokidar = require('chokidar');
        this.logWatcher = chokidar.watch(path.join(logPath, '*.log'), {
          persistent: true,
          usePolling: true,
          interval: 1000
        });
        
        this.logWatcher.on('change', (filepath) => {
          this.parseLogFile(filepath);
        });
        
        break;
      }
    }
  }

  parseLogFile(filepath) {
    // Lire les dernières lignes du fichier de log
    fs.readFile(filepath, 'utf8', (err, data) => {
      if (err) return;
      
      const lines = data.split('\n').slice(-50); // Dernières 50 lignes
      
      for (const line of lines) {
        // Rechercher les patterns d'appel
        if (line.includes('Call started') || line.includes('Incoming call')) {
          const callInfo = this.parseLogLine(line);
          if (callInfo && !this.currentCall) {
            this.handleNewCall(callInfo);
          }
        } else if (line.includes('Call ended') || line.includes('Call disconnected')) {
          if (this.currentCall) {
            this.handleCallEnd();
          }
        }
      }
    });
  }

  parseLogLine(line) {
    // Parser une ligne de log pour extraire les infos d'appel
    const callInfo = {
      callId: `3cx_${Date.now()}`,
      extension: this.extension,
      remoteNumber: 'Unknown',
      direction: 'unknown'
    };
    
    // Extraire le numéro si présent
    const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/;
    const phoneMatch = line.match(phoneRegex);
    
    if (phoneMatch) {
      callInfo.remoteNumber = phoneMatch[0];
    }
    
    // Déterminer la direction
    if (line.includes('Incoming')) {
      callInfo.direction = 'inbound';
    } else if (line.includes('Outgoing')) {
      callInfo.direction = 'outbound';
    }
    
    return callInfo;
  }

  check3CXProcesses() {
    // Vérifier si le processus 3CX est en cours d'exécution
    const { exec } = require('child_process');
    
    exec('tasklist /FI "IMAGENAME eq 3CXPhone.exe"', (error, stdout) => {
      if (error) return;
      
      const is3CXRunning = stdout.includes('3CXPhone.exe');
      
      if (!is3CXRunning && this.currentCall) {
        // 3CX fermé pendant un appel
        this.handleCallEnd();
      }
    });
  }
}

module.exports = { CallDetector };