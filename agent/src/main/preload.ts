import { contextBridge, ipcRenderer } from 'electron';

// API exposée au renderer
contextBridge.exposeInMainWorld('electron', {
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('store:set', key, value)
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion')
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url)  
  },
  audio: {
    startCapture: (callId: string) => ipcRenderer.invoke('audio:startCapture', callId),
    stopCapture: () => ipcRenderer.invoke('audio:stopCapture')
  }
});