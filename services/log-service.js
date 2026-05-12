// YolongCMS — 操作日志服务
// 记录用户操作、Git 操作、系统事件等
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', 'data', 'logs.json');
const MAX_LOGS = 2000; // 最多保留 2000 条

function ensureFile() {
    const dir = path.dirname(LOG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, '[]', 'utf-8');
}

function readLogs() {
    ensureFile();
    try { return JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8')); }
    catch { return []; }
}

function writeLogs(logs) {
    ensureFile();
    fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2), 'utf-8');
}

/**
 * 追加一条日志
 * @param {'info'|'warn'|'error'} level - 日志级别
 * @param {string} source - 来源（sites / git / server / system / app）
 * @param {string} message - 日志内容
 * @param {object} [details] - 附加数据
 * @returns {object} 新增的日志条目
 */
function append(level, source, message, details) {
    const logs = readLogs();
    const entry = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
        timestamp: new Date().toISOString(),
        level,
        source,
        message,
        details: details || null,
    };
    logs.push(entry);
    // 超出上限时裁剪旧日志
    if (logs.length > MAX_LOGS) logs.splice(0, logs.length - MAX_LOGS);
    writeLogs(logs);
    return entry;
}

/**
 * 查询日志（按时间倒序）
 * @param {object} [filter]
 * @param {string} [filter.level] - 按级别筛选
 * @param {string} [filter.source] - 按来源筛选
 * @param {number} [filter.limit=100] - 最大返回条数
 * @param {number} [filter.offset] - 跳过前 N 条（用于分页）
 * @returns {{ total: number, entries: Array }}
 */
function list(filter) {
    let logs = readLogs();
    const total = logs.length;

    // 筛选
    if (filter) {
        if (filter.level) logs = logs.filter(l => l.level === filter.level);
        if (filter.source) logs = logs.filter(l => l.source === filter.source);
    }

    // 倒序（最新在前）
    logs = logs.reverse();

    // 分页
    const limit = filter?.limit || 100;
    const offset = filter?.offset || 0;
    const entries = logs.slice(offset, offset + limit);

    return { total, entries };
}

/**
 * 清空所有日志
 */
function clear() {
    writeLogs([]);
    return true;
}

module.exports = { append, list, clear };
