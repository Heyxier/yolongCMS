// YolongCMS Desktop — 文章管理
(function () {
    'use strict';

    let currentSite = null;
    let articles = [];
    let categories = [];
    let editingFile = null;

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function showToast(msg) {
        let t = document.getElementById('toast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'toast';
            t.style.cssText = 'position:fixed;bottom:32px;left:50%;transform:translateX(-50%);background:var(--bg-secondary);color:var(--text-primary);padding:12px 24px;border-radius:var(--radius-lg);border:1px solid var(--border-color);font-size:14px;z-index:10000;box-shadow:0 8px 32px rgba(0,0,0,0.4);opacity:0;transition:opacity 0.3s;max-width:500px;text-align:center;';
            document.body.appendChild(t);
        }
        t.textContent = msg;
        t.style.opacity = '1';
        clearTimeout(t._timer);
        t._timer = setTimeout(() => { t.style.opacity = '0'; }, 3000);
    }

    function getActiveSite() {
        const app = window.__app;
        return app ? app.getCurrentSite() : null;
    }

    function formatDate(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        const pad = n => String(n).padStart(2, '0');
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }

    function parseLines(t) {
        if (!t || !t.trim()) return [];
        return t.split('\n').map(l => l.trim()).filter(Boolean);
    }

    function formatLines(arr) {
        return (arr || []).join('\n');
    }

    // 从标题生成文件名
    function slugify(title) {
        return title.toLowerCase()
            .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'untitled';
    }

    // ===== 简易 Markdown → HTML 转换 =====
    // 处理 CMS 文章中使用的有限 Markdown 语法（# 标题、**加粗**、*斜体*、列表、链接）
    function markdownToHtml(text) {
        if (!text) return '';
        // 如果已包含 HTML 标签，跳过转换
        if (/<[a-z][\s\S]*>/i.test(text)) return text;

        const lines = text.split('\n');
        const result = [];
        let inList = null; // 'ol' 或 'ul'
        let listItems = [];

        function flushList() {
            if (inList && listItems.length) {
                result.push('<' + inList + '>');
                listItems.forEach(item => result.push('  <li>' + item + '</li>'));
                result.push('</' + inList + '>');
                listItems = [];
                inList = null;
            }
        }

        function processInline(str) {
            return str
                // 先处理链接和图片，避免 _ 干扰
                .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;">')
                .replace(/\[([^\]]*)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
                // 行内代码
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                // 加粗
                .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                // 斜体
                .replace(/\*([^*]+)\*/g, '<em>$1</em>');
        }

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // 空行 → 分隔段落
            if (!trimmed) {
                flushList();
                continue;
            }

            // 跳过纯 frontmatter 分隔符
            if (trimmed === '---') continue;

            // 标题
            const hMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
            if (hMatch) {
                flushList();
                const level = hMatch[1].length;
                result.push('<h' + level + '>' + processInline(hMatch[2]) + '</h' + level + '>');
                continue;
            }

            // 有序列表
            if (/^\d+\.\s+(.*)/.test(trimmed)) {
                const content = trimmed.replace(/^\d+\.\s+/, '');
                if (inList !== 'ol') { flushList(); inList = 'ol'; }
                listItems.push(processInline(content));
                continue;
            }

            // 无序列表
            if (/^[-*]\s+(.*)/.test(trimmed)) {
                const content = trimmed.replace(/^[-*]\s+/, '');
                if (inList !== 'ul') { flushList(); inList = 'ul'; }
                listItems.push(processInline(content));
                continue;
            }

            // 普通段落
            flushList();
            result.push('<p>' + processInline(trimmed) + '</p>');
        }

        flushList();
        return result.join('\n');
    }

    // ===== 富文本编辑器 =====
    let isSourceMode = false;

    function initRichEditor() {
        const $toolbar = document.getElementById('richToolbar');
        if (!$toolbar) return;

        // 工具条按钮
        $toolbar.querySelectorAll('[data-cmd]').forEach(btn => {
            btn.addEventListener('click', () => {
                const cmd = btn.dataset.cmd;
                if (cmd === 'source') {
                    toggleSource();
                } else if (cmd === 'image') {
                    insertImage();
                } else {
                    document.execCommand(cmd, false, null);
                    document.getElementById('richContent').focus();
                }
            });
        });
    }

    function toggleSource() {
        const $content = document.getElementById('richContent');
        const $source = document.getElementById('afBody');
        const $btn = document.getElementById('btnRichSource');
        isSourceMode = !isSourceMode;
        if (isSourceMode) {
            $source.value = $content.innerHTML;
            $content.style.display = 'none';
            $source.style.display = 'block';
            $btn.style.background = 'var(--accent)';
            $btn.style.color = '#fff';
        } else {
            $content.innerHTML = $source.value;
            $source.style.display = 'none';
            $content.style.display = 'block';
            $btn.style.background = '';
            $btn.style.color = '';
        }
    }

    function getRichContent() {
        const $content = document.getElementById('richContent');
        const $source = document.getElementById('afBody');
        let html = isSourceMode ? $source.value : $content.innerHTML;
        // 替换预览路径：移除 src="file://..."，将 data-src 提升为 src
        html = html.replace(/<img[^>]*>/gi, function(match) {
            // 如果有 data-src，用它替换 src
            const dataSrc = match.match(/data-src="([^"]*)"/);
            if (dataSrc) {
                return match
                    .replace(/ src="[^"]*"/, ' src="' + dataSrc[1] + '"')
                    .replace(/ data-src="[^"]*"/, '');
            }
            return match;
        });
        // 修复块级标签粘在 Markdown 段落末尾的问题
        // 例如 "text<p><img>" → "text\n\n<p><img>"，避免 kramdown 转义
        html = html.replace(/([^\n])\s*<\/(p|div|ul|ol|h[1-6]|table)\b/gi, '$1\n\n<\/$2');
        html = html.replace(/([^\n])\s*<(p|div|ul|ol|h[1-6]|table|pre|blockquote)(\s|>)/gi, '$1\n\n<$2$3');
        return html;
    }

    function setRichContent(html) {
        const $content = document.getElementById('richContent');
        const $source = document.getElementById('afBody');
        // 如果是 Markdown 格式（不含 HTML 标签），先转为 HTML
        const rendered = markdownToHtml(html || '');
        $content.innerHTML = rendered;
        $source.value = rendered;
        // 将相对路径的图片转为本地绝对路径，以便编辑器预览
        resolveEditorImages();
    }

    async function resolveEditorImages() {
        const site = getActiveSite();
        if (!site || !window.yolongcms || !window.yolongcms.sites) return;
        try {
            const repoPath = await window.yolongcms.sites.repoPath(site.id);
            if (!repoPath) return;
            const $content = document.getElementById('richContent');
            $content.querySelectorAll('img[src^="/images/"]').forEach(img => {
                const relative = img.getAttribute('src');
                // 如果是 Windows 路径，注意反斜杠
                const localPath = 'file://' + repoPath + relative;
                img.setAttribute('data-src', relative);
                img.setAttribute('src', localPath);
            });
        } catch {
            // 静默失败，图片不预览也不影响功能
        }
    }

    function clearRichContent() {
        setRichContent('');
        if (isSourceMode) toggleSource();
    }

    async function insertImage() {
        const site = getActiveSite();
        if (!site) { showToast('请先选择一个站点'); return; }

        // 先聚焦编辑器，保证后续插入不丢失
        const $content = document.getElementById('richContent');
        if (!isSourceMode) $content.focus();

        openImagePicker((path, localPath) => {
            // 编辑器中用 file:// 本地路径预览
            const previewSrc = localPath ? 'file://' + localPath : escapeHtml(path);
            // 保存时用相对路径
            const saveSrc = escapeHtml(path);

            // 插入双属性 img：本地预览 + 保存路径
            const imgHtml = `<p><img src="${previewSrc}" data-src="${saveSrc}" alt="" style="max-width:100%;border-radius:6px;"></p>`;

            if (isSourceMode) {
                const $source = document.getElementById('afBody');
                $source.value += '\n' + imgHtml;
            } else {
                // 用 Selection API 代替废弃的 execCommand
                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0 && $content.contains(sel.anchorNode)) {
                    const range = sel.getRangeAt(0);
                    range.deleteContents();
                    const frag = range.createContextualFragment(imgHtml);
                    range.insertNode(frag);
                    range.collapse(false);
                    sel.removeAllRanges();
                    sel.addRange(range);
                } else {
                    // fallback: 追加到末尾
                    $content.innerHTML += imgHtml;
                }
            }
        });
    }

    // ===== 图片选择弹窗（支持文件夹浏览） =====
    let imagePickerCallback = null;
    let pickerCurrentDir = '';  // 相对路径，如 '' 或 'products' 或 'news'

    async function openImagePicker(callback) {
        imagePickerCallback = callback;
        pickerCurrentDir = '';
        const $modal = document.getElementById('imagePickerModal');
        if ($modal) {
            $modal.style.display = 'flex';
            loadPickerImages('');
        } else {
            const path = prompt('输入图片路径（例如: /images/news/photo.jpg）');
            if (path && path.trim()) callback(path.trim());
        }
    }

    function closeImagePicker() {
        document.getElementById('imagePickerModal').style.display = 'none';
        imagePickerCallback = null;
        pickerCurrentDir = '';
    }

    async function loadPickerImages(subDir) {
        const site = getActiveSite();
        if (!site) return;

        pickerCurrentDir = subDir || '';

        const $list = document.getElementById('pickerImageList');
        const $nav = document.getElementById('pickerNav');
        if (!$list) return;

        try {
            const r = await window.yolongcms.images.list(site.id, subDir || '');
            let html = '';

            // 文件夹导航
            if ($nav) {
                const breadcrumbs = buildPickerBreadcrumbs(subDir || '');
                $nav.innerHTML = breadcrumbs;
                // 绑定面包屑点击（事件委托）
                $nav.querySelectorAll('.picker-nav-link').forEach(el => {
                    el.addEventListener('click', () => {
                        loadPickerImages(el.dataset.dir || '');
                    });
                });
            }

            // 显示子目录
            if (r.success && r.subdirs && r.subdirs.length) {
                r.subdirs.forEach(d => {
                    const dirPath = subDir ? subDir + '/' + d.name : d.name;
                    html += '<div class="picker-folder" data-dir="' + escapeHtml(dirPath) + '">';
                    html += '  <span class="picker-folder-icon">📁</span>';
                    html += '  <span>' + escapeHtml(d.name) + '</span>';
                    html += '</div>';
                });
            }

            // 显示图片文件
            if (r.success && r.files && r.files.length) {
                r.files.forEach(f => {
                    const relPath = '/images/' + (subDir ? subDir + '/' : '') + f.name;
                    html += '<div class="picker-image-item" data-path="' + escapeHtml(relPath) + '" data-local="' + escapeHtml(f.filePath) + '">';
                    html += '  <div class="picker-img-wrap"><img src="file://' + escapeHtml(f.filePath) + '" loading="lazy"></div>';
                    html += '  <span>' + escapeHtml(f.name) + '</span>';
                    html += '</div>';
                });
            }

            if (!html) {
                html = '<div class="picker-empty">📂 此文件夹为空</div>';
            }

            $list.innerHTML = html;

            // 绑定文件夹点击
            $list.querySelectorAll('.picker-folder').forEach(el => {
                el.addEventListener('dblclick', () => {
                    loadPickerImages(el.dataset.dir);
                });
                el.addEventListener('click', () => {
                    document.querySelectorAll('.picker-folder, .picker-image-item').forEach(i => i.classList.remove('selected'));
                    el.classList.add('selected');
                });
            });

            // 绑定图片点击
            $list.querySelectorAll('.picker-image-item').forEach(el => {
                el.addEventListener('dblclick', () => {
                    const path = el.dataset.path;
                    const local = el.dataset.local;
                    if (imagePickerCallback) imagePickerCallback(path, local);
                    closeImagePicker();
                });
                el.addEventListener('click', () => {
                    document.querySelectorAll('.picker-folder, .picker-image-item').forEach(i => i.classList.remove('selected'));
                    el.classList.add('selected');
                });
            });
        } catch (err) {
            $list.innerHTML = '<div class="picker-empty">加载失败: ' + err.message + '</div>';
        }
    }

    function buildPickerBreadcrumbs(subDir) {
        if (!subDir) return '<span class="picker-nav-root">📁 images/</span>';
        const parts = subDir.split('/');
        let html = '<span class="picker-nav-link" data-dir="">📁 images/</span>';
        let path = '';
        parts.forEach((p, i) => {
            path = path ? path + '/' + p : p;
            if (i === parts.length - 1) {
                html += '<span class="picker-nav-sep"> / </span><span class="picker-nav-current">' + escapeHtml(p) + '</span>';
            } else {
                html += '<span class="picker-nav-sep"> / </span><span class="picker-nav-link" data-dir="' + escapeHtml(path) + '">' + escapeHtml(p) + '</span>';
            }
        });
        return html;
    }
    async function loadArticles() {
        currentSite = getActiveSite();
        if (!currentSite) { showEmpty('请先选择一个站点'); return; }
        try {
            const r = await window.yolongcms.articles.list(currentSite.id);
            if (r.success) {
                articles = r.files.sort((a, b) => b.mtime - a.mtime);
                const cats = new Set();
                articles.forEach(a => { if (a.category) cats.add(a.category); });
                categories = Array.from(cats).sort();
                renderCategoryFilter();
                renderArticles();
            } else {
                showEmpty('加载失败: ' + r.error);
            }
        } catch (err) {
            showEmpty('加载失败: ' + err.message);
        }
    }

    function showEmpty(msg) {
        const $e = document.getElementById('articleEmpty');
        if ($e) { $e.style.display = 'flex'; const p = $e.querySelector('p'); if (p) p.textContent = msg; }
    }

    // ===== 分类筛选 =====
    function renderCategoryFilter() {
        const $sel = document.getElementById('artFilterCategory');
        const cur = $sel.value;
        $sel.innerHTML = '<option value="">全部</option>';
        categories.forEach(c => { $sel.innerHTML += '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + '</option>'; });
        $sel.value = cur;
    }

    // ===== 渲染列表 =====
    function renderArticles() {
        try {
            const $list = document.getElementById('articleList');
            const $empty = document.getElementById('articleEmpty');
            const $stats = document.getElementById('articleStats');
            if (!$list || !$stats) return;

            const filterCat = document.getElementById('artFilterCategory')?.value || '';
            const filterStatus = document.getElementById('artFilterStatus')?.value || '';
            const filterSearch = (document.getElementById('artFilterSearch')?.value || '').toLowerCase().trim();

            let filtered = articles.filter(a => {
                if (filterCat && a.category !== filterCat) return false;
                if (filterStatus !== '' && (a.status === undefined || String(a.status) !== filterStatus)) return false;
                if (filterSearch) {
                    const t = (a.title || '').toLowerCase();
                    if (!t.includes(filterSearch)) return false;
                }
                return true;
            });

            $stats.textContent = '共 ' + filtered.length + ' / ' + articles.length + ' 篇文章';

            if (!filtered.length) {
                $list.innerHTML = '';
                if ($empty) {
                    $empty.style.display = 'flex';
                    const p = $empty.querySelector('p');
                    if (p) p.textContent = articles.length ? '没有匹配的文章' : '暂无文章';
                }
                return;
            }
            if ($empty) $empty.style.display = 'none';

            let html = '';
            filtered.forEach(a => {
                const pub = a.tags && a.tags.length ? a.tags[0] : '';
                const isPub = a.status !== false;
                html += '<div class="article-card">';
                html += '  <div class="article-info">';
                html += '    <div class="article-title">' + escapeHtml(a.title || a.name) + '</div>';
                html += '    <div class="article-meta">';
                if (a.category) html += '      <span class="product-tag">' + escapeHtml(a.category) + '</span>';
                const date = a.mtime ? formatDate(a.mtime) : '';
                if (date) html += '      <span class="article-date">' + date + '</span>';
                html += '      <span class="product-status ' + (isPub ? 'status-on' : 'status-off') + '">' + (isPub ? '已发布' : '草稿') + '</span>';
                html += '    </div>';
                html += '  </div>';
                html += '  <div class="product-actions">';
                html += '    <button class="btn btn-primary-outline btn-sm" data-file="' + escapeHtml(a.name) + '" data-action="edit">编辑</button>';
                html += '    <button class="btn btn-danger-outline btn-sm" data-file="' + escapeHtml(a.name) + '" data-action="delete">删除</button>';
                html += '  </div>';
                html += '</div>';
            });
            $list.innerHTML = html;

            $list.querySelectorAll('[data-action="edit"]').forEach(btn => {
                btn.addEventListener('click', () => openEdit(btn.dataset.file));
            });
            $list.querySelectorAll('[data-action="delete"]').forEach(btn => {
                btn.addEventListener('click', () => deleteArticle(btn.dataset.file));
            });
        } catch (err) {
            console.error('[Articles] render error:', err);
            const $l = document.getElementById('articleList');
            if ($l) $l.innerHTML = '<div class="log-empty">渲染失败: ' + escapeHtml(err.message) + '</div>';
        }
    }

    // ===== 编辑弹窗 =====
    async function openEdit(filename) {
        editingFile = filename;
        document.getElementById('modalArticleTitle').textContent = '编辑文章';
        document.getElementById('modalArticleSave').textContent = '保存';
        try {
            const r = await window.yolongcms.articles.read(currentSite.id, filename);
            if (!r.success) { showToast('读取失败: ' + r.error); return; }
            const d = r.data || {};
            document.getElementById('afTitle').value = d.title || '';
            document.getElementById('afCategory').value = d.category || '';
            document.getElementById('afPublishedAt').value = d.publishedAt || '';
            document.getElementById('afStatus').checked = d.status !== false;
            updateStatusText();
            document.getElementById('afCoverImage').value = d.coverImage || '';
            document.getElementById('afExcerpt').value = d.excerpt || '';
            document.getElementById('afTags').value = formatLines(d.tags);
            setRichContent(r.content || '');
            document.getElementById('afError').textContent = '';
            showModal();
        } catch (err) {
            showToast('读取失败: ' + err.message);
        }
    }

    function openAdd() {
        editingFile = null;
        document.getElementById('modalArticleTitle').textContent = '添加文章';
        document.getElementById('modalArticleSave').textContent = '添加';
        document.getElementById('afTitle').value = '';
        document.getElementById('afCategory').value = '';
        document.getElementById('afPublishedAt').value = new Date().toISOString().split('T')[0];
        document.getElementById('afStatus').checked = true;
        updateStatusText();
        document.getElementById('afCoverImage').value = '';
        document.getElementById('afExcerpt').value = '';
        document.getElementById('afTags').value = '';
        clearRichContent();
        document.getElementById('afError').textContent = '';
        showModal();
    }

    function showModal() { document.getElementById('articleModal').style.display = 'flex'; }
    function closeModal() { document.getElementById('articleModal').style.display = 'none'; editingFile = null; }
    function updateStatusText() {
        document.getElementById('afStatusText').textContent = document.getElementById('afStatus').checked ? '已发布' : '草稿';
    }

    // ===== 保存 =====
    async function saveArticle() {
        const title = document.getElementById('afTitle').value.trim();
        const category = document.getElementById('afCategory').value.trim();
        if (!title) { document.getElementById('afError').textContent = '标题不能为空'; return; }
        if (!category) { document.getElementById('afError').textContent = '分类不能为空'; return; }

        const slug = slugify(title);
        const filename = slug + '.md';

        if (!editingFile) {
            if (articles.some(a => a.name === filename)) {
                document.getElementById('afError').textContent = '已有同标题文章，请修改标题';
                return;
            }
        }

        const data = {
            title,
            category,
            publishedAt: document.getElementById('afPublishedAt').value || new Date().toISOString().split('T')[0],
            excerpt: document.getElementById('afExcerpt').value.trim(),
            coverImage: document.getElementById('afCoverImage').value.trim(),
            tags: parseLines(document.getElementById('afTags').value),
            status: document.getElementById('afStatus').checked,
        };
        const body = getRichContent();

        try {
            const r = await window.yolongcms.articles.write(currentSite.id, editingFile || filename, data, body);
            if (r.success) {
                showToast(editingFile ? '✅ 文章已更新' : '✅ 文章已添加');
                closeModal();
                await loadArticles();
            } else {
                document.getElementById('afError').textContent = '保存失败: ' + r.error;
            }
        } catch (err) {
            document.getElementById('afError').textContent = '保存失败: ' + err.message;
        }
    }

    // ===== 删除 =====
    async function deleteArticle(filename) {
        if (!confirm('确认删除 "' + filename.replace(/\.md$/, '') + '"？不可撤销！')) return;
        try {
            const r = await window.yolongcms.articles.remove(currentSite.id, filename);
            if (r.success) { showToast('✅ 已删除'); await loadArticles(); }
            else { showToast('❌ 删除失败: ' + r.error); }
        } catch (err) { showToast('❌ 删除失败: ' + err.message); }
    }

    // ===== 事件绑定 =====
    function bindEvents() {
        document.getElementById('btnAddArticle').addEventListener('click', openAdd);
        document.getElementById('modalArticleClose').addEventListener('click', closeModal);
        document.getElementById('modalArticleCancel').addEventListener('click', closeModal);
        document.getElementById('modalArticleSave').addEventListener('click', saveArticle);
        document.getElementById('afStatus').addEventListener('change', updateStatusText);
        // 图片选择弹窗
        document.getElementById('pickerModalClose')?.addEventListener('click', closeImagePicker);
        document.getElementById('pickerModalCancel')?.addEventListener('click', closeImagePicker);
        document.getElementById('pickerModalSelect')?.addEventListener('click', () => {
            const sel = document.querySelector('.picker-image-item.selected');
            if (sel && imagePickerCallback) {
                imagePickerCallback(sel.dataset.path, sel.dataset.local);
                closeImagePicker();
            } else {
                showToast('请先点击选择一张图片');
            }
        });

        ['artFilterCategory', 'artFilterStatus', 'artFilterSearch'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', renderArticles);
        });
        document.getElementById('artFilterSearch').addEventListener('input', renderArticles);

        document.getElementById('articleModal').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') saveArticle();
            if (e.key === 'Escape') closeModal();
        });
    }

    // ===== 初始化 =====
    window.init_articles = async function () {
        bindEvents();
        initRichEditor();
        await loadArticles();
    };

    window.addEventListener('siteChanged', () => { loadArticles(); });
})();
