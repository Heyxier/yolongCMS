// YolongCMS — Git 服务封装
// 基于 simple-git，所有操作在 main process 中执行
const simpleGit = require('simple-git');
const fs = require('fs');
const path = require('path');

/**
 * git pull — 拉取远程最新代码
 * @param {string} repoDir - repos/{siteId} 目录
 * @returns {{ success: boolean, message?: string, error?: string }}
 */
async function pull(repoDir) {
    try {
        const git = simpleGit(repoDir);
        await git.pull();
        return { success: true, message: '拉取成功' };
    } catch (err) {
        return { success: false, error: err.message || '拉取失败' };
    }
}

/**
 * git status — 获取工作区状态
 * @param {string} repoDir
 * @returns {{ success: boolean, files?: Array, summary?: string, error?: string }}
 */
async function status(repoDir) {
    try {
        const git = simpleGit(repoDir);
        const st = await git.status();
        return {
            success: true,
            files: st.files.map(f => ({
                path: f.path,
                status: getStatusLabel(f.working_dir),
                staged: f.index !== ' ',
            })),
            summary: {
                ahead: st.ahead,
                behind: st.behind,
                modified: st.modified.length,
                created: st.created.length,
                deleted: st.deleted.length,
                staged: st.staged.length,
            },
        };
    } catch (err) {
        return { success: false, error: err.message || '获取状态失败' };
    }
}

function getStatusLabel(code) {
    const map = { 'M': '修改', 'A': '新增', 'D': '删除', 'R': '重命名', '?': '未跟踪', ' ': '-' };
    return map[code] || code;
}

/**
 * git add + commit — 暂存并提交
 * @param {string} repoDir
 * @param {string} message - 提交信息
 * @returns {{ success: boolean, commitHash?: string, error?: string }}
 */
async function commit(repoDir, message) {
    try {
        const git = simpleGit(repoDir);
        await git.add('.');
        const result = await git.commit(message);
        return {
            success: true,
            commitHash: result.commit || '',
            summary: result.summary,
        };
    } catch (err) {
        return { success: false, error: err.message || '提交失败' };
    }
}

/**
 * git push — 推送到远程
 * @param {string} repoDir
 * @returns {{ success: boolean, message?: string, error?: string }}
 */
async function push(repoDir) {
    try {
        const git = simpleGit(repoDir);
        await git.push();
        return { success: true, message: '推送成功' };
    } catch (err) {
        return { success: false, error: err.message || '推送失败' };
    }
}

/**
 * git push with GitHub Token — 使用 Personal Access Token 推送
 * 避免 git 提示输入密码导致进程挂起
 * @param {string} repoDir - repos/{siteId} 目录
 * @param {string} token - GitHub Personal Access Token
 * @returns {{ success: boolean, message?: string, error?: string }}
 */
async function pushWithToken(repoDir, token) {
    let git;
    let originalUrl;
    try {
        git = simpleGit(repoDir);
        const remotes = await git.getRemotes(true);
        const origin = remotes.find(r => r.name === 'origin');
        if (!origin) throw new Error('未配置远程仓库 "origin"');

        originalUrl = origin.refs.push || origin.refs.fetch;

        // 提取仓库路径 (user/repo)
        let repoPath = '';
        if (originalUrl.startsWith('https://')) {
            repoPath = originalUrl.replace('https://github.com/', '').replace(/\.git$/, '');
        } else if (originalUrl.startsWith('git@')) {
            repoPath = originalUrl.replace('git@github.com:', '').replace(/\.git$/, '');
        } else {
            throw new Error('不支持的远程仓库协议: ' + originalUrl);
        }

        // GitHub 推荐的 Token 认证格式: https://oauth2:TOKEN@github.com/user/repo.git
        const authUrl = `https://oauth2:${token}@github.com/${repoPath}.git`;
        await git.remote(['set-url', 'origin', authUrl]);

        await git.push();
        return { success: true, message: '推送成功' };
    } catch (err) {
        return { success: false, error: err.message || '推送失败' };
    } finally {
        if (git && originalUrl) {
            try {
                await git.remote(['set-url', 'origin', originalUrl]);
            } catch {
                // 恢复失败不阻断主流程
            }
        }
    }
}

/**
 * git log — 获取提交历史
 * @param {string} repoDir
 * @param {number} [maxCount=20]
 * @returns {{ success: boolean, entries?: Array, error?: string }}
 */
async function log(repoDir, maxCount = 20) {
    try {
        const git = simpleGit(repoDir);
        const result = await git.log({ maxCount });
        return {
            success: true,
            entries: result.all.map(entry => ({
                hash: entry.hash,
                date: entry.date,
                message: entry.message,
                author: entry.author_name,
            })),
        };
    } catch (err) {
        return { success: false, error: err.message || '获取日志失败' };
    }
}

/**
 * git remote set-url — 更新远程仓库地址
 * @param {string} repoDir
 * @param {string} newUrl
 * @returns {{ success: boolean, message?: string, error?: string }}
 */
async function setRemote(repoDir, newUrl) {
    try {
        const git = simpleGit(repoDir);
        await git.remote(['set-url', 'origin', newUrl]);
        return { success: true, message: '远程仓库地址已更新' };
    } catch (err) {
        return { success: false, error: err.message || '更新失败' };
    }
}

module.exports = { pull, status, commit, push, pushWithToken, log, setRemote };
