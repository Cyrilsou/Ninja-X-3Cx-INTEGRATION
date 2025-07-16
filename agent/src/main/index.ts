import { app, BrowserWindow, ipcMain, shell, Tray, Menu } from 'electron';
import * as path from 'path';
import Store from 'electron-store';

// Configuration du store
const store = new Store({
  defaults: {
    agentConfig: {
      agent: {
        id: '',
        email: '',
        extension: '',
        name: ''
      },
      server: {
        url: 'http://localhost:3000',
        apiKey: ''
      },
      audio: {
        device: 'default',
        sampleRate: 16000,
        channels: 1,
        chunkSize: 4096
      },
      ui: {
        autoPopup: true,
        theme: 'light',
        position: 'bottom-right'
      }
    }
  }
});

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../../../assets/icon.ico'),
    title: '3CX Ninja Agent'
  });

  // En développement
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // En production
    mainWindow.loadFile(path.join(__dirname, '../../dist-react/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Empêcher la fermeture, minimiser dans le tray
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

function createTray() {
  try {
    const iconPath = path.join(__dirname, '../../../assets/tray.ico');
    tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Ouvrir',
      click: () => {
        mainWindow?.show();
      }
    },
    {
      label: 'Paramètres',
      click: () => {
        mainWindow?.show();
        mainWindow?.webContents.send('navigate', '/settings');
      }
    },
    { type: 'separator' },
    {
      label: 'Quitter',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('3CX Ninja Agent');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow?.show();
  });
  } catch (error) {
    console.error('Failed to create tray:', error);
    // L'application continue sans tray
  }
}

// IPC Handlers
ipcMain.handle('store:get', (event, key) => {
  return store.get(key);
});

ipcMain.handle('store:set', (event, key, value) => {
  store.set(key, value);
});

ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

ipcMain.handle('shell:openExternal', (event, url) => {
  shell.openExternal(url);
});

// App events
app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Auto-démarrage Windows
if (process.platform === 'win32') {
  app.setLoginItemSettings({
    openAtLogin: store.get('autoStart', false),
    path: app.getPath('exe')
  });
}

