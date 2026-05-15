// YolongCMS Desktop — 联系方式管理
(function () {
    'use strict';

    const LABELS = ['地址(HEADQUARTERS)', '电话(PHONE)', '邮箱(EMAIL)'];
    const VALUE_KEYS = ['value0', 'value1', 'value2'];

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

    // ===== 从 YAML 填充表单 =====
    function populateForm(data) {
        document.getElementById('contactTitle').value = data.title || '';
        document.getElementById('contactDescription').value = data.description || '';
        document.getElementById('contactBgImage').value = data.bgImage || '';
        document.getElementById('contactMapEmbed').value = data.map?.embedUrl || '';

        const $list = document.getElementById('contactInfoList');
        $list.innerHTML = '';

        const info = data.info || [];
        for (let i = 0; i < 3; i++) {
            const item = info[i] || { label: LABELS[i], value: '' };
            const div = document.createElement('div');
            div.className = 'contact-info-row';
            div.style.cssText = 'border:1px solid var(--border-color);border-radius:var(--radius-md);padding:12px;margin-bottom:12px;';
            div.dataset.idx = i;
            div.innerHTML = `
                <div style="display:flex;gap:8px;margin-bottom:8px;">
                    <div class="form-group" style="flex:0 0 180px;">
                        <label>标签</label>
                        <input type="text" class="form-input contact-label" value="${escapeHtml(item.label || LABELS[i])}">
                    </div>
                    <div class="form-group" style="flex:1;">
                        <label>${escapeHtml(LABELS[i])}</label>
                        <input type="text" class="form-input contact-value" value="${escapeHtml(item.value || '')}" placeholder="输入${escapeHtml(LABELS[i])}">
                    </div>
                </div>
                ${i === 0 ? '<span class="form-hint">例如：328 Xinghu Street, Suzhou Industrial Park, China</span>' : ''}
                ${i === 1 ? '<span class="form-hint">例如：+86 400-888-6688</span>' : ''}
                ${i === 2 ? '<span class="form-hint">例如：sales@yolong.com</span>' : ''}
            `;
            $list.appendChild(div);
        }
    }

    // ===== 从表单收集数据 =====
    function collectForm() {
        const data = {
            title: document.getElementById('contactTitle').value.trim(),
            description: document.getElementById('contactDescription').value.trim(),
            bgImage: document.getElementById('contactBgImage').value.trim(),
            info: [],
        };

        const embedUrl = document.getElementById('contactMapEmbed').value.trim();
        if (embedUrl) {
            data.map = { embedUrl };
        }

        const rows = document.querySelectorAll('#contactInfoList .contact-info-row');
        rows.forEach(row => {
            data.info.push({
                label: row.querySelector('.contact-label').value.trim(),
                value: row.querySelector('.contact-value').value.trim(),
            });
        });

        return data;
    }

    // ===== 默认内容 =====
    function getDefaultData() {
        return {
            title: 'CONTACT US',
            description: 'Get in touch with our sales team or find a dealer near you',
            bgImage: '../images/dealer-network.jpg',
            info: [
                { label: 'HEADQUARTERS', value: '328 Xinghu Street, Suzhou Industrial Park, China' },
                { label: 'PHONE', value: '+86 400-888-6688' },
                { label: 'EMAIL', value: 'sales@yolong.com' },
            ],
            map: {
                embedUrl: 'https://www.openstreetmap.org/export/embed.html?bbox=120.65%2C31.25%2C120.75%2C31.35&amp;layer=mapnik&amp;marker=31.30%2C120.70',
            },
        };
    }

    // ===== 加载数据 =====
    async function load() {
        const site = getSite();
        const $empty = document.getElementById('contactEmpty');
        const $content = document.getElementById('contactContent');

        if (!site) {
            $empty.style.display = 'flex';
            $content.style.display = 'none';
            return;
        }
        $empty.style.display = 'none';
        $content.style.display = 'block';

        try {
            const repoPath = await window.yolongcms.sites.repoPath(site.id);
            const contactPath = repoPath + '/_data/contact.yml';
            const result = await window.yolongcms.yml.read(contactPath);
            if (result.success && result.data) {
                populateForm(result.data);
                showToast('✅ 已加载联系方式');
            } else {
                populateForm(getDefaultData());
                showToast('ℹ️ 未找到 _data/contact.yml，已使用默认内容，保存后自动创建');
            }
        } catch (err) {
            showToast('加载失败，使用默认内容: ' + err.message);
            populateForm(getDefaultData());
        }
    }

    // ===== 保存数据 =====
    async function save() {
        const site = getSite();
        if (!site) { showToast('请先选择一个站点'); return; }

        try {
            const repoPath = await window.yolongcms.sites.repoPath(site.id);
            const contactPath = repoPath + '/_data/contact.yml';
            const data = collectForm();
            await window.yolongcms.yml.write(contactPath, data);
            showToast('✅ 已保存到 _data/contact.yml');
        } catch (err) {
            showToast('保存失败: ' + err.message);
        }
    }

    // ===== 绑定事件 =====
    function bindEvents() {
        document.getElementById('btnContactSave').addEventListener('click', save);
        document.getElementById('btnContactReload').addEventListener('click', load);
    }

    // ===== 初始化 =====
    window.init_contact = async function () {
        bindEvents();
        await load();
    };
    window.addEventListener('siteChanged', () => { load(); });
})();
