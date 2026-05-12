// YolongCMS Desktop — Electron Main Process
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const simpleGit = require('simple-git');

// 服务层
const gitService = require('../services/git-service');
const mdService = require('../services/md-service');
const ymlService = require('../services/yml-service');
const serverService = require('../services/server-service');
const logService = require('../services/log-service');

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
        logService.append('info', 'sites', '站点列表已更新', { count: sites.length });
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
        logService.append('info', 'sites', '已删除本地仓库', { repoId });
        return true;
    });

    // 克隆站点 Git 仓库到本地
    ipcMain.handle('sites:clone-repo', async (_event, { repoUrl, siteId, branch }) => {
        const targetDir = path.join(__dirname, '..', 'repos', siteId);
        ensureDir(path.dirname(targetDir));
        if (fs.existsSync(targetDir)) {
            // 目录已存在 → 视为已克隆，返回成功
            logService.append('info', 'sites', '仓库已存在，跳过克隆', { siteId, path: targetDir });
            return { success: true, path: targetDir, existing: true };
        }
        try {
            const git = simpleGit();
            await git.clone(repoUrl, targetDir, ['--branch', branch || 'main']);
            logService.append('info', 'git', '仓库克隆成功', { siteId, repoUrl, branch: branch || 'main' });
            return { success: true, path: targetDir };
        } catch (err) {
            logService.append('error', 'git', '仓库克隆失败: ' + (err.message || '未知错误'), { siteId, repoUrl, error: err.message });
            return { success: false, error: err.message || '克隆失败' };
        }
    });

    // ===== Git 服务 =====
    ipcMain.handle('git:pull', async (_event, repoDir) => {
        const fullPath = path.join(REPOS_DIR, repoDir);
        const result = await gitService.pull(fullPath);
        if (result.success) logService.append('info', 'git', '拉取成功', { repoDir });
        else logService.append('warn', 'git', '拉取失败: ' + result.error, { repoDir, error: result.error });
        return result;
    });
    ipcMain.handle('git:status', async (_event, repoDir) => {
        const fullPath = path.join(REPOS_DIR, repoDir);
        return await gitService.status(fullPath);
    });
    ipcMain.handle('git:commit', async (_event, repoDir, message) => {
        const fullPath = path.join(REPOS_DIR, repoDir);
        const result = await gitService.commit(fullPath, message);
        if (result.success) logService.append('info', 'git', '提交成功', { repoDir, message, hash: result.commitHash });
        else logService.append('error', 'git', '提交失败: ' + result.error, { repoDir, message, error: result.error });
        return result;
    });
    ipcMain.handle('git:push', async (_event, repoDir) => {
        const fullPath = path.join(REPOS_DIR, repoDir);
        const result = await gitService.push(fullPath);
        if (result.success) logService.append('info', 'git', '推送成功', { repoDir });
        else logService.append('error', 'git', '推送失败: ' + result.error, { repoDir, error: result.error });
        return result;
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

    // ===== 日志服务 =====
    ipcMain.handle('log:append', (_event, level, source, message, details) => {
        return logService.append(level, source, message, details);
    });
    ipcMain.handle('log:list', (_event, filter) => {
        return logService.list(filter);
    });
    ipcMain.handle('log:clear', () => {
        logService.append('info', 'system', '日志已清空');
        return logService.clear();
    });

    // ===== 产品管理 =====
    ipcMain.handle('products:list', (_event, siteId) => {
        const dir = path.join(REPOS_DIR, siteId, '_products');
        return mdService.list(dir);
    });
    ipcMain.handle('products:read', (_event, siteId, filename) => {
        const filePath = path.join(REPOS_DIR, siteId, '_products', filename);
        return mdService.read(filePath);
    });
    ipcMain.handle('products:write', (_event, siteId, filename, data, content) => {
        const filePath = path.join(REPOS_DIR, siteId, '_products', filename);
        return mdService.write(filePath, data, content);
    });
    ipcMain.handle('products:remove', (_event, siteId, filename) => {
        const filePath = path.join(REPOS_DIR, siteId, '_products', filename);
        mdService.remove(filePath);
        logService.append('info', 'sites', '产品已删除', { siteId, filename });
        return { success: true };
    });

    // ===== 产品 Excel 导入导出 =====
    const XLSX = require('xlsx');

    // 模板列定义
    const TEMPLATE_COLS = [
        { key: 'model',      title: '型号*',       width: 18 },
        { key: 'name',       title: '名称*',       width: 30 },
        { key: 'category',   title: '分类*',       width: 14 },
        { key: 'voltage',    title: '电压',        width: 10 },
        { key: 'torque',     title: '扭矩',        width: 12 },
        { key: 'motorType',  title: '电机类型',    width: 12 },
        { key: 'image',      title: '图片路径',    width: 30 },
        { key: 'description',title: '简介描述',    width: 25 },
        { key: 'features',   title: '特性(|分隔)', width: 30 },
        { key: 'accessories',title: '配件(|分隔)', width: 30 },
        { key: 'status',     title: '上架',         width: 8 },
    ];

    // 示例数据
    const TEMPLATE_EXAMPLE = {
        model: 'ZPT-CD-12252',
        name: '12V 25Nm Drill Driver',
        category: 'drill',
        voltage: '12V',
        torque: '25 N·m',
        motorType: 'brushed',
        image: '/images/products/drill/ZPT-CD-12252.jpg',
        description: 'Compact design, ideal for home and professional use',
        features: 'Two-speed gearbox|Auto spindle lock|LED work light',
        accessories: '2pc 2.0Ah Battery|1pc Quick Charger',
        status: 'TRUE',
    };

    function generateTemplateBuffer() {
        const wb = XLSX.utils.book_new();

        // 说明页
        const notes = [
            ['YolongCMS 产品批量导入模板'],
            [''],
            ['填写说明：'],
            ['  1. 标 * 的列为必填，不可为空'],
            ['  2. "特性"和"配件"如有多个值，用 | (竖线) 分隔'],
            ['  3. "上架"列填 TRUE 或 FALSE（不填默认为 TRUE）'],
            ['  4. "电机类型"填 brushed(有刷) 或 brushless(无刷)'],
            ['  5. 请勿修改列标题行'],
            [''],
            ['如有问题，请查阅产品管理 → 帮助文档'],
        ];
        const wsNotes = XLSX.utils.aoa_to_sheet(notes);
        XLSX.utils.book_append_sheet(wb, wsNotes, '说明');

        // 数据列 + 示例行
        const header = TEMPLATE_COLS.map(c => c.title);
        const exampleRow = TEMPLATE_COLS.map(c => TEMPLATE_EXAMPLE[c.key]);
        const data = [header, exampleRow];
        const wsData = XLSX.utils.aoa_to_sheet(data);

        // 设置列宽
        wsData['!cols'] = TEMPLATE_COLS.map(c => ({ wch: c.width }));

        XLSX.utils.book_append_sheet(wb, wsData, '产品数据');
        return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    }

    ipcMain.handle('products:export-template', async () => {
        const buffer = generateTemplateBuffer();
        const result = await dialog.showSaveDialog(mainWindow, {
            title: '保存导入模板',
            defaultPath: 'yolongcms-产品导入模板.xlsx',
            filters: [{ name: 'Excel 文件', extensions: ['xlsx'] }],
        });
        if (result.canceled || !result.filePath) {
            return { success: false, canceled: true };
        }
        fs.writeFileSync(result.filePath, buffer);
        logService.append('info', 'sites', '已下载产品导入模板', { path: result.filePath });
        return { success: true, path: result.filePath };
    });

    ipcMain.handle('products:import-excel', async (_event, siteId) => {
        const result = await dialog.showOpenDialog(mainWindow, {
            title: '选择产品导入文件',
            properties: ['openFile'],
            filters: [{ name: 'Excel 文件', extensions: ['xlsx', 'xls'] }],
        });
        if (result.canceled || !result.filePaths.length) {
            return { success: false, canceled: true };
        }

        const filePath = result.filePaths[0];
        const wb = XLSX.readFile(filePath);

        // 读取第一个数据表（跳过"说明"表）
        let sheetName = null;
        wb.SheetNames.forEach(name => {
            if (name !== '说明' && !sheetName) sheetName = name;
        });
        if (!sheetName) return { success: false, error: '未找到数据表' };

        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rows || rows.length === 0) {
            return { success: false, error: '导入文件为空' };
        }

        const results = { success: 0, failed: 0, errors: [] };
        const productsDir = path.join(REPOS_DIR, siteId, '_products');

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 2; // +2 because header is row 1, data starts at row 2

            try {
                const model = String(row['型号*'] || row['型号'] || '').trim();
                const name = String(row['名称*'] || row['名称'] || '').trim();
                const category = String(row['分类*'] || row['分类'] || '').trim();

                // 校验必填
                if (!model) { results.failed++; results.errors.push(`第${rowNum}行: 型号为空`); continue; }
                if (!name) { results.failed++; results.errors.push(`第${rowNum}行: 名称为空`); continue; }
                if (!category) { results.failed++; results.errors.push(`第${rowNum}行: 分类为空`); continue; }

                // 解析字段
                const data = {
                    model,
                    name,
                    category,
                    voltage: String(row['电压'] || '').trim(),
                    torque: String(row['扭矩'] || '').trim(),
                    motorType: row['电机类型'] ? String(row['电机类型']).trim().toLowerCase() : '',
                    image: String(row['图片路径'] || row['image'] || '').trim(),
                    description: String(row['简介描述'] || row['description'] || '').trim(),
                    features: [],
                    accessories: [],
                    status: true,
                };

                // 解析竖线分隔
                const feats = String(row['特性(|分隔)'] || row['特性'] || row['features'] || '').trim();
                if (feats) data.features = feats.split('|').map(s => s.trim()).filter(Boolean);

                const accs = String(row['配件(|分隔)'] || row['配件'] || row['accessories'] || '').trim();
                if (accs) data.accessories = accs.split('|').map(s => s.trim()).filter(Boolean);

                // 状态
                const statusVal = String(row['上架'] || 'TRUE').trim().toUpperCase();
                data.status = statusVal !== 'FALSE' && statusVal !== '0';

                // 写文件
                const filename = model + '.md';
                const filePath = path.join(productsDir, filename);
                ensureDir(productsDir);

                // 检查重名
                if (fs.existsSync(filePath)) {
                    results.failed++;
                    results.errors.push(`第${rowNum}行: 型号 "${model}" 已存在，跳过`);
                    continue;
                }

                const md = grayMatter.stringify('', data);
                fs.writeFileSync(filePath, md, 'utf-8');
                results.success++;
            } catch (err) {
                results.failed++;
                results.errors.push(`第${rowNum}行: ${err.message}`);
            }
        }

        logService.append('info', 'sites',
            `批量导入完成: ${results.success} 成功, ${results.failed} 失败`,
            { siteId, file: filePath, ...results });

        return { success: true, ...results };
    });

    // ===== 文章管理（同产品结构） =====
    ipcMain.handle('articles:list', (_event, siteId) => {
        const dir = path.join(REPOS_DIR, siteId, '_articles');
        return mdService.list(dir);
    });
    ipcMain.handle('articles:read', (_event, siteId, filename) => {
        const filePath = path.join(REPOS_DIR, siteId, '_articles', filename);
        return mdService.read(filePath);
    });
    ipcMain.handle('articles:write', (_event, siteId, filename, data, content) => {
        const filePath = path.join(REPOS_DIR, siteId, '_articles', filename);
        return mdService.write(filePath, data, content);
    });
    ipcMain.handle('articles:remove', (_event, siteId, filename) => {
        const filePath = path.join(REPOS_DIR, siteId, '_articles', filename);
        mdService.remove(filePath);
        logService.append('info', 'sites', '文章已删除', { siteId, filename });
        return { success: true };
    });

    // ===== 图片管理 =====
    const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico'];

    function listImageFiles(dir) {
        ensureDir(dir);
        const items = fs.readdirSync(dir, { withFileTypes: true });
        const files = [];
        const subdirs = [];
        items.forEach(item => {
            const fullPath = path.join(dir, item.name);
            if (item.isDirectory()) {
                subdirs.push({ name: item.name, path: fullPath });
            } else if (item.isFile()) {
                const ext = path.extname(item.name).toLowerCase();
                if (IMAGE_EXT.includes(ext)) {
                    const stat = fs.statSync(fullPath);
                    files.push({
                        name: item.name,
                        size: stat.size,
                        mtime: stat.mtimeMs,
                        filePath: fullPath,
                    });
                }
            }
        });
        return { success: true, files, subdirs };
    }

    ipcMain.handle('images:list', (_event, siteId, subDir) => {
        const dir = path.join(REPOS_DIR, siteId, 'images', subDir || '');
        return listImageFiles(dir);
    });

    ipcMain.handle('images:upload', async (_event, siteId, subDir) => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile', 'multiSelections'],
            filters: [
                { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico'] },
                { name: '所有文件', extensions: ['*'] },
            ],
        });
        if (result.canceled || !result.filePaths.length) {
            return { success: false, canceled: true };
        }

        const destDir = path.join(REPOS_DIR, siteId, 'images', subDir || '');
        ensureDir(destDir);

        const uploaded = [];
        for (const srcPath of result.filePaths) {
            const filename = path.basename(srcPath);
            const destPath = path.join(destDir, filename);
            fs.copyFileSync(srcPath, destPath);
            uploaded.push({ filename, path: path.posix.join('images', subDir || '', filename) });
        }

        logService.append('info', 'sites', '已上传 ' + uploaded.length + ' 张图片', { siteId, dir: subDir, files: uploaded.map(f => f.filename) });
        return { success: true, files: uploaded };
    });

    ipcMain.handle('images:mkdir', (_event, siteId, subDir) => {
        const dir = path.join(REPOS_DIR, siteId, 'images', subDir || '');
        ensureDir(dir);
        logService.append('info', 'sites', '已创建图片目录', { siteId, dir: subDir });
        return { success: true };
    });

    ipcMain.handle('images:remove', (_event, siteId, relPath) => {
        const filePath = path.join(REPOS_DIR, siteId, relPath);
        if (fs.existsSync(filePath)) {
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
                fs.rmSync(filePath, { recursive: true, force: true });
            } else {
                fs.unlinkSync(filePath);
            }
        }
        logService.append('info', 'sites', '已删除图片资源', { siteId, path: relPath });
        return { success: true };
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
    // 自动打开开发者工具（方便排查问题）
    mainWindow.webContents.openDevTools();
    logService.append('info', 'system', 'YolongCMS 桌面应用已启动', { version: app.getVersion() || 'dev' });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
