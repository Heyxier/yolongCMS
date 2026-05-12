// YolongCMS Desktop — 设置管理
(function () {
    'use strict';

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

    function escapeHtml(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    let configData = null;
    let tokenVisible = false;
    let isSetupMode = false;

    async function loadConfig() {
        try {
            configData = await window.yolongcms.config.read();
            return configData;
        } catch {
            return null;
        }
    }

    async function refresh() {
        const config = await loadConfig();
        if (!config) return;

        // 检测是否为首次设置
        const urlParams = new URLSearchParams(window.location.search);
        isSetupMode = urlParams.get('setup') === '1' || !config.setupComplete;

        const $welcome = document.getElementById('settingsWelcome');
        if (isSetupMode) {
            $welcome.style.display = 'block';
        } else {
            $welcome.style.display = 'none';
        }

        // GitHub Token
        const $token = document.getElementById('settingsGithubToken');
        if (config.githubToken) {
            $token.value = config.githubToken;
        }
        updateTokenVisibility();

        // GitHub 用户名
        document.getElementById('settingsGithubUser').value = config.githubUsername || '';

        // GitHub 状态
        const $status = document.getElementById('githubStatus');
        if (config.githubToken && config.githubToken.length > 10) {
            const hint = config.githubToken.substring(0, 8) + '...' + config.githubToken.slice(-4);
            $status.textContent = '✅ 已配置';
            $status.style.color = 'var(--success)';
        } else {
            $status.textContent = '⚪ 未配置';
            $status.style.color = 'var(--text-secondary)';
        }

        // 默认站点
        const $siteSelect = document.getElementById('settingsDefaultSite');
        const sites = window.__app ? window.__app.getAllSites() : [];
        $siteSelect.innerHTML = '<option value="">— 不设置默认 —</option>';
        if (sites && sites.length) {
            sites.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.textContent = s.name + ' (' + s.id + ')';
                if (s.id === config.defaultSiteId) opt.selected = true;
                $siteSelect.appendChild(opt);
            });
        }
    }

    function updateTokenVisibility() {
        const $token = document.getElementById('settingsGithubToken');
        $token.type = tokenVisible ? 'text' : 'password';
        document.getElementById('btnToggleToken').textContent = tokenVisible ? '🙈' : '👁️';
    }

    async function saveSettings() {
        const token = document.getElementById('settingsGithubToken').value.trim();
        const username = document.getElementById('settingsGithubUser').value.trim();
        const defaultSiteId = document.getElementById('settingsDefaultSite').value || null;

        if (!token) {
            showToast('⚠️ GitHub Token 不能为空');
            return;
        }

        try {
            const oldConfig = await loadConfig();
            const newConfig = {
                ...oldConfig,
                githubToken: token,
                githubUsername: username,
                defaultSiteId: defaultSiteId,
                setupComplete: true,
            };
            await window.yolongcms.config.write(newConfig);
            configData = newConfig;

            document.getElementById('settingsResult').style.display = 'block';
            document.getElementById('settingsResult').className = 'settings-result settings-result-success';
            document.getElementById('settingsResult').textContent = '✅ 设置已保存！';

            // 如果走的是设置向导，跳转到仪表盘
            if (isSetupMode) {
                setTimeout(() => {
                    if (window.__app) window.__app.loadPage('dashboard');
                }, 1500);
            }

            showToast('💾 设置已保存');
            refresh();
        } catch (err) {
            document.getElementById('settingsResult').style.display = 'block';
            document.getElementById('settingsResult').className = 'settings-result settings-result-error';
            document.getElementById('settingsResult').textContent = '❌ 保存失败: ' + escapeHtml(err.message);
        }
    }

    async function testGithub() {
        const token = document.getElementById('settingsGithubToken').value.trim();
        if (!token) { showToast('⚠️ 请先输入 Token'); return; }

        const $result = document.getElementById('settingsResult');
        $result.style.display = 'block';
        $result.className = 'settings-result settings-result-info';
        $result.innerHTML = '⏳ 正在测试连接...';

        try {
            // 用 fetch 测试 GitHub API
            const resp = await fetch('https://api.github.com/user', {
                headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github.v3+json' },
            });
            if (resp.ok) {
                const user = await resp.json();
                $result.className = 'settings-result settings-result-success';
                $result.innerHTML = '✅ 连接成功！GitHub 用户: <strong>' + escapeHtml(user.login) + '</strong>';
                // 自动填入用户名
                if (!document.getElementById('settingsGithubUser').value) {
                    document.getElementById('settingsGithubUser').value = user.login;
                }
                showToast('🔗 GitHub 连接成功');
            } else if (resp.status === 401) {
                $result.className = 'settings-result settings-result-error';
                $result.innerHTML = '❌ Token 无效（401 Unauthorized），请检查 Token 是否正确';
            } else {
                const err = await resp.text();
                $result.className = 'settings-result settings-result-error';
                $result.innerHTML = '❌ 连接失败 (' + resp.status + '): ' + escapeHtml(err.substring(0, 200));
            }
        } catch (err) {
            $result.className = 'settings-result settings-result-error';
            $result.innerHTML = '❌ 网络错误: ' + escapeHtml(err.message || '无法连接到 GitHub');
        }
    }

    function bindEvents() {
        document.getElementById('btnSaveSettings').addEventListener('click', saveSettings);
        document.getElementById('btnTestGithub').addEventListener('click', testGithub);
        document.getElementById('btnToggleToken').addEventListener('click', () => {
            tokenVisible = !tokenVisible;
            updateTokenVisibility();
        });
    }

    window.init_settings = async function () { bindEvents(); await refresh(); };
    window.addEventListener('siteChanged', () => { refresh(); });
})();
