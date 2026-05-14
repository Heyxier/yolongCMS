// YolongCMS Desktop — 首页推荐管理
(function () {
    'use strict';

    function escapeHtml(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    function getSite() { const a = window.__app; return a ? a.getCurrentSite() : null; }

    function showToast(m) {
        let t = document.getElementById('toast');
        if (!t) {
            t = document.createElement('div'); t.id = 'toast';
            t.style.cssText = 'position:fixed;bottom:32px;left:50%;transform:translateX(-50%);background:var(--bg-secondary);color:var(--text-primary);padding:12px 24px;border-radius:var(--radius-lg);border:1px solid var(--border-color);font-size:14px;z-index:10000;box-shadow:0 8px 32px rgba(0,0,0,0.4);opacity:0;transition:opacity 0.3s;max-width:500px;text-align:center;';
            document.body.appendChild(t);
        }
        t.textContent = m; t.style.opacity = '1';
        clearTimeout(t._timer); t._timer = setTimeout(() => { t.style.opacity = '0'; }, 3000);
    }

    // ===== 状态 =====
    let featuredItems = [];   // 当前推荐列表
    let allProducts = [];     // 所有产品

    // ===== 加载所有数据 =====
    async function load() {
        const site = getSite();
        const $empty = document.getElementById('featEmpty');
        const $content = document.getElementById('featContent');

        if (!site) {
            $empty.style.display = 'flex';
            $content.style.display = 'none';
            return;
        }
        $empty.style.display = 'none';
        $content.style.display = 'block';

        try {
            // 并行加载
            const [repoPathR, productsR] = await Promise.all([
                window.yolongcms.sites.repoPath(site.id),
                window.yolongcms.products.list(site.id),
            ]);

            // 读取当前推荐列表
            const featuredPath = repoPathR + '/_data/featured.yml';
            const ymlR = await window.yolongcms.yml.read(featuredPath);
            featuredItems = (ymlR.success && ymlR.data && ymlR.data.featured) ? ymlR.data.featured : [];

            // 读取产品列表
            allProducts = (productsR.success && productsR.files) ? productsR.files : [];

            renderProductCheckboxes();
            renderFeaturedList();
        } catch (err) {
            showToast('加载失败: ' + err.message);
        }
    }

    // ===== 渲染产品复选框 =====
    function renderProductCheckboxes() {
        const $list = document.getElementById('featProductList');
        if (!allProducts.length) {
            $list.innerHTML = '<div class="log-empty">暂无产品数据</div>';
            return;
        }

        // 已推荐的产品型号
        const featuredModels = new Set(
            featuredItems.filter(i => i.type === 'product').map(i => i.model)
        );

        let html = '';
        allProducts.forEach(p => {
            const isFeatured = featuredModels.has(p.model);
            html += '<label class="feat-checkbox-row" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:4px;cursor:pointer;' +
                (isFeatured ? 'opacity:0.4;' : '') + '">';
            html += '<input type="checkbox" class="feat-product-cb" value="' + escapeHtml(p.model) + '"' +
                (isFeatured ? ' disabled' : '') + ' style="width:16px;height:16px;">';
            html += '<span style="flex:1;">';
            html += '<strong>' + escapeHtml(p.model) + '</strong>';
            if (p.name) html += ' — ' + escapeHtml(p.name);
            html += '</span>';
            html += (isFeatured ? '<span style="font-size:11px;color:var(--accent-500);">已推荐</span>' : '');
            html += '</label>';
        });

        $list.innerHTML = html;
    }

    // ===== 渲染当前推荐列表 =====
    function renderFeaturedList() {
        const $list = document.getElementById('featList');
        const $count = document.getElementById('featCount');
        const products = featuredItems.filter(i => i.type === 'product');

        $count.textContent = products.length + ' 项';

        if (!products.length) {
            $list.innerHTML = '<div class="log-empty">暂无推荐产品</div>';
            return;
        }

        // 建立 model → name 查询
        const nameMap = {};
        allProducts.forEach(p => { nameMap[p.model] = p.name; });

        let html = '';
        products.forEach((item, idx) => {
            const name = nameMap[item.model] || '';
            html += '<div class="pub-file-row" style="display:flex;align-items:center;gap:8px;">';
            html += '  <span style="flex:1;">';
            html += '    <strong>' + escapeHtml(item.model) + '</strong>';
            if (name) html += ' — ' + escapeHtml(name);
            html += '  </span>';
            if (item.tag) html += '  <span class="pub-file-status status-add">' + escapeHtml(item.tag) + '</span>';
            html += '  <button class="btn btn-danger-outline btn-sm feat-remove-btn" data-idx="' + idx + '">✕</button>';
            html += '</div>';
        });

        $list.innerHTML = html;

        // 绑定删除事件
        $list.querySelectorAll('.feat-remove-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx);
                // 找到实际的产品索引（因为 featuredItems 可能包含 news 等非 product 条目）
                const productItems = featuredItems.filter(i => i.type === 'product');
                const realItem = productItems[idx];
                const realIdx = featuredItems.indexOf(realItem);
                if (realIdx >= 0) {
                    featuredItems.splice(realIdx, 1);
                    saveAndRefresh();
                }
            });
        });
    }

    // ===== 添加推荐 =====
    async function addFeatured() {
        const $checkboxes = document.querySelectorAll('.feat-product-cb:checked');
        const selected = Array.from($checkboxes).map(cb => cb.value);
        if (!selected.length) { showToast('请至少选择一个产品'); return; }

        const tag = document.getElementById('featTag').value.trim();

        // 检查是否重复
        const existingModels = new Set(featuredItems.filter(i => i.type === 'product').map(i => i.model));
        let added = 0;
        selected.forEach(model => {
            if (!existingModels.has(model)) {
                featuredItems.push({ type: 'product', model: model, tag: tag || undefined });
                added++;
            }
        });

        if (!added) { showToast('所选产品已在推荐列表中'); return; }
        await saveAndRefresh();
        showToast('✅ 已添加 ' + added + ' 个推荐产品');
        document.getElementById('featTag').value = '';
    }

    // ===== 清空推荐 =====
    async function clearFeatured() {
        if (featuredItems.length === 0) { showToast('推荐列表已空'); return; }
        if (!confirm('确认清空所有推荐？')) return;
        featuredItems = [];
        await saveAndRefresh();
        showToast('✅ 已清空推荐列表');
    }

    // ===== 预览首页 =====
    function previewHome() {
        const site = getSite();
        if (!site) { showToast('请先选择一个站点'); return; }
        showToast('👁️ 请打开浏览器查看 yolongtec.com 首页 Featured Products 区域');
    }

    // ===== 保存到文件并刷新 =====
    async function saveAndRefresh() {
        const site = getSite();
        if (!site) return;

        try {
            const repoPath = await window.yolongcms.sites.repoPath(site.id);
            const featuredPath = repoPath + '/_data/featured.yml';
            await window.yolongcms.yml.write(featuredPath, { featured: featuredItems });
            renderProductCheckboxes();
            renderFeaturedList();
        } catch (err) {
            showToast('保存失败: ' + err.message);
        }
    }

    // ===== 绑定事件 =====
    function bindEvents() {
        document.getElementById('btnFeatAdd').addEventListener('click', addFeatured);
        document.getElementById('btnFeatClear').addEventListener('click', clearFeatured);
        document.getElementById('btnFeatPreview').addEventListener('click', previewHome);
    }

    // ===== 初始化 =====
    window.init_featured = async function () {
        bindEvents();
        await load();
    };
    window.addEventListener('siteChanged', () => { load(); });
})();
