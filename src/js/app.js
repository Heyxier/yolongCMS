// YolongCMS Desktop — App 主逻辑
(function () {
    'use strict';

    // ===== 页面注册 =====
    // 每个页面对应 src/pages/{page}.html，内容会被加载到 #content
    const PAGES = {
        dashboard:  { title: '仪表盘',   icon: '📊' },
        products:   { title: '产品',     icon: '📦' },
        articles:   { title: '文章',     icon: '📝' },
        categories: { title: '分类',     icon: '🏷️' },
        images:     { title: '图片',     icon: '🖼️' },
        messages:   { title: '留言',     icon: '✉️' },
        publish:    { title: '发布',     icon: '🚀' },
        sites:      { title: '站点管理', icon: '📁' },
    };

    // ===== 元素引用 =====
    const $sidebar   = document.getElementById('sidebar');
    const $content   = document.getElementById('content');
    const $navItems  = document.querySelectorAll('.nav-item[data-page]');
    const $siteLabel = document.getElementById('currentSite');

    // ===== 当前状态 =====
    let currentPage = 'dashboard';
    let currentSite = null;  // { id, name, repo, branch, server }

    // ===== 加载页面 =====
    async function loadPage(pageId) {
        const page = PAGES[pageId];
        if (!page) return;

        currentPage = pageId;

        // 高亮导航
        $navItems.forEach(el => el.classList.toggle('active', el.dataset.page === pageId));

        try {
            const resp = await fetch(`pages/${pageId}.html`);
            if (!resp.ok) throw new Error('Not found');
            const html = await resp.text();
            $content.innerHTML = html;

            // 触发页面初始化（如果存在）
            if (window[`init_${pageId}`]) {
                window[`init_${pageId}`]();
            }
        } catch {
            // fallback: 占位提示
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

    // ===== 初始化 =====
    function init() {
        // 绑定导航点击
        $navItems.forEach(el => el.addEventListener('click', handleNavClick));

        // 默认页面
        loadPage('dashboard');
    }

    // 等 DOM 就绪
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
