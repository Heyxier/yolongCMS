// YolongCMS Desktop — 操作日志查看
(function () {
    'use strict';

    let filter = { limit: 200 };

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // 格式化时间
    function formatTime(iso) {
        if (!iso) return '—';
        const d = new Date(iso);
        const pad = n => String(n).padStart(2, '0');
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
            + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    }

    // 获取级别标签
    function levelBadge(level) {
        const map = {
            info: '<span class="badge badge-info">信息</span>',
            warn: '<span class="badge badge-warn">警告</span>',
            error: '<span class="badge badge-error">错误</span>',
        };
        return map[level] || '<span class="badge">' + escapeHtml(level) + '</span>';
    }

    // 获取来源标签
    function sourceTag(source) {
        const colors = {
            system: '#8b5cf6',
            sites: '#1a8cff',
            git: '#22c55e',
            server: '#f59e0b',
            app: '#ec4899',
        };
        const color = colors[source] || '#8b8fa3';
        return '<span class="source-tag" style="color:' + color + '">● ' + escapeHtml(source) + '</span>';
    }

    // 渲染详情列
    function detailCell(entry) {
        if (!entry.details) return '<span class="detail-empty">—</span>';
        let text;
        try {
            text = typeof entry.details === 'string' ? entry.details : JSON.stringify(entry.details, null, 2);
        } catch { text = String(entry.details); }
        return '<span class="detail-toggle" data-id="' + entry.id + '">📄 查看</span>'
            + '<pre class="detail-json" id="detail-' + entry.id + '" style="display:none;">' + escapeHtml(text) + '</pre>';
    }

    // 渲染日志列表
    async function renderLogs() {
        const $body = document.getElementById('logBody');
        const $stats = document.getElementById('logStats');
        if (!$body) return;

        try {
            const result = await window.yolongcms.log.list(filter);
            const entries = result.entries || [];
            const total = result.total || 0;

            $stats.textContent = '共 ' + total + ' 条' + (filter.level ? '（已筛选）' : '');

            if (!entries.length) {
                $body.innerHTML = '<tr><td colspan="5" class="log-empty">暂无日志记录</td></tr>';
                return;
            }

            let html = '';
            entries.forEach(entry => {
                html += '<tr class="log-row log-row-' + entry.level + '">';
                html += '<td class="col-time">' + formatTime(entry.timestamp) + '</td>';
                html += '<td class="col-level">' + levelBadge(entry.level) + '</td>';
                html += '<td class="col-source">' + sourceTag(entry.source) + '</td>';
                html += '<td class="col-msg">' + escapeHtml(entry.message) + '</td>';
                html += '<td class="col-detail">' + detailCell(entry) + '</td>';
                html += '</tr>';
            });
            $body.innerHTML = html;

            // 绑定详情展开
            $body.querySelectorAll('.detail-toggle').forEach(el => {
                el.addEventListener('click', () => {
                    const id = el.dataset.id;
                    const $pre = document.getElementById('detail-' + id);
                    if ($pre) {
                        const isHidden = $pre.style.display === 'none';
                        $pre.style.display = isHidden ? 'block' : 'none';
                        el.textContent = isHidden ? '📂 收起' : '📄 查看';
                    }
                });
            });
        } catch (err) {
            console.error('[YolongCMS] renderLogs error:', err);
            document.getElementById('logBody').innerHTML = '<tr><td colspan="5" class="log-empty">加载日志失败: ' + escapeHtml(err.message) + '</td></tr>';
        }
    }

    // 清空日志
    async function clearLogs() {
        if (!confirm('确定要清空所有操作日志吗？此操作不可撤销。')) return;
        try {
            await window.yolongcms.log.clear();
            renderLogs();
        } catch (err) {
            alert('清空失败: ' + err.message);
        }
    }

    // 绑定事件
    function bindEvents() {
        document.getElementById('btnRefreshLogs').addEventListener('click', renderLogs);
        document.getElementById('btnClearLogs').addEventListener('click', clearLogs);

        document.getElementById('filterLevel').addEventListener('change', () => {
            filter.level = document.getElementById('filterLevel').value || undefined;
            renderLogs();
        });
        document.getElementById('filterSource').addEventListener('change', () => {
            filter.source = document.getElementById('filterSource').value || undefined;
            renderLogs();
        });
    }

    // 初始化
    window.init_logs = async function () {
        bindEvents();
        await renderLogs();
    };
})();
