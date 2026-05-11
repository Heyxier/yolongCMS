// YolongCMS Desktop — 站点管理
(function () {
    'use strict';

    // ===== 数据 =====
    let sites = [];

    // ===== 表单临时缓存（防止切换窗口误关弹窗丢失数据） =====
    let formCache = { name: '', id: '', repo: '', branch: 'main', server: '' };

    // ===== 元素缓存 =====
    let els = {};

    function cacheElements() {
        els.list = document.getElementById('sitesList');
        els.empty = document.getElementById('emptyState');
        els.overlay = document.getElementById('modalOverlay');
        els.btnAdd = document.getElementById('btnAddSite');
        els.btnCleanup = document.getElementById('btnCleanup');
        els.modalClose = document.getElementById('modalClose');
        els.modalCancel = document.getElementById('modalCancel');
        els.modalConfirm = document.getElementById('modalConfirm');
        els.inputName = document.getElementById('inputName');
        els.inputId = document.getElementById('inputId');
        els.inputRepo = document.getElementById('inputRepo');
        els.inputBranch = document.getElementById('inputBranch');
        els.inputServer = document.getElementById('inputServer');
    }

    // ===== 加载数据 =====
    async function loadSites() {
        if (window.yolongcms && window.yolongcms.sites) {
            sites = await window.yolongcms.sites.read();
        }
        render();
    }

    async function saveSites() {
        if (window.yolongcms && window.yolongcms.sites) {
            await window.yolongcms.sites.write(sites);
        }
    }

    // ===== 渲染 =====
    function render() {
        try {
            if (!els.list) { console.warn('[YolongCMS] render: sitesList not found'); return; }
            if (!sites.length) {
                els.list.innerHTML = '';
                if (els.empty) els.empty.style.display = 'flex';
                return;
            }
            if (els.empty) els.empty.style.display = 'none';

            let html = '';
            sites.forEach((site, index) => {
                html += `
                    <div class="site-card">
                        <div class="site-info">
                            <div class="site-name">${escapeHtml(site.name)}</div>
                            <div class="site-meta">
                                <span class="site-tag">${escapeHtml(site.id)}</span>
                                <span class="site-detail">${escapeHtml(site.repo)}</span>
                            </div>
                            <div class="site-meta">
                                <span class="site-server">${escapeHtml(site.server || '未配置 API')}</span>
                                <span class="site-branch">🌿 ${escapeHtml(site.branch || 'main')}</span>
                            </div>
                        </div>
                        <div class="site-actions">
                            <button class="btn btn-danger-outline btn-sm" data-index="${index}" data-action="delete">删除</button>
                        </div>
                    </div>
                `;
            });
            els.list.innerHTML = html;

            // 绑定删除事件
            els.list.querySelectorAll('[data-action="delete"]').forEach(btn => {
                btn.addEventListener('click', () => deleteSite(parseInt(btn.dataset.index)));
            });
        } catch (err) {
            console.error('[YolongCMS] render error:', err);
        }
    }

    // ===== 添加站点 =====
    function openAddModal() {
        // 从缓存恢复表单数据（防止切换窗口误关后丢失）
        els.inputName.value = formCache.name;
        els.inputId.value = formCache.id;
        els.inputRepo.value = formCache.repo;
        els.inputBranch.value = formCache.branch || 'main';
        els.inputServer.value = formCache.server;
        els.overlay.style.display = 'flex';
        setTimeout(() => els.inputName.focus(), 100);
    }

    function closeModal() {
        // 关闭前保存表单数据到缓存（防误关丢数据）
        if (els.inputName) formCache.name = els.inputName.value;
        if (els.inputId) formCache.id = els.inputId.value;
        if (els.inputRepo) formCache.repo = els.inputRepo.value;
        if (els.inputBranch) formCache.branch = els.inputBranch.value;
        if (els.inputServer) formCache.server = els.inputServer.value;
        if (els.overlay) els.overlay.style.display = 'none';
    }

    async function confirmAdd() {
        try {
            const name = els.inputName.value.trim();
            const id = els.inputId.value.trim();
            const repo = els.inputRepo.value.trim();
            const branch = els.inputBranch.value.trim() || 'main';
            const server = els.inputServer.value.trim();

            // 校验
            if (!name) { showToast('请输入站点名称'); return; }
            if (!id) { showToast('请输入站点 ID'); return; }
            if (!/^[a-zA-Z0-9_-]+$/.test(id)) { showToast('站点 ID 只能包含英文、数字、下划线和连字符'); return; }
            if (!repo) { showToast('请输入 GitHub 仓库地址'); return; }

            // 检查 ID 是否已存在
            if (sites.some(s => s.id === id)) {
                showToast('站点 ID "' + id + '" 已存在');
                return;
            }

            sites.push({ id, name, repo, branch, server });
            await saveSites();
            // 添加成功后清除表单缓存
            formCache = { name: '', id: '', repo: '', branch: 'main', server: '' };
            render();
            closeModal();
            showToast('✅ 站点 "' + name + '" 已添加');
        } catch (err) {
            console.error('[YolongCMS] confirmAdd error:', err);
            showToast('❌ 操作失败: ' + (err.message || '未知错误'));
        }
    }

    // ===== 删除站点 =====
    async function deleteSite(index) {
        try {
            const site = sites[index];
            if (!site) return;

            if (!confirm('确认将站点 "' + site.name + '" 移出管理列表？\n\n其本地数据（repos/' + site.id + '/）将被保留。')) {
                return;
            }

            sites.splice(index, 1);
            await saveSites();
            render();
            showToast('已移除站点 "' + site.name + '"，本地数据已保留');
        } catch (err) {
            console.error('[YolongCMS] deleteSite error:', err);
            showToast('❌ 删除失败: ' + (err.message || '未知错误'));
        }
    }

    // ===== 清理站点数据 =====
    async function cleanupData() {
        if (!window.yolongcms || !window.yolongcms.sites) return;

        if (!confirm('将删除 repos/ 目录中不在管理列表内的所有站点本地数据。\n确定继续？')) {
            return;
        }

        const localRepos = await window.yolongcms.sites.listRepos();
        const managedIds = new Set(sites.map(s => s.id));
        const orphaned = localRepos.filter(id => !managedIds.has(id));

        if (!orphaned.length) {
            showToast('没有需要清理的孤立数据');
            return;
        }

        if (!confirm('将删除以下 ' + orphaned.length + ' 个站点的本地数据：\n' + orphaned.join('\n'))) {
            return;
        }

        let deleted = 0;
        for (const repoId of orphaned) {
            await window.yolongcms.sites.deleteRepo(repoId);
            deleted++;
        }

        showToast('✅ 已清理 ' + deleted + ' 个站点的本地数据');
    }

    // ===== 工具函数 =====
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function showToast(msg) {
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.style.cssText = `
                position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%);
                background: var(--bg-secondary); color: var(--text-primary);
                padding: 12px 24px; border-radius: var(--radius-lg);
                border: 1px solid var(--border-color);
                font-size: 14px; z-index: 10000;
                box-shadow: 0 8px 32px rgba(0,0,0,0.4);
                opacity: 0; transition: opacity 0.3s;
                max-width: 500px; text-align: center;
            `;
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.opacity = '1';
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
    }

    // ===== 绑定事件 =====
    function bindEvents() {
        els.btnAdd.addEventListener('click', openAddModal);
        els.btnCleanup.addEventListener('click', cleanupData);
        els.modalClose.addEventListener('click', closeModal);
        els.modalCancel.addEventListener('click', closeModal);
        els.modalConfirm.addEventListener('click', confirmAdd);

        // 点击遮罩关闭
        els.overlay.addEventListener('click', (e) => {
            if (e.target === els.overlay) closeModal();
        });

        // 回车提交
        els.overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') confirmAdd();
            if (e.key === 'Escape') closeModal();
        });

        // ID 输入时自动转为小写连字符格式
        els.inputId.addEventListener('input', () => {
            els.inputId.value = els.inputId.value.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
        });
    }

    // ===== 初始化 =====
    window.init_sites = async function () {
        cacheElements();
        bindEvents();
        await loadSites();
    };
})();
