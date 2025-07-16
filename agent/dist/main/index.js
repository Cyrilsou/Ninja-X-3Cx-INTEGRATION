"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const electron_store_1 = __importDefault(require("electron-store"));
// Configuration du store
const store = new electron_store_1.default({
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
let mainWindow = null;
let tray = null;
let isQuitting = false;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
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
    }
    else {
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
        tray = new electron_1.Tray(iconPath);
        const contextMenu = electron_1.Menu.buildFromTemplate([
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
                    electron_1.app.quit();
                }
            }
        ]);
        tray.setToolTip('3CX Ninja Agent');
        tray.setContextMenu(contextMenu);
        tray.on('double-click', () => {
            mainWindow?.show();
        });
    }
    catch (error) {
        console.error('Failed to create tray:', error);
        // L'application continue sans tray
    }
}
// IPC Handlers
electron_1.ipcMain.handle('store:get', (event, key) => {
    return store.get(key);
});
electron_1.ipcMain.handle('store:set', (event, key, value) => {
    store.set(key, value);
});
electron_1.ipcMain.handle('app:getVersion', () => {
    return electron_1.app.getVersion();
});
electron_1.ipcMain.handle('shell:openExternal', (event, url) => {
    electron_1.shell.openExternal(url);
});
// App events
electron_1.app.whenReady().then(() => {
    createWindow();
    createTray();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
// Auto-démarrage Windows
if (process.platform === 'win32') {
    electron_1.app.setLoginItemSettings({
        openAtLogin: store.get('autoStart', false),
        path: electron_1.app.getPath('exe')
    });
}
