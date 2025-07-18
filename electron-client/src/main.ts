import { app, BrowserWindow, ipcMain, Tray, Menu, dialog, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import Store from 'electron-store';
import path from 'path';
import { WebSocketClient } from './services/websocket';
import { AuthService } from './services/auth';

// Configure electron store
const store = new Store({
  name: '3cx-ninjaone-config',
  schema: {
    extension: { type: 'string' },
    agentName: { type: 'string' },
    serverUrl: { type: 'string', default: 'http://localhost:3002' },
    autoLaunch: { type: 'boolean', default: true },
    minimizeToTray: { type: 'boolean', default: true },
    notifications: { type: 'boolean', default: true }
  }
});

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let wsClient: WebSocketClient | null = null;
let authService: AuthService;

// Enable live reload for Electron
if (process.env.NODE_ENV === 'development') {
  require('electron-reload')(__dirname, {
    electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
    hardResetMethod: 'exit'
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 600,
    minHeight: 400,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false // Don't show until ready
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Handle window close
  mainWindow.on('close', (event) => {
    if (store.get('minimizeToTray') && !app.isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  tray = new Tray(path.join(__dirname, 'assets', 'tray-icon.png'));
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      }
    },
    {
      label: 'Settings',
      click: () => {
        mainWindow?.webContents.send('navigate', '/settings');
        mainWindow?.show();
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('3CX NinjaOne Agent');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    mainWindow?.isVisible() ? mainWindow.hide() : mainWindow?.show();
  });
}

// App event handlers
app.whenReady().then(async () => {
  createWindow();
  createTray();

  // Initialize services
  authService = new AuthService(store);

  // Check for updates
  autoUpdater.checkForUpdatesAndNotify();

  // Check if we have stored credentials
  const extension = store.get('extension');
  if (extension) {
    // Auto-login if we have stored extension
    try {
      const token = await authService.login(extension, store.get('agentName'));
      if (token) {
        mainWindow?.webContents.send('auth-success', { token, extension });
        connectWebSocket(token);
      }
    } catch (error) {
      console.error('Auto-login failed:', error);
    }
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

// IPC Handlers
ipcMain.handle('get-config', () => {
  return {
    extension: store.get('extension'),
    agentName: store.get('agentName'),
    serverUrl: store.get('serverUrl'),
    autoLaunch: store.get('autoLaunch'),
    minimizeToTray: store.get('minimizeToTray'),
    notifications: store.get('notifications')
  };
});

ipcMain.handle('save-config', (event, config) => {
  Object.entries(config).forEach(([key, value]) => {
    store.set(key, value);
  });
  return { success: true };
});

ipcMain.handle('login', async (event, { extension, agentName }) => {
  try {
    const token = await authService.login(extension, agentName);
    
    // Save to store
    store.set('extension', extension);
    store.set('agentName', agentName);
    
    // Connect WebSocket
    connectWebSocket(token);
    
    return { success: true, token };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('logout', async () => {
  try {
    // Disconnect WebSocket
    if (wsClient) {
      wsClient.disconnect();
      wsClient = null;
    }
    
    // Clear stored credentials
    store.delete('extension');
    store.delete('agentName');
    
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.on('show-notification', (event, { title, body }) => {
  if (store.get('notifications')) {
    const notification = new Notification({
      title,
      body,
      icon: path.join(__dirname, 'assets', 'icon.png')
    });
    
    notification.on('click', () => {
      mainWindow?.show();
      mainWindow?.focus();
    });
    
    notification.show();
  }
});

ipcMain.on('open-external', (event, url) => {
  shell.openExternal(url);
});

// Handle draft actions from renderer
ipcMain.on('confirm-draft', (event, data) => {
  if (wsClient) {
    wsClient.confirmDraft(data.draftId, data.modifiedData);
  }
});

ipcMain.on('cancel-draft', (event, data) => {
  if (wsClient) {
    wsClient.cancelDraft(data.draftId);
  }
});

// WebSocket connection
function connectWebSocket(token: string) {
  if (wsClient) {
    wsClient.disconnect();
  }

  wsClient = new WebSocketClient(
    `${store.get('serverUrl').replace('http', 'ws')}/agent`,
    token
  );

  wsClient.on('connected', () => {
    mainWindow?.webContents.send('ws-connected');
  });

  wsClient.on('disconnected', () => {
    mainWindow?.webContents.send('ws-disconnected');
  });

  wsClient.on('newDraft', (draft) => {
    mainWindow?.webContents.send('new-draft', draft);
    
    // Show notification
    if (store.get('notifications')) {
      mainWindow?.webContents.send('show-notification', {
        title: 'New Call Draft',
        body: `New draft ticket from ${draft.callInfo.caller || 'Unknown'}`
      });
    }
    
    // Show window
    mainWindow?.show();
    mainWindow?.focus();
  });

  wsClient.on('ticketCreated', (data) => {
    mainWindow?.webContents.send('ticket-created', data);
  });

  wsClient.on('error', (error) => {
    mainWindow?.webContents.send('ws-error', error);
  });

  wsClient.connect();
}

// Auto-updater events
autoUpdater.on('update-available', () => {
  dialog.showMessageBox(mainWindow!, {
    type: 'info',
    title: 'Update available',
    message: 'A new version is available. It will be downloaded in the background.',
    buttons: ['OK']
  });
});

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox(mainWindow!, {
    type: 'info',
    title: 'Update ready',
    message: 'Update downloaded. The application will restart to apply the update.',
    buttons: ['Restart Now', 'Later']
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

// Set app user model id for Windows
if (process.platform === 'win32') {
  app.setAppUserModelId('com.company.3cx-ninjaone-agent');
}

// Declare additional properties on app
declare module 'electron' {
  interface App {
    isQuitting?: boolean;
  }
}