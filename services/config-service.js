// YolongCMS — 用户配置服务
// 存储用户设置（GitHub Token、偏好等）到 data/config.json
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const DEFAULTS = {
    githubToken: '',
    githubUsername: '',
    defaultSiteId: null,
    setupComplete: false,
    createdAt: null,
    updatedAt: null,
};

/**
 * 读取完整配置（合并默认值）
 */
function readAll() {
    ensureDir(DATA_DIR);
    if (!fs.existsSync(CONFIG_FILE)) {
        return { ...DEFAULTS };
    }
    try {
        const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        return { ...DEFAULTS, ...raw };
    } catch {
        return { ...DEFAULTS };
    }
}

/**
 * 保存完整配置
 */
function writeAll(config) {
    ensureDir(DATA_DIR);
    const now = new Date().toISOString();
    const data = { ...config, updatedAt: now };
    if (!data.createdAt) data.createdAt = now;
    // 敏感字段标记
    const output = { ...data };
    if (output.githubToken) {
        output._tokenHint = output.githubToken.substring(0, 8) + '...' + output.githubToken.slice(-4);
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(output, null, 4), 'utf-8');
    return true;
}

/**
 * 获取单个配置项
 */
function get(key) {
    const config = readAll();
    return config[key] ?? null;
}

/**
 * 设置单个配置项
 */
function set(key, value) {
    const config = readAll();
    config[key] = value;
    writeAll(config);
    return true;
}

/**
 * 检查 GitHub Token 是否已配置
 */
function hasToken() {
    const token = get('githubToken');
    return !!token && token.length > 0;
}

/**
 * 获取完整配置（对外暴露）
 */
module.exports = {
    readAll,
    writeAll,
    get,
    set,
    hasToken,
};
