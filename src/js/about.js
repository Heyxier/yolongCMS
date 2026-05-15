// YolongCMS Desktop — 关于我们页面管理
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

    // ===== 从 YAML 填充表单 =====
    function populateForm(data) {
        // Hero
        document.getElementById('aboutHeroSubtitle').value = data.hero?.subtitle || '';

        // Profile
        document.getElementById('aboutProfileImage').value = data.profile?.image || '';
        const p = data.profile?.paragraphs || [];
        document.getElementById('aboutProfileP1').value = p[0] || '';
        document.getElementById('aboutProfileP2').value = p[1] || '';

        // Values
        const vals = data.values || [];
        const $vContainer = document.getElementById('aboutValues');
        $vContainer.innerHTML = '';
        vals.forEach((v, i) => {
            const div = document.createElement('div');
            div.className = 'about-value-row';
            div.dataset.idx = i;
            div.style.cssText = 'border:1px solid var(--border-color);border-radius:var(--radius-md);padding:12px;margin-bottom:12px;';
            div.innerHTML = `
                <div style="display:flex;gap:8px;margin-bottom:8px;">
                    <div class="form-group" style="flex:0 0 60px;">
                        <label>序号</label>
                        <input type="text" class="form-input about-val-num" value="${escapeHtml(v.number)}">
                    </div>
                    <div class="form-group" style="flex:1;">
                        <label>标题</label>
                        <input type="text" class="form-input about-val-title" value="${escapeHtml(v.title)}">
                    </div>
                </div>
                <div class="form-group">
                    <label>描述</label>
                    <textarea class="form-input about-val-text" rows="3">${escapeHtml(v.text)}</textarea>
                </div>
            `;
            $vContainer.appendChild(div);
        });

        // Global
        const globals = data.global || [];
        const $gContainer = document.getElementById('aboutGlobal');
        $gContainer.innerHTML = '';
        globals.forEach((g, i) => {
            const div = document.createElement('div');
            div.className = 'about-global-row';
            div.dataset.idx = i;
            div.style.cssText = 'border:1px solid var(--border-color);border-radius:var(--radius-md);padding:12px;margin-bottom:12px;';
            div.innerHTML = `
                <div style="display:flex;gap:8px;margin-bottom:8px;">
                    <div class="form-group" style="flex:0 0 100px;">
                        <label>数字</label>
                        <input type="text" class="form-input about-glb-figure" value="${escapeHtml(g.figure)}">
                    </div>
                    <div class="form-group" style="flex:0 0 80px;">
                        <label>单位</label>
                        <input type="text" class="form-input about-glb-unit" value="${escapeHtml(g.unit || '')}">
                    </div>
                    <div class="form-group" style="flex:1;">
                        <label>标题</label>
                        <input type="text" class="form-input about-glb-title" value="${escapeHtml(g.title)}">
                    </div>
                </div>
                <div class="form-group">
                    <label>描述</label>
                    <textarea class="form-input about-glb-text" rows="3">${escapeHtml(g.text)}</textarea>
                </div>
            `;
            $gContainer.appendChild(div);
        });

        // CTA
        document.getElementById('aboutCtaTitle').value = data.cta?.title || '';
        document.getElementById('aboutCtaDesc').value = data.cta?.description || '';
    }

    // ===== 从表单收集数据 =====
    function collectForm() {
        const data = {};

        data.hero = {
            subtitle: document.getElementById('aboutHeroSubtitle').value.trim(),
        };

        data.profile = {
            image: document.getElementById('aboutProfileImage').value.trim(),
            paragraphs: [
                document.getElementById('aboutProfileP1').value,
                document.getElementById('aboutProfileP2').value,
            ],
        };

        data.values = [];
        document.querySelectorAll('.about-value-row').forEach(row => {
            data.values.push({
                number: row.querySelector('.about-val-num').value.trim(),
                title: row.querySelector('.about-val-title').value.trim(),
                text: row.querySelector('.about-val-text').value.trim(),
            });
        });

        data.global = [];
        document.querySelectorAll('.about-global-row').forEach(row => {
            data.global.push({
                figure: row.querySelector('.about-glb-figure').value.trim(),
                unit: row.querySelector('.about-glb-unit').value.trim(),
                title: row.querySelector('.about-glb-title').value.trim(),
                text: row.querySelector('.about-glb-text').value.trim(),
            });
        });

        data.cta = {
            title: document.getElementById('aboutCtaTitle').value,
            description: document.getElementById('aboutCtaDesc').value.trim(),
        };

        return data;
    }

    // ===== 默认内容 =====
    function getDefaultData() {
        return {
            hero: { subtitle: 'Garden Power Tools &amp; OEM/ODM Solutions Since 2008' },
            profile: {
                image: '../images/cordless-drill-hero.jpg',
                paragraphs: [
                    'Founded in 2008 in Suzhou, Yuanlong Technology specializes in garden power tools (cordless, electric, and gasoline powered) as well as electric power tools including sanding machinery. Our product lines cover lawn mowers, grass trimmers, brush cutters, blower vacs, chain saws, rotary sanders, and finishing sanders.',
                    'With a 13,500 m&sup2; manufacturing facility and over 250 skilled employees, we have an annual production capacity of 1,000,000 pieces. We primarily serve the OEM and ODM markets, exporting to North America, Europe, Australia, and South America &mdash; committed to the principle of <em>&ldquo;great quality, affordable price, win-win cooperation&rdquo;</em>.',
                ],
            },
            values: [
                { number: '01', title: 'GREAT QUALITY', text: 'We uphold rigorous quality standards across all our products. From raw material selection to final assembly, every step is controlled to ensure reliable performance that our global partners can trust.' },
                { number: '02', title: 'AFFORDABLE PRICE', text: 'Through efficient manufacturing and supply chain management, we deliver cost-effective solutions without compromising on quality &mdash; making professional-grade garden tools accessible to markets worldwide.' },
                { number: '03', title: 'WIN-WIN COOPERATION', text: 'We believe in building long-term partnerships based on mutual benefit. Our OEM/ODM services are designed to help our clients grow their business with flexible customization and reliable support.' },
                { number: '04', title: 'CONTINUOUS INNOVATION', text: 'With over 14 years of experience in garden and power tools, our team continuously improves product design, adopts new technologies, and optimizes production processes to stay ahead of market demands.' },
            ],
            global: [
                { figure: '13,500', unit: 'M&sup2;', title: 'Facility', text: 'Modern manufacturing plant located at No.17 Chengtai Road, Taiping Street, Xiangcheng District, Suzhou &mdash; equipped for efficient production of garden and power tools.' },
                { figure: '1M', unit: '', title: 'Annual Capacity', text: 'With an annual production capacity of 1,000,000 pieces, we reliably serve OEM and ODM clients across four continents with consistent quality and timely delivery.' },
                { figure: '250+', unit: '', title: 'Skilled Employees', text: 'A dedicated team of over 250 professionals working together to engineer, manufacture, and deliver high-quality garden power tools to global markets.' },
                { figure: '4', unit: '', title: 'Continents Served', text: 'Our products reach customers in North America, Europe, Australia, and South America, building lasting partnerships through great quality and win-win cooperation.' },
            ],
            cta: {
                title: 'READY TO <span>PARTNER</span> WITH US?',
                description: 'Contact our sales team to learn more about our products, distribution opportunities, and how Yolong can support your business.',
            },
        };
    }

    // ===== 加载数据 =====
    async function load() {
        const site = getSite();
        const $empty = document.getElementById('aboutEmpty');
        const $content = document.getElementById('aboutContent');

        if (!site) {
            $empty.style.display = 'flex';
            $content.style.display = 'none';
            return;
        }
        $empty.style.display = 'none';
        $content.style.display = 'block';

        try {
            const repoPath = await window.yolongcms.sites.repoPath(site.id);
            const aboutPath = repoPath + '/_data/about.yml';
            const result = await window.yolongcms.yml.read(aboutPath);
            if (result.success && result.data) {
                populateForm(result.data);
                showToast('✅ 已加载 About 页面内容');
            } else {
                // 文件不存在，使用默认内容
                populateForm(getDefaultData());
                showToast('ℹ️ 未找到 _data/about.yml，已使用默认内容，保存后自动创建');
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
            const aboutPath = repoPath + '/_data/about.yml';
            const data = collectForm();
            await window.yolongcms.yml.write(aboutPath, data);
            showToast('✅ 已保存到 _data/about.yml');
        } catch (err) {
            showToast('保存失败: ' + err.message);
        }
    }

    // ===== 绑定事件 =====
    function bindEvents() {
        document.getElementById('btnAboutSave').addEventListener('click', save);
        document.getElementById('btnAboutReload').addEventListener('click', load);
    }

    // ===== 初始化 =====
    window.init_about = async function () {
        bindEvents();
        await load();
    };
    window.addEventListener('siteChanged', () => { load(); });
})();
