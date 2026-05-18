// YolongCMS Desktop — 关于我们管理（中英双语）
(function () {
    'use strict';

    let currentLang = 'en';

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
    function langFile() { return currentLang === 'zh' ? 'zh_about.yml' : 'about.yml'; }

    function setLang(lang) {
        currentLang = lang;
        document.querySelectorAll('#aboutContent .lang-tab').forEach(tab => {
            if (tab.dataset.lang === lang) {
                tab.style.background = 'var(--accent-500)'; tab.style.color = '#fff'; tab.style.fontWeight = '600';
            } else {
                tab.style.background = 'transparent'; tab.style.color = 'var(--text-primary)'; tab.style.fontWeight = '500';
            }
        });
        load();
    }

    function populateForm(data) {
        document.getElementById('aboutHeroSubtitle').value = data.hero?.subtitle || '';

        document.getElementById('aboutProfileImage').value = data.profile?.image || '';
        const p = data.profile?.paragraphs || [];
        document.getElementById('aboutProfileP1').value = p[0] || '';
        document.getElementById('aboutProfileP2').value = p[1] || '';

        // Values
        const vals = data.values || [];
        const $vC = document.getElementById('aboutValues');
        $vC.innerHTML = '';
        vals.forEach((v, i) => {
            const div = document.createElement('div');
            div.className = 'about-value-row';
            div.dataset.idx = i;
            div.style.cssText = 'border:1px solid var(--border-color);border-radius:var(--radius-md);padding:12px;margin-bottom:12px;';
            div.innerHTML = `
                <div style="display:flex;gap:8px;margin-bottom:8px;">
                    <div class="form-group" style="flex:0 0 60px;"><label>序号</label><input type="text" class="form-input about-val-num" value="${escapeHtml(v.number)}"></div>
                    <div class="form-group" style="flex:1;"><label>标题</label><input type="text" class="form-input about-val-title" value="${escapeHtml(v.title)}"></div>
                </div>
                <div class="form-group"><label>描述</label><textarea class="form-input about-val-text" rows="3">${escapeHtml(v.text)}</textarea></div>
            `;
            $vC.appendChild(div);
        });

        // Global
        const globals = data.global || [];
        const $gC = document.getElementById('aboutGlobal');
        $gC.innerHTML = '';
        globals.forEach((g, i) => {
            const div = document.createElement('div');
            div.className = 'about-global-row';
            div.dataset.idx = i;
            div.style.cssText = 'border:1px solid var(--border-color);border-radius:var(--radius-md);padding:12px;margin-bottom:12px;';
            div.innerHTML = `
                <div style="display:flex;gap:8px;margin-bottom:8px;">
                    <div class="form-group" style="flex:0 0 100px;"><label>数字</label><input type="text" class="form-input about-glb-figure" value="${escapeHtml(g.figure)}"></div>
                    <div class="form-group" style="flex:0 0 80px;"><label>单位</label><input type="text" class="form-input about-glb-unit" value="${escapeHtml(g.unit || '')}"></div>
                    <div class="form-group" style="flex:1;"><label>标题</label><input type="text" class="form-input about-glb-title" value="${escapeHtml(g.title)}"></div>
                </div>
                <div class="form-group"><label>描述</label><textarea class="form-input about-glb-text" rows="3">${escapeHtml(g.text)}</textarea></div>
            `;
            $gC.appendChild(div);
        });

        document.getElementById('aboutCtaTitle').value = data.cta?.title || '';
        document.getElementById('aboutCtaDesc').value = data.cta?.description || '';
    }

    function collectForm() {
        const data = {};
        data.hero = { subtitle: document.getElementById('aboutHeroSubtitle').value.trim() };
        data.profile = {
            image: document.getElementById('aboutProfileImage').value.trim(),
            paragraphs: [document.getElementById('aboutProfileP1').value, document.getElementById('aboutProfileP2').value],
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

    function getDefaultData() {
        if (currentLang === 'zh') {
            return {
                hero: { subtitle: '自2008年起专业提供电动工具及OEM/ODM解决方案' },
                profile: {
                    image: '../images/building.jpg',
                    paragraphs: [
                        '园龙科技成立于2008年，总部位于苏州，专注于园林电动工具（无绳、电动及汽油动力）以及电动工具（包括砂光机械）的研发与制造。我们的产品线涵盖割草机、草坪修剪机、割灌机、吹吸风机、链锯、砂光机、电钻、冲击扳手、电锤、切割机及工作灯等。',
                        '公司拥有13,500平方米的生产基地和250多名熟练员工，年产能达100万件。我们主要服务于OEM和ODM市场，产品远销北美、欧洲、澳洲和南美洲，始终秉持"高品质、优价格、合作共赢"的经营理念。',
                    ],
                },
                values: [
                    { number: '01', title: '卓越品质', text: '我们对所有产品坚持严格的质量标准。从原材料选择到最终组装，每一个环节都受到严格控制，确保产品性能可靠，值得全球合作伙伴信赖。' },
                    { number: '02', title: '价格实惠', text: '通过高效的生产制造和供应链管理，我们在不牺牲品质的前提下提供高性价比的解决方案，让专业级园林工具惠及全球市场。' },
                    { number: '03', title: '合作共赢', text: '我们坚信建立在互利基础上的长期合作伙伴关系。我们的OEM/ODM服务旨在通过灵活的定制和可靠的支持，帮助客户拓展业务。' },
                    { number: '04', title: '持续创新', text: '凭借在园林和电动工具领域超过14年的经验，我们的团队不断改进产品设计、采用新技术、优化生产流程，以保持市场领先地位。' },
                ],
                global: [
                    { figure: '13,500', unit: '平方米', title: '生产基地', text: '现代化制造工厂位于苏州市相城区太平街道陈泰路17号，配备高效生产园林及电动工具的先进设备。' },
                    { figure: '1M', unit: '', title: '年产能', text: '年产量达100万件，以稳定的品质和及时的交付，可靠地服务于四大洲的OEM和ODM客户。' },
                    { figure: '250+', unit: '', title: '熟练员工', text: '一支由250多名专业人员组成的敬业团队，齐心协力设计、制造和交付高品质的园林动力工具到全球市场。' },
                    { figure: '4', unit: '', title: '服务大洲', text: '我们的产品远销北美、欧洲、澳洲和南美洲，通过卓越的品质和合作共赢的理念建立了持久的合作伙伴关系。' },
                ],
                cta: { title: '准备好了吗？<span>与园龙合作</span>', description: '联系我们的销售团队，了解更多产品信息、经销机会以及园龙如何支持您的业务发展。' },
            };
        }
        return {
            hero: { subtitle: 'Power Tools &amp; OEM/ODM Solutions Since 2008' },
            profile: {
                image: '../images/building.jpg',
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
            cta: { title: 'READY TO <span>PARTNER</span> WITH US?', description: 'Contact our sales team to learn more about our products, distribution opportunities, and how Yolong can support your business.' },
        };
    }

    async function load() {
        const site = getSite();
        const $empty = document.getElementById('aboutEmpty');
        const $content = document.getElementById('aboutContent');
        if (!site) { $empty.style.display = 'flex'; $content.style.display = 'none'; return; }
        $empty.style.display = 'none'; $content.style.display = 'block';

        try {
            const repoPath = await window.yolongcms.sites.repoPath(site.id);
            const path = repoPath + '/_data/' + langFile();
            const result = await window.yolongcms.yml.read(path);
            if (result.success && result.data) { populateForm(result.data); showToast('✅ 已加载 ' + langFile()); }
            else { populateForm(getDefaultData()); showToast('ℹ️ 未找到 ' + langFile() + '，已使用默认内容'); }
        } catch (err) { showToast('加载失败: ' + err.message); populateForm(getDefaultData()); }
    }

    async function save() {
        const site = getSite();
        if (!site) { showToast('请先选择一个站点'); return; }
        try {
            const repoPath = await window.yolongcms.sites.repoPath(site.id);
            await window.yolongcms.yml.write(repoPath + '/_data/' + langFile(), collectForm());
            showToast('✅ 已保存到 _data/' + langFile());
        } catch (err) { showToast('保存失败: ' + err.message); }
    }

    function bindEvents() {
        document.getElementById('btnAboutSave').addEventListener('click', save);
        document.getElementById('btnAboutReload').addEventListener('click', load);
        document.querySelectorAll('#aboutContent .lang-tab').forEach(tab => {
            tab.addEventListener('click', () => { if (tab.dataset.lang !== currentLang) setLang(tab.dataset.lang); });
        });
    }

    window.init_about = async function () { bindEvents(); await load(); };
    window.addEventListener('siteChanged', () => { load(); });
})();
