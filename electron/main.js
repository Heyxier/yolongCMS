// YolongCMS Desktop — Electron Main Process
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const simpleGit = require('simple-git');

// 服务层
const gitService = require('../services/git-service');
const mdService = require('../services/md-service');
const ymlService = require('../services/yml-service');
const serverService = require('../services/server-service');

// ===== 路径常量 =====
const DATA_DIR = path.join(__dirname, '..', 'data');
const SITES_FILE = path.join(DATA_DIR, 'sites.json');
const APP_FILE = path.join(DATA_DIR, 'app.json');
const REPOS_DIR = path.join(__dirname, '..', 'repos');

// ===== 工具函数 =====
function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJSON(file, defaultVal = null) {
    ensureDir(path.dirname(file));
    if (!fs.existsSync(file)) return defaultVal;
    try { return JSON.parse(fs.readFileSync(file, 'utf-8')); }
    catch { return defaultVal; }
}

function writeJSON(file, data) {
    ensureDir(path.dirname(file));
    fs.writeFileSync(file, JSON.stringify(data, null, 4), 'utf-8');
}

function readSites() {
    return readJSON(SITES_FILE, []);
}

function writeSites(sites) {
    writeJSON(SITES_FILE, sites);
}

function readApp() {
    return readJSON(APP_FILE, { activeSiteId: null });
}

function writeApp(data) {
    writeJSON(APP_FILE, data);
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

    // 读取应用状态
    ipcMain.handle('app:read', () => {
        return readApp();
    });

    // 保存应用状态
    ipcMain.handle('app:write', (_event, data) => {
        writeApp(data);
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

    // 克隆站点 Git 仓库到本地
    ipcMain.handle('sites:clone-repo', async (_event, { repoUrl, siteId, branch }) => {
        const targetDir = path.join(__dirname, '..', 'repos', siteId);
        ensureDir(path.dirname(targetDir));
        if (fs.existsSync(targetDir)) {
            return { success: false, error: '目录已存在: ' + targetDir };
        }
        try {
            const git = simpleGit();
            await git.clone(repoUrl, targetDir, ['--branch', branch || 'main']);
            return { success: true, path: targetDir };
        } catch (err) {
            return { success: false, error: err.message || '克隆失败' };
        }
    });

    // ===== Git 服务 =====
    ipcMain.handle('git:pull', async (_event, repoDir) => {
        const fullPath = path.join(REPOS_DIR, repoDir);
        return await gitService.pull(fullPath);
    });
    ipcMain.handle('git:status', async (_event, repoDir) => {
        const fullPath = path.join(REPOS_DIR, repoDir);
        return await gitService.status(fullPath);
    });
    ipcMain.handle('git:commit', async (_event, repoDir, message) => {
        const fullPath = path.join(REPOS_DIR, repoDir);
        return await gitService.commit(fullPath, message);
    });
    ipcMain.handle('git:push', async (_event, repoDir) => {
        const fullPath = path.join(REPOS_DIR, repoDir);
        return await gitService.push(fullPath);
    });
    ipcMain.handle('git:log', async (_event, repoDir, maxCount) => {
        const fullPath = path.join(REPOS_DIR, repoDir);
        return await gitService.log(fullPath, maxCount);
    });

    // ===== Markdown 服务 =====
    ipcMain.handle('md:read', (_event, filePath) => {
        return mdService.read(filePath);
    });
    ipcMain.handle('md:write', (_event, filePath, data, content) => {
        return mdService.write(filePath, data, content);
    });
    ipcMain.handle('md:list', (_event, dir) => {
        return mdService.list(dir);
    });
    ipcMain.handle('md:remove', (_event, filePath) => {
        return mdService.remove(filePath);
    });

    // ===== YAML 服务 =====
    ipcMain.handle('yml:read', (_event, filePath) => {
        return ymlService.read(filePath);
    });
    ipcMain.handle('yml:write', (_event, filePath, data) => {
        return ymlService.write(filePath, data);
    });

    // ===== 服务器通信 =====
    ipcMain.handle('server:messages', async (_event, serverUrl, siteId) => {
        return await serverService.fetchMessages(serverUrl, siteId);
    });
    ipcMain.handle('server:health', async (_event, serverUrl) => {
        return await serverService.healthCheck(serverUrl);
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
