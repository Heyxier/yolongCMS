// YolongCMS Desktop — 产品管理
(function () {
    'use strict';

    let currentSite = null;
    let products = [];        // 完整产品列表
    let categories = [];      // 所有用到的分类
    let editingFile = null;   // 正在编辑的文件名（null=新增）
    let formCache = {};

    // ===== 工具函数 =====
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

    // 解析数组字段（每行一条）
    function parseLines(text) {
        if (!text || !text.trim()) return [];
        return text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    }

    function formatLines(arr) {
        if (!arr || !arr.length) return '';
        return arr.join('\n');
    }

    // ===== 加载产品列表 =====
    async function loadProducts() {
        currentSite = getActiveSite();
        if (!currentSite) {
            showEmpty('请先选择一个站点');
            return;
        }
        try {
            const result = await window.yolongcms.products.list(currentSite.id);
            if (result.success) {
                products = result.files.sort((a, b) => b.mtime - a.mtime);
                // 提取所有分类
                const catSet = new Set();
                products.forEach(p => { if (p.category) catSet.add(p.category); });
                categories = Array.from(catSet).sort();
                renderCategoryFilter();
                renderProducts();
            } else {
                showEmpty('加载失败: ' + result.error);
            }
        } catch (err) {
            showEmpty('加载失败: ' + err.message);
        }
    }

    function showEmpty(msg) {
        const $list = document.getElementById('productList');
        const $empty = document.getElementById('productEmpty');
        if ($empty) {
            $empty.style.display = 'flex';
            $empty.querySelector('p').textContent = msg || '暂无产品';
        }
        if ($list) $list.innerHTML = '';
    }

    // ===== 渲染分类筛选 =====
    function renderCategoryFilter() {
        const $sel = document.getElementById('filterCategory');
        const current = $sel.value;
        $sel.innerHTML = '<option value="">全部</option>';
        categories.forEach(c => {
            $sel.innerHTML += '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + '</option>';
        });
        $sel.value = current;
    }

    // ===== 渲染产品列表 =====
    function renderProducts() {
        const $list = document.getElementById('productList');
        const $empty = document.getElementById('productEmpty');
        const $stats = document.getElementById('productStats');

        const filterCat = document.getElementById('filterCategory').value;
        const filterStatus = document.getElementById('filterStatus').value;
        const filterSearch = document.getElementById('filterSearch').value.toLowerCase().trim();

        let filtered = products.filter(p => {
            if (filterCat && p.category !== filterCat) return false;
            if (filterStatus !== '' && (p.status === undefined || String(p.status) !== filterStatus)) return false;
            if (filterSearch) {
                const name = (p.name || p.title || '').toLowerCase();
                const model = (p.model || '').toLowerCase();
                if (!name.includes(filterSearch) && !model.includes(filterSearch)) return false;
            }
            return true;
        });

        $stats.textContent = '共 ' + filtered.length + ' / ' + products.length + ' 个产品';

        if (!filtered.length) {
            $empty.style.display = 'flex';
            $empty.querySelector('p').textContent = products.length ? '没有匹配的产品' : '暂无产品，点击"添加产品"开始';
            $list.innerHTML = '';
            return;
        }
        $empty.style.display = 'none';

        let html = '';
        filtered.forEach(p => {
            const isActive = p.status !== false; // undefined 或 true 视为上架
            html += '<div class="product-card">';
            html += '  <div class="product-info">';
            html += '    <div class="product-model">' + escapeHtml(p.model || p.slug) + '</div>';
            html += '    <div class="product-name">' + escapeHtml(p.title || p.name || p.slug) + '</div>';
            html += '    <div class="product-meta">';
            if (p.category) html += '      <span class="product-tag">' + escapeHtml(p.category) + '</span>';
            html += '      <span class="product-status ' + (isActive ? 'status-on' : 'status-off') + '">' + (isActive ? '上架' : '下架') + '</span>';
            html += '    </div>';
            html += '  </div>';
            html += '  <div class="product-actions">';
            html += '    <button class="btn btn-primary-outline btn-sm" data-file="' + escapeHtml(p.name) + '" data-action="edit">编辑</button>';
            html += '    <button class="btn btn-danger-outline btn-sm" data-file="' + escapeHtml(p.name) + '" data-action="delete">删除</button>';
            html += '  </div>';
            html += '</div>';
        });
        $list.innerHTML = html;

        // 绑定事件
        $list.querySelectorAll('[data-action="edit"]').forEach(btn => {
            btn.addEventListener('click', () => openEdit(btn.dataset.file));
        });
        $list.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', () => deleteProduct(btn.dataset.file));
        });
    }

    // ===== 打开编辑弹窗 =====
    async function openEdit(filename) {
        editingFile = filename;
        document.getElementById('modalProductTitle').textContent = '编辑产品';
        document.getElementById('modalProductSave').textContent = '保存';

        try {
            const result = await window.yolongcms.products.read(currentSite.id, filename);
            if (!result.success) {
                showToast('读取失败: ' + result.error);
                return;
            }
            const d = result.data || {};
            fillForm(d, result.content || '');
            showModal();
        } catch (err) {
            showToast('读取失败: ' + err.message);
        }
    }

    // ===== 打开新增弹窗 =====
    function openAdd() {
        editingFile = null;
        document.getElementById('modalProductTitle').textContent = '添加产品';
        document.getElementById('modalProductSave').textContent = '添加';
        fillForm({ status: true }, '');
        showModal();
    }

    // ===== 填充表单 =====
    function fillForm(data, body) {
        document.getElementById('pfModel').value = data.model || '';
        document.getElementById('pfName').value = data.name || data.title || '';
        document.getElementById('pfCategory').value = data.category || '';
        document.getElementById('pfStatus').checked = data.status !== false;
        updateStatusText();
        document.getElementById('pfVoltage').value = data.voltage || '';
        document.getElementById('pfTorque').value = data.torque || '';
        document.getElementById('pfMotorType').value = data.motorType || '';
        document.getElementById('pfImage').value = data.image || '';
        document.getElementById('pfDescription').value = data.description || '';
        document.getElementById('pfFeatures').value = formatLines(data.features);
        document.getElementById('pfAccessories').value = formatLines(data.accessories);
        document.getElementById('pfBody').value = body || '';
        document.getElementById('pfError').textContent = '';
    }

    // ===== 收集表单数据 =====
    function collectForm() {
        const data = {
            model: document.getElementById('pfModel').value.trim(),
            name: document.getElementById('pfName').value.trim(),
            category: document.getElementById('pfCategory').value.trim(),
            status: document.getElementById('pfStatus').checked,
            voltage: document.getElementById('pfVoltage').value.trim(),
            torque: document.getElementById('pfTorque').value.trim(),
            motorType: document.getElementById('pfMotorType').value,
            image: document.getElementById('pfImage').value.trim(),
            description: document.getElementById('pfDescription').value.trim(),
            features: parseLines(document.getElementById('pfFeatures').value),
            accessories: parseLines(document.getElementById('pfAccessories').value),
        };
        const body = document.getElementById('pfBody').value;
        return { data, body };
    }

    // ===== 校验表单 =====
    function validateForm(data) {
        const errors = [];
        if (!data.model) errors.push('型号不能为空');
        if (!data.name) errors.push('产品名称不能为空');
        if (!data.category) errors.push('分类不能为空');
        return errors;
    }

    // ===== 保存产品 =====
    async function saveProduct() {
        const { data, body } = collectForm();
        const errors = validateForm(data);
        if (errors.length) {
            document.getElementById('pfError').textContent = errors.join('；');
            return;
        }

        // 文件名：model + .md
        const filename = data.model + '.md';

        // 检查重名（新增模式下）
        if (!editingFile) {
            const exists = products.some(p => p.name === filename);
            if (exists) {
                document.getElementById('pfError').textContent = '型号 "' + data.model + '" 已存在，请使用不同型号';
                return;
            }
        }

        // 保存到文件
        try {
            const result = await window.yolongcms.products.write(
                currentSite.id,
                editingFile || filename,
                data,
                body
            );
            if (result.success) {
                showToast(editingFile ? '✅ 产品已更新' : '✅ 产品已添加');
                closeModal();
                await loadProducts();
                // 记录日志
                if (window.yolongcms.log) {
                    window.yolongcms.log.append('info', 'sites', (editingFile ? '产品已更新: ' : '产品已添加: ') + data.model,
                        { siteId: currentSite.id, model: data.model, filename: editingFile || filename });
                }
            } else {
                document.getElementById('pfError').textContent = '保存失败: ' + result.error;
            }
        } catch (err) {
            document.getElementById('pfError').textContent = '保存失败: ' + err.message;
        }
    }

    // ===== 删除产品 =====
    async function deleteProduct(filename) {
        if (!confirm('确认删除产品 "' + filename.replace(/\.md$/, '') + '"？此操作不可撤销！')) return;
        try {
            const result = await window.yolongcms.products.remove(currentSite.id, filename);
            if (result.success) {
                showToast('✅ 产品已删除');
                await loadProducts();
            } else {
                showToast('❌ 删除失败: ' + result.error);
            }
        } catch (err) {
            showToast('❌ 删除失败: ' + err.message);
        }
    }

    // ===== 弹窗控制 =====
    function showModal() {
        document.getElementById('productModal').style.display = 'flex';
    }

    function closeModal() {
        document.getElementById('productModal').style.display = 'none';
        editingFile = null;
    }

    function updateStatusText() {
        const checked = document.getElementById('pfStatus').checked;
        document.getElementById('pfStatusText').textContent = checked ? '上架' : '下架';
    }

    // ===== 下载 Excel 模板 =====
    async function downloadTemplate() {
        try {
            const result = await window.yolongcms.products.exportTemplate();
            if (result.success) {
                showToast('✅ 模板已保存');
            } else if (!result.canceled) {
                showToast('❌ 下载失败: ' + (result.error || '未知错误'));
            }
        } catch (err) {
            showToast('❌ 下载失败: ' + err.message);
        }
    }

    // ===== 导入 Excel =====
    async function importExcel() {
        currentSite = getActiveSite();
        if (!currentSite) { showToast('请先选择一个站点'); return; }

        try {
            const result = await window.yolongcms.products.importExcel(currentSite.id);
            if (result.canceled) return;

            if (result.success) {
                const msg = '✅ 导入完成: ' + result.success + ' 成功';
                const failMsg = result.failed > 0 ? ', ' + result.failed + ' 失败' : '';
                showToast(msg + failMsg);

                // 如果有失败，显示详情
                if (result.errors && result.errors.length > 0) {
                    // 前 5 条错误
                    const errPreview = result.errors.slice(0, 5).join('\n');
                    const more = result.errors.length > 5 ? '\n...还有 ' + (result.errors.length - 5) + ' 条错误' : '';
                    alert('导入结果\n\n成功: ' + result.success + '\n失败: ' + result.failed + '\n\n错误详情:\n' + errPreview + more);
                }

                await loadProducts();
            } else {
                showToast('❌ 导入失败: ' + (result.error || '未知错误'));
            }
        } catch (err) {
            showToast('❌ 导入失败: ' + err.message);
        }
    }

    // ===== 绑定事件 =====
    function bindEvents() {
        document.getElementById('btnAddProduct').addEventListener('click', openAdd);
        document.getElementById('btnDownloadTemplate').addEventListener('click', downloadTemplate);
        document.getElementById('btnImportExcel').addEventListener('click', importExcel);
        document.getElementById('modalProductClose').addEventListener('click', closeModal);
        document.getElementById('modalProductCancel').addEventListener('click', closeModal);
        document.getElementById('modalProductSave').addEventListener('click', saveProduct);

        document.getElementById('pfStatus').addEventListener('change', updateStatusText);

        // 筛选
        document.getElementById('filterCategory').addEventListener('change', renderProducts);
        document.getElementById('filterStatus').addEventListener('change', renderProducts);
        document.getElementById('filterSearch').addEventListener('input', renderProducts);

        // 弹窗回车提交
        document.getElementById('productModal').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') saveProduct();
            if (e.key === 'Escape') closeModal();
        });
    }

    // ===== 初始化 =====
    window.init_products = async function () {
        bindEvents();
        await loadProducts();
    };

    // 站点切换时刷新
    window.addEventListener('siteChanged', () => {
        loadProducts();
    });
})();
