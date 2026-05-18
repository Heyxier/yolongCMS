// YolongCMS Desktop — 首页推荐管理（中英双语）
(function () {
    'use strict';

    let currentLang = 'en';
    let featuredItems = [];
    let allProducts = [];

    function escapeHtml(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    function getSite() { const a = window.__app; return a ? a.getCurrentSite() : null; }
    function langFile() { return currentLang === 'zh' ? 'zh_featured.yml' : 'featured.yml'; }

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

    function setLang(lang) {
        currentLang = lang;
        document.querySelectorAll('#featContent .lang-tab').forEach(tab => {
            if (tab.dataset.lang === lang) { tab.style.background = 'var(--accent-500)'; tab.style.color = '#fff'; tab.style.fontWeight = '600'; }
            else { tab.style.background = 'transparent'; tab.style.color = 'var(--text-primary)'; tab.style.fontWeight = '500'; }
        });
        load();
    }

    async function load() {
        const site = getSite();
        const $empty = document.getElementById('featEmpty');
        const $content = document.getElementById('featContent');
        if (!site) { $empty.style.display = 'flex'; $content.style.display = 'none'; return; }
        $empty.style.display = 'none'; $content.style.display = 'block';

        try {
            const [repoPathR, productsR] = await Promise.all([
                window.yolongcms.sites.repoPath(site.id),
                window.yolongcms.products.list(site.id),
            ]);
            const ymlR = await window.yolongcms.yml.read(repoPathR + '/_data/' + langFile());
            featuredItems = (ymlR.success && ymlR.data && ymlR.data.featured) ? ymlR.data.featured : [];
            allProducts = (productsR.success && productsR.files) ? productsR.files : [];
            renderProductCheckboxes();
            renderFeaturedList();
            showToast('✅ 已加载 ' + langFile());
        } catch (err) { showToast('加载失败: ' + err.message); }
    }

    function renderProductCheckboxes() {
        const $list = document.getElementById('featProductList');
        if (!allProducts.length) { $list.innerHTML = '<div class="log-empty">暂无产品数据</div>'; return; }
        const featuredModels = new Set(featuredItems.filter(i => i.type === 'product').map(i => i.model));
        let html = '';
        allProducts.forEach(p => {
            const isFeatured = featuredModels.has(p.model);
            html += '<label class="feat-checkbox-row" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:4px;cursor:pointer;' + (isFeatured ? 'opacity:0.4;' : '') + '">';
            html += '<input type="checkbox" class="feat-product-cb" value="' + escapeHtml(p.model) + '"' + (isFeatured ? ' disabled' : '') + ' style="width:16px;height:16px;">';
            html += '<span style="flex:1;"><strong>' + escapeHtml(p.model) + '</strong>' + (p.name ? ' — ' + escapeHtml(p.name) : '') + '</span>';
            html += (isFeatured ? '<span style="font-size:11px;color:var(--accent-500);">已推荐</span>' : '');
            html += '</label>';
        });
        $list.innerHTML = html;
    }

    function renderFeaturedList() {
        const $list = document.getElementById('featList');
        const $count = document.getElementById('featCount');
        const products = featuredItems.filter(i => i.type === 'product');
        $count.textContent = products.length + ' 项';
        if (!products.length) { $list.innerHTML = '<div class="log-empty">暂无推荐产品</div>'; return; }
        const nameMap = {};
        allProducts.forEach(p => { nameMap[p.model] = p.name; });
        let html = '';
        products.forEach((item, idx) => {
            const name = nameMap[item.model] || '';
            html += '<div class="pub-file-row" style="display:flex;align-items:center;gap:8px;">';
            html += '  <span style="flex:1;"><strong>' + escapeHtml(item.model) + '</strong>' + (name ? ' — ' + escapeHtml(name) : '') + '</span>';
            if (item.tag) html += '  <span class="pub-file-status status-add">' + escapeHtml(item.tag) + '</span>';
            html += '  <button class="btn btn-danger-outline btn-sm feat-remove-btn" data-idx="' + idx + '">✕</button>';
            html += '</div>';
        });
        $list.innerHTML = html;
        $list.querySelectorAll('.feat-remove-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const productItems = featuredItems.filter(i => i.type === 'product');
                const realItem = productItems[parseInt(btn.dataset.idx)];
                const realIdx = featuredItems.indexOf(realItem);
                if (realIdx >= 0) { featuredItems.splice(realIdx, 1); saveAndRefresh(); }
            });
        });
    }

    async function addFeatured() {
        const $checkboxes = document.querySelectorAll('.feat-product-cb:checked');
        const selected = Array.from($checkboxes).map(cb => cb.value);
        if (!selected.length) { showToast('请至少选择一个产品'); return; }
        const tag = document.getElementById('featTag').value.trim();
        const existingModels = new Set(featuredItems.filter(i => i.type === 'product').map(i => i.model));
        let added = 0;
        selected.forEach(model => { if (!existingModels.has(model)) { featuredItems.push({ type: 'product', model: model, tag: tag || undefined }); added++; } });
        if (!added) { showToast('所选产品已在推荐列表中'); return; }
        await saveAndRefresh();
        showToast('✅ 已添加 ' + added + ' 个推荐产品');
        document.getElementById('featTag').value = '';
    }

    async function clearFeatured() {
        if (featuredItems.length === 0) { showToast('推荐列表已空'); return; }
        if (!confirm('确认清空所有推荐？')) return;
        featuredItems = [];
        await saveAndRefresh();
        showToast('✅ 已清空推荐列表');
    }

    function previewHome() {
        const site = getSite();
        if (!site) { showToast('请先选择一个站点'); return; }
        showToast('👁️ 请打开浏览器查看首页 Featured Products 区域');
    }

    async function saveAndRefresh() {
        const site = getSite();
        if (!site) return;
        try {
            const repoPath = await window.yolongcms.sites.repoPath(site.id);
            await window.yolongcms.yml.write(repoPath + '/_data/' + langFile(), { featured: featuredItems });
            renderProductCheckboxes();
            renderFeaturedList();
        } catch (err) { showToast('保存失败: ' + err.message); }
    }

    function bindEvents() {
        document.getElementById('btnFeatAdd').addEventListener('click', addFeatured);
        document.getElementById('btnFeatClear').addEventListener('click', clearFeatured);
        document.getElementById('btnFeatPreview').addEventListener('click', previewHome);
        document.querySelectorAll('#featContent .lang-tab').forEach(tab => {
            tab.addEventListener('click', () => { if (tab.dataset.lang !== currentLang) setLang(tab.dataset.lang); });
        });
    }

    window.init_featured = async function () { bindEvents(); await load(); };
    window.addEventListener('siteChanged', () => { load(); });
})();
