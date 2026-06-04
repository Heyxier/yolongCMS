// YolongCMS Desktop — 首页推荐管理（品类版）
(function () {
    'use strict';

    let featuredItems = [];
    let allCategories = {};

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

    async function load() {
        const site = getSite();
        const $empty = document.getElementById('featEmpty');
        const $content = document.getElementById('featContent');
        if (!site) { $empty.style.display = 'flex'; $content.style.display = 'none'; return; }
        $empty.style.display = 'none'; $content.style.display = 'block';

        try {
            const repoPath = await window.yolongcms.sites.repoPath(site.id);
            const [ymlR, catR] = await Promise.all([
                window.yolongcms.yml.read(repoPath + '/_data/featured.yml'),
                window.yolongcms.yml.read(repoPath + '/_data/categories.yml'),
            ]);
            featuredItems = (ymlR.success && ymlR.data && ymlR.data.featured) ? ymlR.data.featured : [];
            allCategories = (catR.success && catR.data) ? catR.data : {};
            renderCategoryCheckboxes();
            renderFeaturedList();
            showToast('✅ 已加载');
        } catch (err) { showToast('加载失败: ' + err.message); }
    }

    function renderCategoryCheckboxes() {
        const $list = document.getElementById('featCategoryList');
        const slugs = Object.keys(allCategories);
        if (!slugs.length) { $list.innerHTML = '<div class="log-empty">暂无品类数据</div>'; return; }
        const featuredSlugs = new Set(featuredItems.filter(i => i.type === 'category').map(i => i.slug));
        let html = '';
        slugs.forEach(slug => {
            const cat = allCategories[slug];
            const isFeatured = featuredSlugs.has(slug);
            const nameZh = (cat && cat.name_zh) || slug;
            html += '<label class="feat-checkbox-row" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:4px;cursor:pointer;' + (isFeatured ? 'opacity:0.4;' : '') + '">';
            html += '<input type="checkbox" class="feat-category-cb" value="' + escapeHtml(slug) + '"' + (isFeatured ? ' disabled' : '') + ' style="width:16px;height:16px;">';
            html += '<span style="flex:1;"><strong>' + escapeHtml(nameZh) + '</strong> <span style="color:var(--text-muted);font-size:12px;">(' + escapeHtml(slug) + ')</span></span>';
            html += (isFeatured ? '<span style="font-size:11px;color:var(--accent-500);">已推荐</span>' : '');
            html += '</label>';
        });
        $list.innerHTML = html;
    }

    function renderFeaturedList() {
        const $list = document.getElementById('featList');
        const $count = document.getElementById('featCount');
        const items = featuredItems.filter(i => i.type === 'category');
        $count.textContent = items.length + ' 项';
        if (!items.length) { $list.innerHTML = '<div class="log-empty">暂无推荐品类</div>'; return; }
        let html = '';
        items.forEach((item, idx) => {
            const cat = allCategories[item.slug] || {};
            const nameZh = cat.name_zh || item.slug;
            html += '<div class="pub-file-row" style="display:flex;align-items:center;gap:8px;">';
            html += '  <span style="flex:1;"><strong>' + escapeHtml(nameZh) + '</strong> <span style="color:var(--text-muted);font-size:12px;">(' + escapeHtml(item.slug) + ')</span></span>';
            if (item.tag) html += '  <span class="pub-file-status status-add">' + escapeHtml(item.tag) + '</span>';
            html += '  <button class="btn btn-danger-outline btn-sm feat-remove-btn" data-idx="' + idx + '">✕</button>';
            html += '</div>';
        });
        $list.innerHTML = html;
        $list.querySelectorAll('.feat-remove-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const catItems = featuredItems.filter(i => i.type === 'category');
                const realItem = catItems[parseInt(btn.dataset.idx)];
                const realIdx = featuredItems.indexOf(realItem);
                if (realIdx >= 0) { featuredItems.splice(realIdx, 1); saveAndRefresh(); }
            });
        });
    }

    async function addFeatured() {
        const $checkboxes = document.querySelectorAll('.feat-category-cb:checked');
        const selected = Array.from($checkboxes).map(cb => cb.value);
        if (!selected.length) { showToast('请至少选择一个品类'); return; }
        const tag = document.getElementById('featTag').value.trim();
        const existingSlugs = new Set(featuredItems.filter(i => i.type === 'category').map(i => i.slug));
        let added = 0;
        selected.forEach(slug => { if (!existingSlugs.has(slug)) { featuredItems.push({ type: 'category', slug: slug, tag: tag || undefined }); added++; } });
        if (!added) { showToast('所选品类已在推荐列表中'); return; }
        await saveAndRefresh();
        showToast('✅ 已添加 ' + added + ' 个推荐品类');
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
        showToast('👁️ 请打开浏览器查看首页精选品类区域');
    }

    async function saveAndRefresh() {
        const site = getSite();
        if (!site) return;
        try {
            const repoPath = await window.yolongcms.sites.repoPath(site.id);
            await window.yolongcms.yml.write(repoPath + '/_data/featured.yml', { featured: featuredItems });
            renderCategoryCheckboxes();
            renderFeaturedList();
        } catch (err) { showToast('保存失败: ' + err.message); }
    }

    function bindEvents() {
        document.getElementById('btnFeatAdd').addEventListener('click', addFeatured);
        document.getElementById('btnFeatClear').addEventListener('click', clearFeatured);
        document.getElementById('btnFeatPreview').addEventListener('click', previewHome);
    }

    window.init_featured = async function () { bindEvents(); await load(); };
    window.addEventListener('siteChanged', () => { load(); });
})();
