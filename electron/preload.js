// YolongCMS Desktop — Preload Script (Secure Bridge)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('yolongcms', {
    // 应用信息
    platform: process.platform,

    // IPC 通信桥 — 后续功能扩展用
    send: (channel, data) => ipcRenderer.send(channel, data),
    invoke: (channel, data) => ipcRenderer.invoke(channel, data),
    on: (channel, callback) => {
        ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    },
});
