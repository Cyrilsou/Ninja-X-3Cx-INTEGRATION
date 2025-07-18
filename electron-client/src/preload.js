const { contextBridge, ipcRenderer } = require('electron');

// Expose des API sécurisées au renderer
contextBridge.exposeInMainWorld('api', {
  // Configuration
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  testConnection: (config) => ipcRenderer.invoke('test-connection', config),
  
  // Événements d'appel
  onCallStarted: (callback) => ipcRenderer.on('call-started', (event, data) => callback(data)),
  onCallEnded: (callback) => ipcRenderer.on('call-ended', (event, data) => callback(data)),
  onTranscriptionReady: (callback) => ipcRenderer.on('transcription-ready', (event, data) => callback(data)),
  
  // Statut
  onStatusChange: (callback) => ipcRenderer.on('status-change', (event, status) => callback(status)),
  
  // Configuration
  onOpenConfig: (callback) => ipcRenderer.on('open-config', () => callback())
});