const { app, BrowserWindow, Menu, Tray, ipcMain, dialog, Notification } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { CallDetector } = require('./services/callDetector');
const { AudioRecorder } = require('./services/audioRecorder');
const { ServerConnection } = require('./services/serverConnection');
const log = require('electron-log');

// Configuration du logger
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

// Store pour la configuration
const store = new Store();

let mainWindow = null;
let tray = null;
let callDetector = null;
let audioRecorder = null;
let serverConnection = null;

// Empêcher les instances multiples
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  return;
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// Création de la fenêtre principale
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

// Création du tray
function createTray() {
  tray = new Tray(path.join(__dirname, '../assets/tray.png'));
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Ouvrir', click: () => mainWindow.show() },
    { type: 'separator' },
    { label: 'Statut', enabled: false, id: 'status' },
    { type: 'separator' },
    { label: 'Démarrer l\'enregistrement', click: () => startRecording(), id: 'start' },
    { label: 'Arrêter l\'enregistrement', click: () => stopRecording(), enabled: false, id: 'stop' },
    { type: 'separator' },
    { label: 'Configuration', click: () => openConfig() },
    { type: 'separator' },
    { label: 'Quitter', click: () => {
      app.isQuitting = true;
      app.quit();
    }}
  ]);
  
  tray.setToolTip('3CX Whisper Agent - Prêt');
  tray.setContextMenu(contextMenu);
  
  tray.on('double-click', () => {
    mainWindow.show();
  });
}

// Initialisation des services
async function initializeServices() {
  const config = store.get('config', {});
  
  if (!config.serverUrl || !config.extension) {
    log.warn('Configuration manquante');
    openConfig();
    return;
  }

  try {
    // Connexion au serveur
    serverConnection = new ServerConnection(config.serverUrl, config.extension);
    await serverConnection.connect();
    
    // Détecteur d'appels 3CX
    callDetector = new CallDetector(config.extension);
    
    // Enregistreur audio
    audioRecorder = new AudioRecorder();
    
    // Événements du détecteur d'appels
    callDetector.on('callStarted', (callInfo) => {
      log.info('Appel détecté:', callInfo);
      handleCallStart(callInfo);
    });
    
    callDetector.on('callEnded', (callInfo) => {
      log.info('Appel terminé:', callInfo);
      handleCallEnd(callInfo);
    });
    
    // Démarrer la détection
    callDetector.start();
    
    updateTrayStatus('En ligne', 'green');
    
  } catch (error) {
    log.error('Erreur d\'initialisation:', error);
    updateTrayStatus('Erreur', 'red');
    
    new Notification({
      title: '3CX Whisper Agent',
      body: `Erreur de connexion: ${error.message}`,
      icon: path.join(__dirname, '../assets/icon.png')
    }).show();
  }
}

// Gestion du début d'appel
async function handleCallStart(callInfo) {
  try {
    // Notification
    new Notification({
      title: 'Appel en cours',
      body: `${callInfo.direction === 'inbound' ? 'De' : 'Vers'}: ${callInfo.remoteNumber}`,
      icon: path.join(__dirname, '../assets/icon.png')
    }).show();
    
    // Démarrer l'enregistrement
    const filename = `call_${callInfo.callId}_${Date.now()}.wav`;
    const filepath = path.join(app.getPath('userData'), 'recordings', filename);
    
    audioRecorder.startRecording(filepath);
    
    // Mettre à jour le statut
    updateTrayStatus('En appel', 'orange');
    
    // Informer le serveur
    serverConnection.notifyCallStart({
      callId: callInfo.callId,
      extension: callInfo.extension,
      remoteNumber: callInfo.remoteNumber,
      direction: callInfo.direction,
      startTime: new Date().toISOString()
    });
    
  } catch (error) {
    log.error('Erreur au démarrage de l\'enregistrement:', error);
  }
}

// Gestion de la fin d'appel
async function handleCallEnd(callInfo) {
  try {
    // Arrêter l'enregistrement
    const recordingPath = await audioRecorder.stopRecording();
    
    if (!recordingPath) {
      log.warn('Aucun enregistrement trouvé pour l\'appel');
      return;
    }
    
    // Notification
    new Notification({
      title: 'Appel terminé',
      body: 'Envoi pour transcription...',
      icon: path.join(__dirname, '../assets/icon.png')
    }).show();
    
    // Envoyer au serveur
    const result = await serverConnection.uploadRecording(recordingPath, {
      callId: callInfo.callId,
      extension: callInfo.extension,
      remoteNumber: callInfo.remoteNumber,
      direction: callInfo.direction,
      duration: callInfo.duration,
      endTime: new Date().toISOString()
    });
    
    // Afficher le résultat
    if (result.success) {
      mainWindow.webContents.send('transcription-ready', result.transcription);
      
      new Notification({
        title: 'Transcription prête',
        body: 'Cliquez pour voir la transcription',
        icon: path.join(__dirname, '../assets/icon.png')
      }).show();
    }
    
    // Mettre à jour le statut
    updateTrayStatus('En ligne', 'green');
    
  } catch (error) {
    log.error('Erreur lors de l\'envoi de l\'enregistrement:', error);
    
    new Notification({
      title: 'Erreur',
      body: 'Impossible d\'envoyer l\'enregistrement',
      icon: path.join(__dirname, '../assets/icon.png')
    }).show();
  }
}

// Mise à jour du statut dans le tray
function updateTrayStatus(status, color) {
  if (!tray) return;
  
  tray.setToolTip(`3CX Whisper Agent - ${status}`);
  
  const menu = tray.contextMenu;
  const statusItem = menu.getMenuItemById('status');
  if (statusItem) {
    statusItem.label = `Statut: ${status}`;
  }
  
  // Changer l'icône selon le statut
  const iconName = color === 'green' ? 'tray.png' : 
                   color === 'orange' ? 'tray-busy.png' : 
                   'tray-error.png';
  tray.setImage(path.join(__dirname, '../assets', iconName));
}

// Ouvrir la configuration
function openConfig() {
  mainWindow.webContents.send('open-config');
  mainWindow.show();
}

// IPC Handlers
ipcMain.handle('get-config', () => {
  return store.get('config', {});
});

ipcMain.handle('save-config', async (event, config) => {
  store.set('config', config);
  
  // Redémarrer les services
  if (callDetector) callDetector.stop();
  if (serverConnection) serverConnection.disconnect();
  
  await initializeServices();
  
  return { success: true };
});

ipcMain.handle('test-connection', async (event, config) => {
  try {
    const testConnection = new ServerConnection(config.serverUrl, config.extension);
    await testConnection.testConnection();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Démarrage de l'application
app.whenReady().then(async () => {
  createWindow();
  createTray();
  await initializeServices();
  
  // Démarrage automatique
  if (store.get('config.autoStart', true)) {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: app.getPath('exe')
    });
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Nettoyage à la fermeture
app.on('before-quit', () => {
  if (callDetector) callDetector.stop();
  if (audioRecorder) audioRecorder.cleanup();
  if (serverConnection) serverConnection.disconnect();
});