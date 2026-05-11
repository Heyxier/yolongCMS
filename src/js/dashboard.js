// YolongCMS Desktop — 仪表盘
(function () {
    'use strict';

    const $empty = document.getElementById('dashboardEmpty');
    const $content = document.getElementById('dashboardContent');
    const $subtitle = document.getElementById('dashboardSubtitle');

    // ===== 渲染 =====
    async function render() {
        const app = window.__app;
        const site = app ? app.getCurrentSite() : null;

        $empty.style.display = 'none';
        $content.style.display = 'none';

        if (!site) {
            $empty.style.display = 'flex';
            if ($subtitle) $subtitle.textContent = '请先选择站点';
            return;
        }

        $content.style.display = 'block';
        if ($subtitle) $subtitle.textContent = site.name + ' — 概览';

        // 填充站点信息
        document.getElementById('dashSiteName').textContent = site.name || '—';
        document.getElementById('dashBranch').textContent = site.branch || 'main';
        document.getElementById('dashRepoUrl').textContent = site.repo || '—';
        document.getElementById('dashServerUrl').textContent = site.server || '未配置';

        // 构造 repos 路径
        const repoDir = await getRepoDir(site.id);
        document.getElementById('dashRepoPath').textContent = repoDir || '未克隆';

        if (!repoDir) {
            document.getElementById('dashPending').textContent = '未克隆';
            document.getElementById('dashAheadBehind').textContent = '—';
            document.getElementById('dashLogList').innerHTML = '<div class="log-empty">请先在站点管理中克隆仓库</div>';
            document.getElementById('dashLogCount').textContent = '0 条';
            return;
        }

        // 获取 Git 状态
        if (window.yolongcms && window.yolongcms.git) {
            const [statusResult, logResult] = await Promise.all([
                window.yolongcms.git.status(repoDir),
                window.yolongcms.git.log(repoDir, 5),
            ]);

            // Git 状态
            if (statusResult.success) {
                const totalModified = (statusResult.summary?.modified || 0)
                    + (statusResult.summary?.created || 0)
                    + (statusResult.summary?.deleted || 0);
                document.getElementById('dashPending').textContent = totalModified > 0
                    ? totalModified + ' 个文件'
                    : '🟢 干净';

                const ahead = statusResult.summary?.ahead || 0;
                const behind = statusResult.summary?.behind || 0;
                let abText = '';
                if (ahead > 0 && behind > 0) abText = '↑' + ahead + ' ↓' + behind;
                else if (ahead > 0) abText = '↑' + ahead + ' 待推送';
                else if (behind > 0) abText = '↓' + behind + ' 待拉取';
                else abText = '🟢 同步';
                document.getElementById('dashAheadBehind').textContent = abText;
            } else {
                document.getElementById('dashPending').textContent = '状态获取失败';
                document.getElementById('dashAheadBehind').textContent = '—';
            }

            // 提交记录
            if (logResult.success && logResult.entries?.length) {
                document.getElementById('dashLogCount').textContent = logResult.entries.length + ' 条';
                let html = '';
                logResult.entries.forEach(entry => {
                    const shortHash = entry.hash.substring(0, 7);
                    const date = formatDate(entry.date);
                    html += `
                        <div class="log-item">
                            <span class="log-hash">${shortHash}</span>
                            <span class="log-msg">${escapeHtml(entry.message)}</span>
                            <span class="log-date">${date}</span>
                        </div>
                    `;
                });
                document.getElementById('dashLogList').innerHTML = html;
            } else {
                document.getElementById('dashLogCount').textContent = '0 条';
                document.getElementById('dashLogList').innerHTML = '<div class="log-empty">暂无提交记录</div>';
            }
        }
    }

    // ===== 获取 repos 路径 =====
    async function getRepoDir(siteId) {
        if (window.yolongcms && window.yolongcms.sites) {
            const repos = await window.yolongcms.sites.listRepos();
            if (repos.includes(siteId)) {
                // 路径由 Electron 主进程决定，renderer 无法直接拼接
                return siteId;
            }
        }
        return null;
    }

    // ===== 工具函数 =====
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hour = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            return month + '-' + day + ' ' + hour + ':' + min;
        } catch {
            return dateStr;
        }
    }

    // ===== 初始化 =====
    window.init_dashboard = async function () {
        await render();

        // 监听站点切换事件（通过定时刷新）
        // 每次显示仪表盘时自动刷新
        const app = window.__app;
        if (app) {
            // 简单的重新渲染触发
            const checkInterval = setInterval(() => {
                const current = app.getCurrentSite();
                const displayed = document.getElementById('dashSiteName')?.textContent;
                if (current && current.name !== displayed) {
                    render();
                }
            }, 2000);
            // 页面切换时清除定时器
            window._dashboardInterval = checkInterval;
        }
    };

    // 离开仪表盘时清除定时器
    const origLoadPage = window.__app?.loadPage;
    if (origLoadPage) {
        const original = window.__app.loadPage;
        window.__app.loadPage = function (pageId) {
            if (window._dashboardInterval) {
                clearInterval(window._dashboardInterval);
                window._dashboardInterval = null;
            }
            original(pageId);
        };
    }
})();
