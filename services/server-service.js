// YolongCMS — 服务器通信服务
// 与 api.yolongtec.com 通信，拉取留言等
const http = require('http');
const https = require('https');

const DEFAULT_SERVER = 'https://api.yolongtec.com';

/**
 * 拉取站点留言列表
 * @param {string} serverUrl - 服务器地址，默认 api.yolongtec.com
 * @param {string} siteId - 站点 ID
 * @returns {{ success: boolean, messages?: Array, error?: string }}
 */
async function fetchMessages(serverUrl, siteId) {
    const baseUrl = (serverUrl || DEFAULT_SERVER).replace(/\/+$/, '');
    const url = `${baseUrl}/api/messages/${siteId}`;

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
 * 服务器健康检查
 * @param {string} serverUrl
 * @returns {{ success: boolean, error?: string }}
 */
async function healthCheck(serverUrl) {
    const baseUrl = (serverUrl || DEFAULT_SERVER).replace(/\/+$/, '');
    const url = `${baseUrl}/health`;

    try {
        await httpsGet(url);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message || '服务器不可达' };
    }
}

function httpsGet(url) {
    return new Promise((resolve, reject) => {
        const mod = url.startsWith('https') ? https : http;
        const req = mod.get(url, { timeout: 10000 }, (res) => {
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
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
    });
}

module.exports = { fetchMessages, healthCheck };
