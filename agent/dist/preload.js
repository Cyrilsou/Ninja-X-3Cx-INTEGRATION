"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// API exposée au renderer
electron_1.contextBridge.exposeInMainWorld('electron', {
    store: {
        get: (key) => electron_1.ipcRenderer.invoke('store:get', key),
        set: (key, value) => electron_1.ipcRenderer.invoke('store:set', key, value)
    },
    app: {
        getVersion: () => electron_1.ipcRenderer.invoke('app:getVersion')
    },
    shell: {
        openExternal: (url) => electron_1.ipcRenderer.invoke('shell:openExternal', url)
    }
});
