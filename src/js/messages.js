// YolongCMS Desktop — 留言管理
(function () {
    'use strict';

    // 内存缓存（关闭客户端自动清除）
    let messages = [];
    let currentSite = null;
    let isLoading = false;

    // 默认 API Token（与服务端 CONTACT_ADMIN_TOKEN 默认值一致）
    const DEFAULT_TOKEN = 'yolong-admin-2026';

    function getServerUrl() {
        const site = getActiveSite();
        return site && site.server ? site.server : undefined;
    }

    function getActiveSite() {
        const app = window.__app;
        return app ? app.getCurrentSite() : null;
    }

    // ===== 核心操作 =====

    async function loadMessages() {
        const site = getActiveSite();
        if (!site) {
            showEmpty('请先选择一个站点');
            return;
        }

        currentSite = site;
        isLoading = true;
        showLoading();

        try {
            const serverUrl = getServerUrl();
            const result = await window.yolongcms.server.messages(serverUrl, site.id, DEFAULT_TOKEN);

            isLoading = false;

            if (result.success) {
                messages = result.messages || [];
                renderMessages();
            } else {
                messages = [];
                showEmpty('拉取失败: ' + (result.error || '未知错误'));
            }
        } catch (err) {
            isLoading = false;
            messages = [];
            showEmpty('拉取出错: ' + (err.message || '未知错误'));
        }
    }

    function renderMessages() {
        const $list = document.getElementById('messagesList');
        const $stats = document.getElementById('messagesStats');
        const $empty = document.getElementById('messagesEmpty');
        const $loading = document.getElementById('messagesLoading');

        if (!$list) return;

        // 隐藏 loading
        if ($loading) $loading.style.display = 'none';

        if (!messages.length) {
            $list.innerHTML = '';
            if ($empty) {
                $empty.style.display = 'flex';
                document.getElementById('messagesEmptyText').textContent =
                    currentSite ? '当前站点还没有收到任何留言' : '请先选择一个站点';
            }
            if ($stats) $stats.textContent = '共 0 条留言';
            return;
        }

        if ($empty) $empty.style.display = 'none';
        if ($stats) $stats.textContent = '共 ' + messages.length + ' 条留言';

        let html = '';
        messages.forEach(msg => {
            const date = formatTime(msg.created_at);
            const isRead = msg.read;
            html += `
                <div class="msg-card ${isRead ? '' : 'msg-unread'}" data-id="${msg.id}">
                    <div class="msg-card-main">
                        <div class="msg-card-header">
                            <span class="msg-card-name">${escapeHtml(msg.name)}</span>
                            <span class="msg-card-company">${msg.company ? escapeHtml(msg.company) : ''}</span>
                            <span class="msg-card-time">${date}</span>
                        </div>
                        <div class="msg-card-contact">
                            <span>📧 ${escapeHtml(msg.email)}</span>
                            ${msg.phone ? '<span>📞 ' + escapeHtml(msg.phone) + '</span>' : ''}
                        </div>
                        <div class="msg-card-preview">${escapeHtml(msg.message).substring(0, 120)}${msg.message.length > 120 ? '...' : ''}</div>
                    </div>
                    <div class="msg-card-actions">
                        <button class="btn btn-sm btn-primary-outline msg-btn-view" data-id="${msg.id}">查看</button>
                        <button class="btn btn-sm btn-danger-outline msg-btn-delete" data-id="${msg.id}">删除</button>
                    </div>
                </div>
            `;
        });

        $list.innerHTML = html;

        // 绑定事件
        $list.querySelectorAll('.msg-btn-view').forEach(btn => {
            btn.addEventListener('click', () => {
                const msg = messages.find(m => m.id === parseInt(btn.dataset.id));
                if (msg) viewMessage(msg);
            });
        });
        $list.querySelectorAll('.msg-btn-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                deleteMessage(parseInt(btn.dataset.id));
            });
        });
    }

    // ===== 删除留言 =====

    async function deleteMessage(msgId) {
        if (!confirm('确认删除此留言？不可撤销！')) return;

        const site = getActiveSite();
        if (!site) return;

        const serverUrl = getServerUrl();
        const result = await window.yolongcms.server.deleteMessage(serverUrl, msgId, DEFAULT_TOKEN);

        if (result.success) {
            showToast('✅ 留言已删除');
            // 从缓存移除
            messages = messages.filter(m => m.id !== msgId);
            renderMessages();
        } else {
            showToast('❌ 删除失败: ' + (result.error || '未知错误'));
        }
    }

    // ===== 查看详情 =====

    function viewMessage(msg) {
        document.getElementById('mdName').textContent = msg.name || '-';
        document.getElementById('mdCompany').textContent = msg.company || '-';
        document.getElementById('mdEmail').textContent = msg.email || '-';
        document.getElementById('mdPhone').textContent = msg.phone || '-';
        document.getElementById('mdTime').textContent = formatTime(msg.created_at) || '-';
        document.getElementById('mdMessage').textContent = msg.message || '';
        document.getElementById('messageDetailModal').style.display = 'flex';
    }

    function closeDetailModal() {
        document.getElementById('messageDetailModal').style.display = 'none';
    }

    // ===== 工具函数 =====

    function formatTime(iso) {
        if (!iso) return '';
        try {
            const d = new Date(iso);
            const pad = n => String(n).padStart(2, '0');
            return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
                + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
        } catch {
            return iso;
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function showEmpty(msg) {
        const $list = document.getElementById('messagesList');
        const $empty = document.getElementById('messagesEmpty');
        const $loading = document.getElementById('messagesLoading');
        if ($list) $list.innerHTML = '';
        if ($loading) $loading.style.display = 'none';
        if ($empty) {
            $empty.style.display = 'flex';
            const p = $empty.querySelector('p');
            if (p) p.textContent = msg || '暂无留言';
        }
    }

    function showLoading() {
        const $loading = document.getElementById('messagesLoading');
        const $empty = document.getElementById('messagesEmpty');
        if ($empty) $empty.style.display = 'none';
        if ($loading) $loading.style.display = 'flex';
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

    // ===== 事件绑定 =====

    function bindEvents() {
        // 刷新按钮
        document.getElementById('btnRefreshMessages').addEventListener('click', () => {
            showToast('🔄 正在刷新...');
            loadMessages();
        });

        // 详情弹窗关闭
        document.getElementById('messageDetailClose').addEventListener('click', closeDetailModal);
        document.getElementById('messageDetailCancel').addEventListener('click', closeDetailModal);
        document.getElementById('messageDetailModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeDetailModal();
        });

        // 切换站点时自动拉取
        window.addEventListener('siteChanged', () => {
            const site = getActiveSite();
            if (site && site.id !== (currentSite ? currentSite.id : null)) {
                messages = [];
                loadMessages();
            }
        });
    }

    // ===== 初始化 =====

    window.init_messages = async function () {
        bindEvents();
        await loadMessages();
    };

})();
