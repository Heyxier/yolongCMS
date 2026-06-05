// YolongCMS Desktop — 联系方式管理（单语：中文）
(function () {
    'use strict';

    const LABELS = ['总部地址', '电话', '邮箱'];
    const LANG_FILE = 'zh_contact.yml';

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
        document.getElementById('contactLat').value = data.lat || '';
        document.getElementById('contactLon').value = data.lon || '';

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
                        <input type="text" class="form-input contact-value" value="${escapeHtml(item.value || '')}" placeholder="输入${LABELS[i]}">
                    </div>
                </div>
                ${i === 0 ? '<span class="form-hint">例如：苏州市相城区太平街道澄太路17号</span>' : ''}
                ${i === 1 ? '<span class="form-hint">例如：+86 0512-69577857-808</span>' : ''}
                ${i === 2 ? '<span class="form-hint">例如：sale1@yolongtec.com</span>' : ''}
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

        const lat = parseFloat(document.getElementById('contactLat').value.trim());
        const lon = parseFloat(document.getElementById('contactLon').value.trim());
        if (!isNaN(lat) && !isNaN(lon)) {
            data.lat = lat;
            data.lon = lon;
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
            title: '联系我们',
            description: '联系我们的销售团队或查找您附近的经销商',
            bgImage: '../images/dealer-network.jpg',
            info: [
                { label: '总部地址', value: '17 Chengtai road, Taiping street, Xiangcheng district, Suzhou, Jiangsu, China' },
                { label: '电话', value: '+86 0512-69577857-808' },
                { label: '邮箱', value: 'sale1@yolongtec.com' },
            ],
            lat: 31.42,
            lon: 120.69,
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
            const contactPath = repoPath + '/_data/' + LANG_FILE;
            const result = await window.yolongcms.yml.read(contactPath);
            if (result.success && result.data) {
                populateForm(result.data);
                showToast('✅ 已加载 ' + LANG_FILE);
            } else {
                populateForm(getDefaultData());
                showToast('ℹ️ 未找到 ' + LANG_FILE + '，已使用默认内容');
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
            const contactPath = repoPath + '/_data/' + LANG_FILE;
            const data = collectForm();
            await window.yolongcms.yml.write(contactPath, data);
            showToast('✅ 已保存到 _data/' + LANG_FILE);
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
