// YolongCMS Desktop — 图片管理
(function () {
    'use strict';

    let currentSite = null;
    let currentDir = '';  // images/ 下的子目录路径

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
        toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 3000);
    }

    function getActiveSite() {
        const app = window.__app;
        return app ? app.getCurrentSite() : null;
    }

    function formatSize(bytes) {
        if (!bytes) return '';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    }

    function formatDate(ms) {
        if (!ms) return '';
        const d = new Date(ms);
        const pad = n => String(n).padStart(2, '0');
        return pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }

    // 图片文件的 file:// URL
    function fileUrl(filePath) {
        if (!filePath) return '';
        return 'file://' + filePath.replace(/\\/g, '/');
    }

    // ===== 加载图片列表 =====
    async function loadImages() {
        currentSite = getActiveSite();
        if (!currentSite) {
            showEmpty('请先选择一个站点');
            return;
        }
        try {
            const result = await window.yolongcms.images.list(currentSite.id, currentDir);
            if (result.success) {
                renderBreadcrumb();
                renderGrid(result);
            } else {
                showEmpty('加载失败: ' + result.error);
            }
        } catch (err) {
            showEmpty('加载失败: ' + err.message);
        }
    }

    function showEmpty(msg) {
        const $grid = document.getElementById('imageGrid');
        const $empty = document.getElementById('imageEmpty');
        if ($empty) {
            $empty.style.display = 'flex';
            $empty.querySelector('h3').textContent = msg || '此目录为空';
        }
        if ($grid) $grid.innerHTML = '';
    }

    // ===== 面包屑 =====
    function renderBreadcrumb() {
        const $bc = document.getElementById('imgBreadcrumb');
        const parts = currentDir ? currentDir.split('/') : [];
        let cum = '';
        let html = '<span class="breadcrumb-item" data-path="">images/</span>';
        parts.forEach(p => {
            cum = cum ? cum + '/' + p : p;
            html += '<span class="breadcrumb-sep">/</span>';
            html += '<span class="breadcrumb-item" data-path="' + escapeHtml(cum) + '">' + escapeHtml(p) + '</span>';
        });
        $bc.innerHTML = html;

        $bc.querySelectorAll('.breadcrumb-item').forEach(el => {
            el.addEventListener('click', () => {
                currentDir = el.dataset.path;
                loadImages();
            });
        });
    }

    // ===== 渲染网格 =====
    function renderGrid(data) {
        const $grid = document.getElementById('imageGrid');
        const $empty = document.getElementById('imageEmpty');

        const subdirs = data.subdirs || [];
        const files = data.files || [];

        if (!subdirs.length && !files.length) {
            $empty.style.display = 'flex';
            $grid.innerHTML = '';
            return;
        }
        $empty.style.display = 'none';

        let html = '';
        // 文件夹
        subdirs.forEach(dir => {
            const relPath = currentDir ? currentDir + '/' + dir.name : dir.name;
            html += '<div class="img-item img-folder" data-path="' + escapeHtml(relPath) + '">';
            html += '  <div class="img-thumb img-thumb-folder">📁</div>';
            html += '  <div class="img-name">' + escapeHtml(dir.name) + '</div>';
            html += '</div>';
        });
        // 图片文件
        files.forEach(f => {
            const relPath = currentDir ? currentDir + '/' + f.name : f.name;
            const imgSrc = fileUrl(f.filePath);
            html += '<div class="img-item img-file" data-path="' + escapeHtml(relPath) + '" data-filepath="' + escapeHtml(f.filePath) + '">';
            html += '  <div class="img-thumb"><img src="' + imgSrc + '" loading="lazy" onerror="this.parentElement.innerHTML=\'🖼️\'"></div>';
            html += '  <div class="img-name">' + escapeHtml(f.name) + '</div>';
            html += '  <div class="img-size">' + formatSize(f.size) + '</div>';
            html += '</div>';
        });
        $grid.innerHTML = html;

        // 文件夹点击
        $grid.querySelectorAll('.img-folder').forEach(el => {
            el.addEventListener('click', () => {
                currentDir = el.dataset.path;
                loadImages();
            });
        });

        // 图片点击 → 复制路径
        $grid.querySelectorAll('.img-file').forEach(el => {
            el.addEventListener('click', () => {
                const relPath = el.dataset.path;
                const fullPath = 'images/' + relPath;
                navigator.clipboard.writeText(fullPath).then(() => {
                    showToast('✅ 已复制路径: ' + fullPath);
                }).catch(() => {
                    showToast('📋 ' + fullPath);
                });
            });
        });

        // 右键菜单：删除
        $grid.querySelectorAll('.img-item').forEach(el => {
            el.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isDir = el.classList.contains('img-folder');
                const name = el.querySelector('.img-name')?.textContent || '';
                if (confirm('确认删除 ' + (isDir ? '文件夹' : '图片') + ' "' + name + '"？')) {
                    deleteItem(el.dataset.path, isDir);
                }
            });
        });
    }

    // ===== 上传图片 =====
    async function uploadImages() {
        currentSite = getActiveSite();
        if (!currentSite) { showToast('请先选择一个站点'); return; }

        try {
            const result = await window.yolongcms.images.upload(currentSite.id, currentDir);
            if (result.success) {
                const count = result.files?.length || 0;
                showToast('✅ 已上传 ' + count + ' 张图片');
                await loadImages();
            } else if (result.canceled) {
                // 用户取消了，什么都不做
            } else {
                showToast('❌ 上传失败');
            }
        } catch (err) {
            showToast('❌ 上传失败: ' + err.message);
        }
    }

    // ===== 新建文件夹 =====
    function openNewFolder() {
        document.getElementById('folderNameInput').value = '';
        document.getElementById('folderError').textContent = '';
        document.getElementById('folderModal').style.display = 'flex';
        setTimeout(() => document.getElementById('folderNameInput').focus(), 100);
    }

    async function confirmNewFolder() {
        const name = document.getElementById('folderNameInput').value.trim();
        if (!name) {
            document.getElementById('folderError').textContent = '请输入文件夹名称';
            return;
        }
        currentSite = getActiveSite();
        if (!currentSite) { showToast('请先选择一个站点'); return; }

        const fullDir = currentDir ? currentDir + '/' + name : name;
        try {
            const result = await window.yolongcms.images.mkdir(currentSite.id, fullDir);
            if (result.success) {
                document.getElementById('folderModal').style.display = 'none';
                showToast('✅ 文件夹已创建');
                await loadImages();
            } else {
                document.getElementById('folderError').textContent = '创建失败: ' + result.error;
            }
        } catch (err) {
            document.getElementById('folderError').textContent = '创建失败: ' + err.message;
        }
    }

    function closeFolderModal() {
        document.getElementById('folderModal').style.display = 'none';
    }

    // ===== 删除 =====
    async function deleteItem(relPath, isDir) {
        currentSite = getActiveSite();
        if (!currentSite) return;

        try {
            const result = await window.yolongcms.images.remove(currentSite.id, 'images/' + relPath);
            if (result.success) {
                showToast('✅ 已删除');
                await loadImages();
            } else {
                showToast('❌ 删除失败: ' + result.error);
            }
        } catch (err) {
            showToast('❌ 删除失败: ' + err.message);
        }
    }

    // ===== 绑定事件 =====
    function bindEvents() {
        document.getElementById('btnUploadImages').addEventListener('click', uploadImages);
        document.getElementById('btnNewFolder').addEventListener('click', openNewFolder);

        document.getElementById('folderModalClose').addEventListener('click', closeFolderModal);
        document.getElementById('folderModalCancel').addEventListener('click', closeFolderModal);
        document.getElementById('folderModalConfirm').addEventListener('click', confirmNewFolder);

        document.getElementById('folderModal').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') confirmNewFolder();
            if (e.key === 'Escape') closeFolderModal();
        });
    }

    // ===== 初始化 =====
    window.init_images = async function () {
        bindEvents();
        await loadImages();
    };
})();
