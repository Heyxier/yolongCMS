// YolongCMS — 服务器通信服务
// 与 api.yolongtec.com 通信，拉取/删除留言等
const http = require('http');
const https = require('https');
const dns = require('dns');

// DNS 解析辅助函数（Promise 化）
function dnsLookup(hostname) {
    return new Promise((resolve, reject) => {
        dns.lookup(hostname, { all: true, family: 4 }, (err, addresses) => {
            if (err) reject(err);
            else resolve(addresses[0]?.address || hostname);
        });
    });
}

const DEFAULT_SERVER = 'https://api.yolongtec.com';
const DEFAULT_TOKEN = 'yolong-admin-2026';

/**
 * 构建带 token 的 URL
 */
function buildUrl(serverUrl, path, token) {
    const base = (serverUrl || DEFAULT_SERVER).replace(/\/+$/, '');
    const tk = token || DEFAULT_TOKEN;
    return `${base}${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(tk)}`;
}

/**
 * 拉取站点留言列表
 * @param {string} serverUrl - 服务器地址
 * @param {string} siteId - 站点 ID
 * @param {string} [token] - 管理 token
 * @returns {Promise<{ success: boolean, messages?: Array, total?: number, error?: string }>}
 */
async function fetchMessages(serverUrl, siteId, token) {
    const url = buildUrl(serverUrl, `/api/messages/${siteId}`, token);
    try {
        const data = await httpsGet(url);
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
 * @param {string} serverUrl
 * @param {number} msgId
 * @param {string} [token]
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function deleteMessage(serverUrl, msgId, token) {
    const url = buildUrl(serverUrl, `/api/messages/${msgId}`, token);
    try {
        await httpsDelete(url);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message || '删除留言失败' };
    }
}

/**
 * 服务器健康检查
 * @param {string} serverUrl
 * @param {number} [timeout=15000]
 * @param {number} [retries=2]
 * @param {string} [token]
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function healthCheck(serverUrl, timeout = 15000, retries = 2, token) {
    const url = buildUrl(serverUrl, '/health', token);
    for (let i = 0; i <= retries; i++) {
        try {
            await httpsGet(url, timeout);
            return { success: true };
        } catch (err) {
            if (i < retries) {
                // ECONNRESET 等网络错误等1秒再重试
                await new Promise(r => setTimeout(r, 1000));
                continue;
            }
            return { success: false, error: err.message || '服务器不可达' };
        }
    }
    return { success: false, error: '健康检查异常' };
}

async function httpsGet(url, timeout = 15000) {
    const isHttps = url.startsWith('https');
    const mod = isHttps ? https : http;
    const parsedUrl = new URL(url);
    const originalHost = parsedUrl.hostname;

    // DNS 解析：获取 IP 地址，绕过 SNI 过滤
    let ip = originalHost;
    try {
        ip = await dnsLookup(originalHost);
    } catch (_) { /* 解析失败则使用原始 hostname */ }

    return new Promise((resolve, reject) => {
        const options = {
            hostname: ip,
            servername: originalHost,   // TLS SNI + 证书验证用原始域名
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            agent: false,               // 禁用 keep-alive 连接池
            rejectUnauthorized: true,
            timeout,
        };
        const req = mod.request(options, (res) => {
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

async function httpsDelete(url, timeout = 15000) {
    const isHttps = url.startsWith('https');
    const mod = isHttps ? https : http;
    const parsedUrl = new URL(url);
    const originalHost = parsedUrl.hostname;

    // DNS 解析：获取 IP 地址，绕过 SNI 过滤
    let ip = originalHost;
    try {
        ip = await dnsLookup(originalHost);
    } catch (_) { /* 解析失败则使用原始 hostname */ }

    return new Promise((resolve, reject) => {
        const options = {
            hostname: ip,
            servername: originalHost,   // TLS SNI + 证书验证用原始域名
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'DELETE',
            agent: false,               // 禁用 keep-alive 连接池
            rejectUnauthorized: true,
            timeout,
        };
        const req = mod.request(options, (res) => {
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

module.exports = { fetchMessages, deleteMessage, healthCheck };
