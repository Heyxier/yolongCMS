// YolongCMS Desktop — 分类管理
(function () {
    'use strict';

    function escapeHtml(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

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

    function getSite() { const a = window.__app; return a ? a.getCurrentSite() : null; }

    async function loadCategories() {
        const site = getSite();
        if (!site) { document.getElementById('catWrap').innerHTML = '<div class="empty-state" style="display:flex"><h3>请先选择一个站点</h3></div>'; return; }

        try {
            const [pR, aR] = await Promise.all([
                window.yolongcms.products.list(site.id),
                window.yolongcms.articles.list(site.id),
            ]);

            const catMap = {}; // { name: { products: Set, articles: Set } }
            function addCat(name, type) {
                if (!name) return;
                if (!catMap[name]) catMap[name] = { products: new Set(), articles: new Set() };
                catMap[name][type].add(true);
            }

            (pR.files || []).forEach(f => addCat(f.category, 'products'));
            (aR.files || []).forEach(f => addCat(f.category, 'articles'));

            const names = Object.keys(catMap).sort();
            renderCategories(names, catMap);
        } catch (err) {
            document.getElementById('catWrap').innerHTML = '<div class="empty-state" style="display:flex"><h3>加载失败</h3><p>' + escapeHtml(err.message) + '</p></div>';
        }
    }

    function renderCategories(names, catMap) {
        const $wrap = document.getElementById('catWrap');
        const $empty = document.getElementById('catEmpty');

        if (!names.length) {
            $wrap.innerHTML = '';
            $empty.style.display = 'flex';
            return;
        }
        $empty.style.display = 'none';

        let html = '<table class="cat-table"><thead><tr><th>分类名称</th><th>产品数</th><th>文章数</th><th>总计</th><th>操作</th></tr></thead><tbody>';
        names.forEach(name => {
            const pc = catMap[name].products.size;
            const ac = catMap[name].articles.size;
            html += '<tr><td><strong>' + escapeHtml(name) + '</strong></td>'
                + '<td>' + pc + '</td><td>' + ac + '</td><td>' + (pc + ac) + '</td>'
                + '<td><button class="btn btn-primary-outline btn-sm" data-cat="' + escapeHtml(name) + '" data-action="rename">重命名</button></td></tr>';
        });
        html += '</tbody></table>';
        $wrap.innerHTML = html;

        $wrap.querySelectorAll('[data-action="rename"]').forEach(btn => {
            btn.addEventListener('click', () => openRename(btn.dataset.cat));
        });
    }

    function openRename(name) {
        document.getElementById('catOldName').value = name;
        document.getElementById('catNewName').value = '';
        document.getElementById('catRenameError').textContent = '';
        document.getElementById('catRenamePreview').textContent = '所有使用 "' + name + '" 的产品和文章将同步更新';
        document.getElementById('catRenameModal').style.display = 'flex';
        setTimeout(() => document.getElementById('catNewName').focus(), 100);
    }

    function closeRename() { document.getElementById('catRenameModal').style.display = 'none'; }

    async function confirmRename() {
        const oldName = document.getElementById('catOldName').value.trim();
        const newName = document.getElementById('catNewName').value.trim();
        if (!newName) { document.getElementById('catRenameError').textContent = '请输入新名称'; return; }
        if (oldName === newName) { document.getElementById('catRenameError').textContent = '新名称与原名称相同'; return; }

        const site = getSite();
        if (!site) { showToast('请先选择一个站点'); return; }

        try {
            const r = await window.yolongcms.categories.rename(site.id, oldName, newName);
            if (r.success) {
                showToast('✅ 已重命名 "' + oldName + '" → "' + newName + '"（' + r.updated + ' 个文件）');
                closeRename();
                loadCategories();
            } else {
                document.getElementById('catRenameError').textContent = r.error;
            }
        } catch (err) {
            document.getElementById('catRenameError').textContent = err.message;
        }
    }

    function bindEvents() {
        document.getElementById('catRenameClose').addEventListener('click', closeRename);
        document.getElementById('catRenameCancel').addEventListener('click', closeRename);
        document.getElementById('catRenameConfirm').addEventListener('click', confirmRename);
        document.getElementById('catRenameModal').addEventListener('keydown', e => {
            if (e.key === 'Enter') confirmRename();
            if (e.key === 'Escape') closeRename();
        });
    }

    window.init_categories = async function () { bindEvents(); await loadCategories(); };
    window.addEventListener('siteChanged', () => { loadCategories(); });
})();
