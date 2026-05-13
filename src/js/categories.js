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

    // ===== 加载分类 =====
    async function loadCategories() {
        const site = getSite();
        if (!site) { document.getElementById('catWrap').innerHTML = '<div class="empty-state" style="display:flex"><h3>请先选择一个站点</h3></div>'; return; }

        try {
            // 并行加载：分类YAML + 产品列表 + 文章列表
            const [ymlR, pR, aR] = await Promise.all([
                window.yolongcms.categories.read(site.id),
                window.yolongcms.products.list(site.id),
                window.yolongcms.articles.list(site.id),
            ]);

            // 从 _data/categories.yml 读取的分类
            const ymlData = ymlR.success ? (ymlR.data || {}) : {};

            // 从产品/文章文件扫描到的分类
            const catFiles = {}; // { name: { products: Set, articles: Set } }
            function addFileCat(name, type) {
                if (!name) return;
                if (!catFiles[name]) catFiles[name] = { products: new Set(), articles: new Set() };
                catFiles[name][type].add(true);
            }
            (pR.files || []).forEach(f => addFileCat(f.category, 'products'));
            (aR.files || []).forEach(f => addFileCat(f.category, 'articles'));

            // 合并：YAML 中的分类优先，并补充文件扫描到的额外分类
            const allNames = new Set([...Object.keys(ymlData), ...Object.keys(catFiles)]);
            const names = Array.from(allNames).sort((a, b) => {
                const oa = ymlData[a]?.order || 99;
                const ob = ymlData[b]?.order || 99;
                return oa - ob || a.localeCompare(b);
            });

            renderCategories(names, ymlData, catFiles);
        } catch (err) {
            document.getElementById('catWrap').innerHTML = '<div class="empty-state" style="display:flex"><h3>加载失败</h3><p>' + escapeHtml(err.message) + '</p></div>';
        }
    }

    function renderCategories(names, ymlData, catFiles) {
        const $wrap = document.getElementById('catWrap');
        const $empty = document.getElementById('catEmpty');

        if (!names.length) {
            $wrap.innerHTML = '';
            $empty.style.display = 'flex';
            return;
        }
        $empty.style.display = 'none';

        let html = '<table class="cat-table"><thead><tr><th>分类名称</th><th>ID</th><th>中文标题</th><th>产品数</th><th>文章数</th><th>操作</th></tr></thead><tbody>';
        names.forEach(name => {
            const ymlEntry = ymlData[name] || {};
            const files = catFiles[name] || { products: new Set(), articles: new Set() };
            const pc = files.products.size;
            const ac = files.articles.size;
            html += '<tr>'
                + '<td><strong>' + escapeHtml(ymlEntry.name || name) + '</strong></td>'
                + '<td><code>' + escapeHtml(name) + '</code></td>'
                + '<td>' + escapeHtml(ymlEntry.title || '-') + '</td>'
                + '<td>' + pc + '</td><td>' + ac + '</td>'
                + '<td class="cat-actions">'
                + '<button class="btn btn-primary-outline btn-sm" data-cat="' + escapeHtml(name) + '" data-action="rename">重命名</button>'
                + '<button class="btn btn-danger-outline btn-sm" data-cat="' + escapeHtml(name) + '" data-action="delete">删除</button>'
                + '</td></tr>';
        });
        html += '</tbody></table>';
        $wrap.innerHTML = html;

        $wrap.querySelectorAll('[data-action="rename"]').forEach(btn => {
            btn.addEventListener('click', () => openRename(btn.dataset.cat));
        });
        $wrap.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', () => openDelete(btn.dataset.cat));
        });
    }

    // ===== 重命名（已有） =====
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

    // ===== 添加分类 =====
    function openAdd() {
        document.getElementById('catAddKey').value = '';
        document.getElementById('catAddName').value = '';
        document.getElementById('catAddSlug').value = '';
        document.getElementById('catAddTitle').value = '';
        document.getElementById('catAddDesc').value = '';
        document.getElementById('catAddOrder').value = '99';
        document.getElementById('catAddError').textContent = '';
        document.getElementById('catAddModal').style.display = 'flex';
        setTimeout(() => document.getElementById('catAddKey').focus(), 100);
    }

    function closeAdd() { document.getElementById('catAddModal').style.display = 'none'; }

    async function confirmAdd() {
        const key = document.getElementById('catAddKey').value.trim();
        const name = document.getElementById('catAddName').value.trim();
        const slug = document.getElementById('catAddSlug').value.trim() || key;
        const title = document.getElementById('catAddTitle').value.trim();
        const desc = document.getElementById('catAddDesc').value.trim();
        const order = parseInt(document.getElementById('catAddOrder').value) || 99;

        if (!key) { document.getElementById('catAddError').textContent = '请输入分类 ID'; return; }
        if (!/^[a-z0-9_-]+$/.test(key)) { document.getElementById('catAddError').textContent = '分类 ID 只能含小写英文、数字、下划线和连字符'; return; }
        if (!name) { document.getElementById('catAddError').textContent = '请输入显示名称'; return; }
        if (!title) { document.getElementById('catAddError').textContent = '请输入中文标题'; return; }

        const site = getSite();
        if (!site) { showToast('请先选择一个站点'); return; }

        try {
            // 读取现有数据
            const ymlR = await window.yolongcms.categories.read(site.id);
            let data = ymlR.success ? (ymlR.data || {}) : {};

            if (data[key]) {
                document.getElementById('catAddError').textContent = '分类 ID "' + key + '" 已存在';
                return;
            }

            // 构建新条目
            data[key] = { name, slug, title };
            if (desc) data[key].desc = desc;
            data[key].order = order;

            const wR = await window.yolongcms.categories.write(site.id, data);
            if (wR.success) {
                showToast('✅ 分类 "' + title + '" 已添加');
                closeAdd();
                loadCategories();
            } else {
                document.getElementById('catAddError').textContent = wR.error || '写入失败';
            }
        } catch (err) {
            document.getElementById('catAddError').textContent = err.message;
        }
    }

    // ===== 删除分类 =====
    let _deleteTarget = null;

    function openDelete(name) {
        _deleteTarget = name;
        const site = getSite();
        document.getElementById('catDeleteError').textContent = '';

        // 异步检查产品/文章引用数
        (async () => {
            if (!site) return;
            const [pR, aR] = await Promise.all([
                window.yolongcms.products.list(site.id),
                window.yolongcms.articles.list(site.id),
            ]);
            const pc = (pR.files || []).filter(f => f.category === name).length;
            const ac = (aR.files || []).filter(f => f.category === name).length;
            let warn = '';
            if (pc > 0 || ac > 0) warn = '<p style="color:var(--danger);margin-top:8px;">⚠️ 有 <strong>' + pc + '</strong> 个产品和 <strong>' + ac + '</strong> 篇文章正在使用此分类。删除后这些文件的分类字段将保留原值，但可能无法在分类列表中显示。</p>';
            document.getElementById('catDeleteBody').innerHTML = '<p>确定要删除分类 "<strong>' + escapeHtml(name) + '</strong>" 吗？</p>' + warn;
        })();

        document.getElementById('catDeleteModal').style.display = 'flex';
    }

    function closeDelete() {
        _deleteTarget = null;
        document.getElementById('catDeleteModal').style.display = 'none';
    }

    async function confirmDelete() {
        const name = _deleteTarget;
        if (!name) return;

        const site = getSite();
        if (!site) { showToast('请先选择一个站点'); return; }

        try {
            const ymlR = await window.yolongcms.categories.read(site.id);
            let data = ymlR.success ? (ymlR.data || {}) : {};

            if (!data[name]) {
                document.getElementById('catDeleteError').textContent = '分类不存在';
                return;
            }

            delete data[name];

            const wR = await window.yolongcms.categories.write(site.id, data);
            if (wR.success) {
                showToast('✅ 分类 "' + name + '" 已删除');
                closeDelete();
                loadCategories();
            } else {
                document.getElementById('catDeleteError').textContent = wR.error || '删除失败';
            }
        } catch (err) {
            document.getElementById('catDeleteError').textContent = err.message;
        }
    }

    // ===== 事件绑定 =====
    function bindEvents() {
        // 重命名
        document.getElementById('catRenameClose').addEventListener('click', closeRename);
        document.getElementById('catRenameCancel').addEventListener('click', closeRename);
        document.getElementById('catRenameConfirm').addEventListener('click', confirmRename);
        document.getElementById('catRenameModal').addEventListener('keydown', e => {
            if (e.key === 'Enter') confirmRename();
            if (e.key === 'Escape') closeRename();
        });

        // 添加
        document.getElementById('btnAddCategory').addEventListener('click', openAdd);
        document.getElementById('catAddClose').addEventListener('click', closeAdd);
        document.getElementById('catAddCancel').addEventListener('click', closeAdd);
        document.getElementById('catAddConfirm').addEventListener('click', confirmAdd);
        document.getElementById('catAddModal').addEventListener('keydown', e => {
            if (e.key === 'Enter') confirmAdd();
            if (e.key === 'Escape') closeAdd();
        });
        // 自动填充 slug
        document.getElementById('catAddKey').addEventListener('input', function () {
            const slugEl = document.getElementById('catAddSlug');
            if (!slugEl.value || slugEl.dataset.auto === 'true') {
                slugEl.value = this.value;
                slugEl.dataset.auto = 'true';
            }
        });
        document.getElementById('catAddSlug').addEventListener('input', function () {
            this.dataset.auto = 'false';
        });

        // 删除
        document.getElementById('catDeleteClose').addEventListener('click', closeDelete);
        document.getElementById('catDeleteCancel').addEventListener('click', closeDelete);
        document.getElementById('catDeleteConfirm').addEventListener('click', confirmDelete);
        document.getElementById('catDeleteModal').addEventListener('keydown', e => {
            if (e.key === 'Escape') closeDelete();
        });
    }

    window.init_categories = async function () { bindEvents(); await loadCategories(); };
    window.addEventListener('siteChanged', () => { loadCategories(); });
})();
