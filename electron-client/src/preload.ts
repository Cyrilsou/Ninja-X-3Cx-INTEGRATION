import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Config
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config: any) => ipcRenderer.invoke('save-config', config),
  
  // Auth
  login: (credentials: { extension: string; agentName?: string }) => 
    ipcRenderer.invoke('login', credentials),
  logout: () => ipcRenderer.invoke('logout'),
  
  // Notifications
  showNotification: (notification: { title: string; body: string }) =>
    ipcRenderer.send('show-notification', notification),
  
  // External links
  openExternal: (url: string) => ipcRenderer.send('open-external', url),
  
  // Event listeners
  on: (channel: string, callback: Function) => {
    const validChannels = [
      'auth-success',
      'ws-connected',
      'ws-disconnected',
      'ws-error',
      'new-draft',
      'ticket-created',
      'navigate',
      'show-notification'
    ];
    
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },
  
  removeListener: (channel: string, callback: Function) => {
    ipcRenderer.removeListener(channel, callback as any);
  },
  
  // Draft actions
  confirmDraft: (draftId: string, modifiedData?: any) => 
    ipcRenderer.send('confirm-draft', { draftId, modifiedData }),
  
  cancelDraft: (draftId: string) => 
    ipcRenderer.send('cancel-draft', { draftId })
});

// Type definitions for TypeScript
export interface ElectronAPI {
  getConfig: () => Promise<any>;
  saveConfig: (config: any) => Promise<{ success: boolean }>;
  login: (credentials: { extension: string; agentName?: string }) => 
    Promise<{ success: boolean; token?: string; error?: string }>;
  logout: () => Promise<{ success: boolean; error?: string }>;
  showNotification: (notification: { title: string; body: string }) => void;
  openExternal: (url: string) => void;
  on: (channel: string, callback: Function) => void;
  removeListener: (channel: string, callback: Function) => void;
  confirmDraft: (draftId: string, modifiedData?: any) => void;
  cancelDraft: (draftId: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}