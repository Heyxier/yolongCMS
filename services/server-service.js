// YolongCMS — 服务器通信服务
// 与服务器通信，拉取/删除留言等
// 使用 HTTP + HMAC 签名（因为 api.yolongtec.com 域名未在阿里云 ICP 备案，直接用 IP 直连）
const http = require('http');
const crypto = require('crypto');
const TOKEN = 'yolong-admin-2026';           // HMAC 密钥
const SERVER = 'http://47.100.81.126';   // 通过 Nginx 80 端口反代到后端 8123（域名 ICP 拦截 + 8123 被墙）

/**
 * 生成 HMAC-SHA256 签名
 * @param {string} method  - HTTP 方法 (GET/POST/DELETE)
 * @param {string} path    - API 路径 (不含 query)
 * @param {number} ts      - Unix 时间戳
 * @returns {string} hex 签名
 */
function sign(method, path, ts) {
    const msg = `${method}:${path}:${ts}`;
    return crypto.createHmac('sha256', TOKEN).update(msg).digest('hex');
}

/**
 * 构建带 HMAC 签名的 URL
 * @param {string} serverUrl - 服务器地址
 * @param {string} method    - HTTP 方法
 * @param {string} path      - API 路径
 * @returns {string} 完整 URL
 */
function buildUrl(serverUrl, method, path) {
    const base = (serverUrl || SERVER).replace(/\/+$/, '');
    const ts = Math.floor(Date.now() / 1000);
    const sig = sign(method, path, ts);
    return `${base}${path}?t=${ts}&sig=${sig}`;
}

/**
 * HTTP GET
 */
function httpGet(url, timeout = 15000) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 80,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            agent: false,   // 禁用 keep-alive 连接池
            timeout,
        };
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        });
        req.setTimeout(timeout, () => {
            req.destroy();
            reject(new Error('请求超时'));
        });
        req.on('error', reject);
        req.end();
    });
}

/**
 * HTTP DELETE
 */
function httpDelete(url, timeout = 15000) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 80,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'DELETE',
            agent: false,
            timeout,
        };
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        });
        req.setTimeout(timeout, () => {
            req.destroy();
            reject(new Error('请求超时'));
        });
        req.on('error', reject);
        req.end();
    });
}

// ===== 公开 API =====

/**
 * 拉取站点留言列表
 */
async function fetchMessages(serverUrl, siteId, _tokenIgnored) {
    const url = buildUrl(serverUrl, 'GET', `/api/messages/${siteId}`);
    try {
        const data = await httpGet(url);
        const parsed = JSON.parse(data);
        return {
            success: true,
            messages: parsed.items || [],
            total: parsed.total || 0,
        };
    } catch (err) {
        return { success: false, error: err.message || '拉取留言失败' };
    }
}

/**
 * 删除单条留言
 */
async function deleteMessage(serverUrl, msgId, _tokenIgnored) {
    const url = buildUrl(serverUrl, 'DELETE', `/api/messages/${msgId}`);
    try {
        await httpDelete(url);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message || '删除留言失败' };
    }
}

/**
 * 服务器健康检查
 */
async function healthCheck(serverUrl, timeout = 15000, retries = 2, _tokenIgnored) {
    const url = buildUrl(serverUrl, 'GET', '/health');
    for (let i = 0; i <= retries; i++) {
        try {
            await httpGet(url, timeout);
            return { success: true };
        } catch (err) {
            if (i < retries) {
                await new Promise(r => setTimeout(r, 1000));
                continue;
            }
            return { success: false, error: err.message || '服务器不可达' };
        }
    }
    return { success: false, error: '健康检查异常' };
}

module.exports = { fetchMessages, deleteMessage, healthCheck };
