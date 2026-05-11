// YolongCMS Desktop — Preload Script (Secure Bridge)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('yolongcms', {
    // 应用信息
    platform: process.platform,

    // ===== 应用状态 API =====
    app: {
        read: () => ipcRenderer.invoke('app:read'),
        write: (data) => ipcRenderer.invoke('app:write', data),
    },

    // ===== 站点管理 API =====
    sites: {
        read: () => ipcRenderer.invoke('sites:read'),
        write: (sites) => ipcRenderer.invoke('sites:write', sites),
        listRepos: () => ipcRenderer.invoke('sites:list-repos'),
        deleteRepo: (repoId) => ipcRenderer.invoke('sites:delete-repo', repoId),
    },

    // IPC 通信桥
    send: (channel, data) => ipcRenderer.send(channel, data),
    invoke: (channel, data) => ipcRenderer.invoke(channel, data),
    on: (channel, callback) => {
        ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    },
});
