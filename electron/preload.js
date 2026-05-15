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
        cloneRepo: (repoUrl, siteId, branch) => ipcRenderer.invoke('sites:clone-repo', { repoUrl, siteId, branch }),
        repoPath: (siteId) => ipcRenderer.invoke('sites:repo-path', siteId),
    },

    // ===== Git 服务 =====
    git: {
        pull: (repoDir) => ipcRenderer.invoke('git:pull', repoDir),
        status: (repoDir) => ipcRenderer.invoke('git:status', repoDir),
        commit: (repoDir, message) => ipcRenderer.invoke('git:commit', repoDir, message),
        push: (repoDir) => ipcRenderer.invoke('git:push', repoDir),
        pushAuth: (repoDir) => ipcRenderer.invoke('git:push-auth', repoDir),
        log: (repoDir, maxCount) => ipcRenderer.invoke('git:log', repoDir, maxCount),
    },

    // ===== Markdown 服务 =====
    md: {
        read: (filePath) => ipcRenderer.invoke('md:read', filePath),
        write: (filePath, data, content) => ipcRenderer.invoke('md:write', filePath, data, content),
        list: (dir) => ipcRenderer.invoke('md:list', dir),
        remove: (filePath) => ipcRenderer.invoke('md:remove', filePath),
    },

    // ===== YAML 服务 =====
    yml: {
        read: (filePath) => ipcRenderer.invoke('yml:read', filePath),
        write: (filePath, data) => ipcRenderer.invoke('yml:write', filePath, data),
    },

    // ===== 服务器通信 =====
    server: {
        messages: (serverUrl, siteId, token) => ipcRenderer.invoke('server:messages', serverUrl, siteId, token),
        deleteMessage: (serverUrl, msgId, token) => ipcRenderer.invoke('server:delete-message', serverUrl, msgId, token),
        health: (serverUrl, token) => ipcRenderer.invoke('server:health', serverUrl, token),
    },

    // IPC 通信桥
    send: (channel, data) => ipcRenderer.send(channel, data),
    invoke: (channel, data) => ipcRenderer.invoke(channel, data),
    on: (channel, callback) => {
        ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    },

    // ===== 操作日志 =====
    log: {
        append: (level, source, message, details) => ipcRenderer.invoke('log:append', level, source, message, details),
        list: (filter) => ipcRenderer.invoke('log:list', filter),
        clear: () => ipcRenderer.invoke('log:clear'),
    },

    // ===== 产品管理 =====
    products: {
        list: (siteId) => ipcRenderer.invoke('products:list', siteId),
        read: (siteId, filename) => ipcRenderer.invoke('products:read', siteId, filename),
        write: (siteId, filename, data, content) => ipcRenderer.invoke('products:write', siteId, filename, data, content),
        remove: (siteId, filename) => ipcRenderer.invoke('products:remove', siteId, filename),
        exportTemplate: () => ipcRenderer.invoke('products:export-template'),
        importExcel: (siteId) => ipcRenderer.invoke('products:import-excel', siteId),
    },

    // ===== 文章管理 =====
    articles: {
        list: (siteId) => ipcRenderer.invoke('articles:list', siteId),
        read: (siteId, filename) => ipcRenderer.invoke('articles:read', siteId, filename),
        write: (siteId, filename, data, content) => ipcRenderer.invoke('articles:write', siteId, filename, data, content),
        remove: (siteId, filename) => ipcRenderer.invoke('articles:remove', siteId, filename),
    },

    // ===== 图片管理 =====
    images: {
        list: (siteId, subDir) => ipcRenderer.invoke('images:list', siteId, subDir),
        upload: (siteId, subDir) => ipcRenderer.invoke('images:upload', siteId, subDir),
        mkdir: (siteId, subDir) => ipcRenderer.invoke('images:mkdir', siteId, subDir),
        remove: (siteId, relPath) => ipcRenderer.invoke('images:remove', siteId, relPath),
        checkRefs: (siteId, relPath, isDir) => ipcRenderer.invoke('images:check-refs', siteId, relPath, isDir),
    },

    // ===== 分类管理 =====
    categories: {
        rename: (siteId, oldName, newName) => ipcRenderer.invoke('categories:rename', siteId, oldName, newName),
        read: (siteId) => ipcRenderer.invoke('categories:read', siteId),
        write: (siteId, data) => ipcRenderer.invoke('categories:write', siteId, data),
    },

    // ===== 用户配置 =====
    config: {
        read: () => ipcRenderer.invoke('config:read'),
        write: (data) => ipcRenderer.invoke('config:write', data),
        get: (key) => ipcRenderer.invoke('config:get', key),
        set: (key, value) => ipcRenderer.invoke('config:set', key, value),
        testGithub: (token) => ipcRenderer.invoke('config:test-github', token),
    },

    // ===== 剪贴板 =====
    clipboard: {
        write: (text) => ipcRenderer.invoke('clipboard:write', text),
    },
});
