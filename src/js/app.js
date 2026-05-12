// YolongCMS Desktop — App 主逻辑 (Card 3: 站点上下文)
(function () {
    'use strict';

    // ===== 页面注册 =====
    const PAGES = {
        dashboard:  { title: '仪表盘',   icon: '📊' },
        products:   { title: '产品',     icon: '📦' },
        articles:   { title: '文章',     icon: '📝' },
        categories: { title: '分类',     icon: '🏷️' },
        images:     { title: '图片',     icon: '🖼️' },
        messages:   { title: '留言',     icon: '✉️' },
        publish:    { title: '发布',     icon: '🚀' },
        logs:       { title: '日志',     icon: '📋' },
        sites:      { title: '站点管理', icon: '📁' },
        settings:   { title: '设置',     icon: '⚙️' },
    };

    // ===== 元素引用 =====
    const $sidebar   = document.getElementById('sidebar');
    const $content   = document.getElementById('content');
    const $navItems  = document.querySelectorAll('.nav-item[data-page]');
    const $siteBtn   = document.getElementById('siteSelector');
    const $siteLabel = document.getElementById('currentSite');
    const $siteDropdown = document.getElementById('siteDropdown');

    // ===== 当前状态 =====
    let currentPage = 'dashboard';
    let currentSite = null;  // { id, name, repo, branch, server } | null
    let allSites = [];       // 完整站点列表

    // ===== 工具函数 =====
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ===== 加载站点列表 =====
    async function loadSites() {
        if (window.yolongcms && window.yolongcms.sites) {
            allSites = await window.yolongcms.sites.read();
        } else {
            allSites = [];
        }
        return allSites;
    }

    // ===== 加载应用状态 =====
    async function loadAppState() {
        if (window.yolongcms && window.yolongcms.app) {
            return await window.yolongcms.app.read();
        }
        return { activeSiteId: null };
    }

    // ===== 保存应用状态 =====
    async function saveAppState() {
        if (window.yolongcms && window.yolongcms.app && currentSite) {
            await window.yolongcms.app.write({
                activeSiteId: currentSite.id,
            });
        }
    }

    // ===== 设置当前站点 =====
    async function setCurrentSite(siteId) {
        // 查找站点
        const site = allSites.find(s => s.id === siteId);
        if (!site) {
            // 站点不存在或已删除 → 清空
            currentSite = null;
            updateTopbar();
            if (window.yolongcms && window.yolongcms.app) {
                await window.yolongcms.app.write({ activeSiteId: null });
            }
            window.dispatchEvent(new CustomEvent('siteChanged', { detail: { site: null } }));
            return;
        }

        currentSite = site;
        updateTopbar();
        renderDropdown();
        await saveAppState();

        // 通知所有页面站点已切换
        window.dispatchEvent(new CustomEvent('siteChanged', { detail: { site } }));
    }

    // ===== 刷新站点列表（从文件重新读取） =====
    async function refreshSites() {
        await loadSites();
        // 如果当前选中的站点已被删除，清空选择
        if (currentSite && !allSites.some(s => s.id === currentSite.id)) {
            currentSite = null;
            if (window.yolongcms && window.yolongcms.app) {
                await window.yolongcms.app.write({ activeSiteId: null });
            }
        }
        updateTopbar();
        renderDropdown();
    }

    // ===== 更新顶部栏 =====
    function updateTopbar() {
        if (currentSite) {
            $siteLabel.textContent = escapeHtml(currentSite.name) + '  ▾';
            $siteBtn.classList.remove('no-site');
        } else if (allSites.length > 0) {
            $siteLabel.textContent = '请选择站点  ▾';
            $siteBtn.classList.remove('no-site');
        } else {
            $siteLabel.textContent = '未选择站点';
            $siteBtn.classList.add('no-site');
        }
    }

    // ===== 渲染下拉菜单 =====
    function renderDropdown() {
        if (!allSites.length) {
            $siteDropdown.innerHTML = '<div class="dropdown-item disabled">暂无站点</div>';
            return;
        }

        let html = '';
        allSites.forEach(site => {
            const active = currentSite && currentSite.id === site.id;
            html += `
                <div class="dropdown-item ${active ? 'active' : ''}" data-site-id="${escapeHtml(site.id)}">
                    ${active ? '● ' : '○ '}${escapeHtml(site.name)}
                    <span class="dropdown-item-id">${escapeHtml(site.id)}</span>
                </div>
            `;
        });

        // 分隔线 + 站点管理入口
        html += '<div class="dropdown-divider"></div>';
        html += '<div class="dropdown-item manage-link" data-page="sites">📁 站点管理</div>';

        $siteDropdown.innerHTML = html;

        // 绑定点击事件
        $siteDropdown.querySelectorAll('[data-site-id]').forEach(el => {
            el.addEventListener('click', async (e) => {
                e.stopPropagation();
                const siteId = el.dataset.siteId;
                await setCurrentSite(siteId);
                closeDropdown();
            });
        });

        // 站点管理入口
        const manageLink = $siteDropdown.querySelector('.manage-link');
        if (manageLink) {
            manageLink.addEventListener('click', (e) => {
                e.stopPropagation();
                closeDropdown();
                loadPage('sites');
            });
        }
    }

    // ===== 下拉菜单开关 =====
    function toggleDropdown(e) {
        if (allSites.length === 0) return;
        e.stopPropagation();
        const isOpen = $siteDropdown.classList.contains('open');
        if (isOpen) {
            closeDropdown();
        } else {
            renderDropdown();
            $siteDropdown.classList.add('open');
        }
    }

    function closeDropdown() {
        $siteDropdown.classList.remove('open');
    }

    // 点击页面其他地方关闭下拉
    document.addEventListener('click', (e) => {
        if (!$siteDropdown.contains(e.target) && e.target !== $siteBtn && !$siteBtn.contains(e.target)) {
            closeDropdown();
        }
    });

    // ===== 加载页面 =====
    async function loadPage(pageId) {
        const page = PAGES[pageId];
        if (!page) return;

        currentPage = pageId;
        closeDropdown();

        // 高亮导航
        $navItems.forEach(el => el.classList.toggle('active', el.dataset.page === pageId));

        try {
            const resp = await fetch(`pages/${pageId}.html`);
            if (!resp.ok) throw new Error('Not found');
            const html = await resp.text();
            $content.innerHTML = html;

            // 触发页面初始化
            if (window[`init_${pageId}`]) {
                window[`init_${pageId}`]();
            }
        } catch {
            // fallback
            $content.innerHTML = `
                <div class="page-placeholder">
                    <div class="placeholder-icon">${page.icon}</div>
                    <h2>${page.title}</h2>
                    <p>此模块正在开发中</p>
                </div>
            `;
        }
    }

    // ===== 导航点击 =====
    function handleNavClick(e) {
        const item = e.currentTarget;
        const page = item.dataset.page;
        if (page) loadPage(page);
    }

    // ===== 服务器状态检测 =====
    let healthCheckTimer = null;

    async function checkServerStatus() {
        const $statusDot = document.querySelector('.status-dot');
        const $statusText = document.querySelector('.status-text');
        if (!$statusDot) return;

        if (window.yolongcms && window.yolongcms.server) {
            const result = await window.yolongcms.server.health();
            if (result.success) {
                $statusDot.className = 'status-dot online';
                if ($statusText) $statusText.textContent = '服务器在线';
            } else {
                $statusDot.className = 'status-dot offline';
                if ($statusText) $statusText.textContent = '服务器离线';
                // 首次启动时记录一次离线（不每次写日志）
                if (!window._serverLoggedOffline) {
                    window.yolongcms.log.append('warn', 'server', '服务器不可达: ' + (result.error || '未知'));
                    window._serverLoggedOffline = true;
                }
            }
        } else {
            $statusDot.className = 'status-dot offline';
            if ($statusText) $statusText.textContent = '服务器离线';
        }
    }

    // ===== 暴露给其他模块的 API =====
    // sites.js 等可以通过 window.__app 访问
    window.__app = {
        setCurrentSite,
        refreshSites,
        getCurrentSite: () => currentSite,
        getAllSites: () => allSites,
        loadPage,
    };

    // ===== 初始化 =====
    async function init() {
        // 绑定导航点击
        $navItems.forEach(el => el.addEventListener('click', handleNavClick));

        // 顶部站点选择器点击
        if ($siteBtn) {
            $siteBtn.addEventListener('click', toggleDropdown);
        }

        // 设置按钮（顶部栏右侧齿轮）
        const $settingsBtn = document.getElementById('btnSettings');
        if ($settingsBtn) {
            $settingsBtn.addEventListener('click', () => loadPage('settings'));
        }

        // 加载数据
        await loadSites();
        const appState = await loadAppState();

        // 检查首次启动 — 未配置则跳转到设置向导
        let needsSetup = false;
        try {
            if (window.yolongcms && window.yolongcms.config) {
                const config = await window.yolongcms.config.read();
                needsSetup = !config || !config.setupComplete;
            }
        } catch {
            needsSetup = false;
        }

        // 恢复选中的站点
        if (!needsSetup && appState.activeSiteId) {
            const site = allSites.find(s => s.id === appState.activeSiteId);
            if (site) {
                currentSite = site;
            }
        }

        updateTopbar();
        renderDropdown();

        // 检测服务器状态
        checkServerStatus();
        healthCheckTimer = setInterval(checkServerStatus, 60000);

        // 默认页面：首次启动 → 设置向导，否则 → 仪表盘
        if (needsSetup) {
            loadPage('settings');
        } else {
            loadPage('dashboard');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
