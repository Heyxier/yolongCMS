// YolongCMS Desktop — Electron Main Process
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// ===== 路径常量 =====
const DATA_DIR = path.join(__dirname, '..', 'data');
const SITES_FILE = path.join(DATA_DIR, 'sites.json');
const REPOS_DIR = path.join(__dirname, '..', 'repos');

// ===== 工具函数 =====
function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readSites() {
    ensureDir(DATA_DIR);
    if (!fs.existsSync(SITES_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(SITES_FILE, 'utf-8'));
    } catch {
        return [];
    }
}

function writeSites(sites) {
    ensureDir(DATA_DIR);
    fs.writeFileSync(SITES_FILE, JSON.stringify(sites, null, 4), 'utf-8');
}

function listRepos() {
    ensureDir(REPOS_DIR);
    return fs.readdirSync(REPOS_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);
}

function deleteRepo(repoId) {
    const repoPath = path.join(REPOS_DIR, repoId);
    if (fs.existsSync(repoPath)) {
        fs.rmSync(repoPath, { recursive: true, force: true });
    }
}

// ===== IPC Handlers =====
function registerIpcHandlers() {
    // 读取站点列表
    ipcMain.handle('sites:read', () => {
        return readSites();
    });

    // 保存站点列表
    ipcMain.handle('sites:write', (_event, sites) => {
        writeSites(sites);
        return true;
    });

    // 读取本地 repos 目录列表
    ipcMain.handle('sites:list-repos', () => {
        return listRepos();
    });

    // 删除本地 repo 数据
    ipcMain.handle('sites:delete-repo', (_event, repoId) => {
        deleteRepo(repoId);
        return true;
    });
}

let mainWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 600,
        title: 'YolongCMS',
        backgroundColor: '#0f1117',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    mainWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
}

app.whenReady().then(() => {
    registerIpcHandlers();
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
