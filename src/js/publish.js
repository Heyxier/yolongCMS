// YolongCMS Desktop — 发布管理 (v3: 自适应单按钮)
(function () {
    'use strict';

    function escapeHtml(s) { if (!s) return ''; const div = document.createElement('div'); div.textContent = s; return div.innerHTML; }
    function showToast(m) {
        let t = document.getElementById('toast');
        if (!t) {
            t = document.createElement('div'); t.id = 'toast';
            t.style.cssText = 'position:fixed;bottom:32px;left:50%;transform:translateX(-50%);background:var(--bg-secondary);color:var(--text-primary);padding:12px 24px;border-radius:var(--radius-lg);border:1px solid var(--border-color);font-size:14px;z-index:10000;box-shadow:0 8px 32px rgba(0,0,0,0.4);opacity:0;transition:opacity 0.3s;max-width:500px;text-align:center;';
            document.body.appendChild(t);
        }
        t.textContent = m; t.style.opacity = '1';
        clearTimeout(t._timer); t._timer = setTimeout(() => { t.style.opacity = '0'; }, 4000);
    }
    function getSite() { const a = window.__app; return a ? a.getCurrentSite() : null; }
    function formatDate(d) { if (!d) return ''; const x = new Date(d); const p = n => String(n).padStart(2, '0'); return p(x.getMonth() + 1) + '-' + p(x.getDate()) + ' ' + p(x.getHours()) + ':' + p(x.getMinutes()); }

    function getStatusLabel(code) {
        const map = { 'M': '修改', 'A': '新增', 'D': '删除', 'R': '重命名', '?': '未跟踪', ' ': '-' };
        return map[code] || code;
    }

    // ===== 加载遮罩控制 =====
    function showOverlay(title, progress, detail) {
        const $overlay = document.getElementById('pubOverlay');
        document.getElementById('pubOverlayTitle').textContent = title || '⏳ 操作中...';
        document.getElementById('pubOverlayProgress').textContent = progress || '';
        document.getElementById('pubOverlayDetail').textContent = detail || '';
        $overlay.style.display = 'flex';
    }

    function updateOverlay(progress, detail) {
        if (progress) document.getElementById('pubOverlayProgress').textContent = progress;
        if (detail) document.getElementById('pubOverlayDetail').textContent = detail;
    }

    function hideOverlay() {
        document.getElementById('pubOverlay').style.display = 'none';
    }

    // ===== 检查 GitHub 认证状态 =====
    async function checkGitHubAuth() {
        try {
            const config = await window.yolongcms.config.read();
            const token = (config && config.githubToken) || '';
            if (token.length > 10) return { ok: true, config };
            return { ok: false, config };
        } catch {
            return { ok: false, config: null };
        }
    }

    // ===== 刷新 =====
    async function refresh() {
        const site = getSite();
        const $empty = document.getElementById('publishEmpty');
        const $info = document.getElementById('publishInfo');
        const $content = document.getElementById('publishContent');
        const $btn = document.getElementById('btnCommitPush');

        if (!site) {
            $empty.style.display = 'flex';
            $info.style.display = 'none';
            $content.style.display = 'none';
            return;
        }
        $empty.style.display = 'none';

        const repoDir = site.id;

        try {
            const statusR = await window.yolongcms.git.status(repoDir);
            if (statusR.success) {
                $info.style.display = 'flex';
                document.getElementById('pubSiteName').textContent = site.name;
                document.getElementById('pubBranch').textContent = site.branch || 'main';

                const totalMod = (statusR.summary?.modified || 0) + (statusR.summary?.created || 0) + (statusR.summary?.deleted || 0);
                document.getElementById('pubPending').textContent = totalMod > 0 ? totalMod + ' 个文件' : '🟢 干净';

                const ahead = statusR.summary?.ahead || 0;
                const behind = statusR.summary?.behind || 0;
                let ab = '';
                if (ahead > 0 && behind > 0) ab = '↑' + ahead + ' ↓' + behind;
                else if (ahead > 0) ab = '↑' + ahead + ' 待推送';
                else if (behind > 0) ab = '↓' + behind + ' 待拉取';
                else ab = '🟢 同步';
                document.getElementById('pubAheadBehind').textContent = ab;

                const $fl = document.getElementById('pubFileList');
                const files = statusR.files || [];
                document.getElementById('pubFileCount').textContent = files.length + ' 个文件';

                if (!files.length) {
                    $fl.innerHTML = '<div class="log-empty">暂无变更</div>';
                } else {
                    let html = '';
                    files.forEach(f => {
                        html += '<div class="pub-file-row">';
                        html += '  <span class="pub-file-status ' + statusClass(f.status) + '">' + escapeHtml(getStatusLabel(f.status)) + '</span>';
                        html += '  <span class="pub-file-path">' + escapeHtml(f.path) + '</span>';
                        if (f.staged) html += '  <span class="pub-file-staged">已暂存</span>';
                        html += '</div>';
                    });
                    $fl.innerHTML = html;
                }

                // ===== 自适应按钮：有推送→推送，没推送→提交 =====
                if (ahead > 0) {
                    $btn.textContent = '📤 推送';
                    $btn.disabled = false;
                } else if (files.length > 0) {
                    $btn.textContent = '📝 提交';
                    $btn.disabled = false;
                } else {
                    $btn.disabled = true;
                }

                const logR = await window.yolongcms.git.log(repoDir, 5);
                const $ll = document.getElementById('pubLogList');
                if (logR.success && logR.entries?.length) {
                    document.getElementById('pubLogCount').textContent = logR.entries.length + ' 条';
                    let html = '';
                    logR.entries.forEach(e => {
                        const sh = e.hash.substring(0, 7);
                        html += '<div class="log-item"><span class="log-hash">' + sh + '</span><span class="log-msg">' + escapeHtml(e.message) + '</span><span class="log-date">' + formatDate(e.date) + '</span></div>';
                    });
                    $ll.innerHTML = html;
                } else {
                    document.getElementById('pubLogCount').textContent = '0 条';
                    $ll.innerHTML = '<div class="log-empty">暂无提交记录</div>';
                }

                $content.style.display = 'block';
            } else {
                showToast('获取状态失败: ' + statusR.error);
            }
        } catch (err) {
            showToast('刷新失败: ' + err.message);
        }
    }

    function statusClass(s) {
        const map = { 'M': 'status-mod', 'A': 'status-add', 'D': 'status-del', '?': 'status-unk' };
        return map[s] || '';
    }

    // ===== 仅推送（本地已经提交过了，只是推到远程） =====
    async function pushOnly() {
        const site = getSite();
        if (!site) { showToast('请先选择一个站点'); return; }

        const auth = await checkGitHubAuth();
        if (!auth.ok) {
            showToast('⚠️ 请先在设置中配置 GitHub Token');
            if (confirm('未配置 GitHub Token，无法推送。是否前往设置页面进行配置？')) {
                if (window.__app) window.__app.loadPage('settings');
            }
            return;
        }

        const repoDir = site.id;
        const $btn = document.getElementById('btnCommitPush');

        showOverlay('📤 正在推送到远程...', '', repoDir);
        $btn.disabled = true;

        try {
            const pushR = await window.yolongcms.git.pushAuth(repoDir);
            if (pushR.success) {
                updateOverlay('', '✅ 推送成功！');
                setTimeout(() => {
                    hideOverlay();
                    showToast('🚀 已发布到 GitHub！');
                    refresh();
                }, 1200);
            } else {
                hideOverlay();
                showToast('⚠️ 推送失败: ' + pushR.error);
                $btn.disabled = false;
                const $result = document.getElementById('pubResult');
                $result.style.display = 'block';
                $result.innerHTML = '⚠️ 推送失败: ' + escapeHtml(pushR.error) + '<br>稍后可重试';
                $result.className = 'pub-result pub-result-warn';
                refresh();
            }
        } catch (err) {
            hideOverlay();
            showToast('❌ 推送失败: ' + err.message);
            $btn.disabled = false;
        }
    }

    // ===== 仅提交（pull → add → commit，不推送） =====
    async function commitOnly() {
        const site = getSite();
        if (!site) { showToast('请先选择一个站点'); return; }

        const msg = document.getElementById('pubCommitMsg').value.trim();
        if (!msg) { showToast('请输入提交信息'); return; }

        const repoDir = site.id;
        const $btn = document.getElementById('btnCommitPush');

        showOverlay('⏳ 正在同步远程代码...', 'git pull', repoDir);
        $btn.disabled = true;

        try {
            // 先 pull
            updateOverlay('⏳ 正在同步远程代码...', 'git pull');
            const pullR = await window.yolongcms.git.pull(repoDir);
            if (!pullR.success && pullR.error && pullR.error.includes('conflict')) {
                hideOverlay();
                showToast('❌ 同步失败: 存在冲突，请手动解决');
                $btn.disabled = false;
                return;
            }

            // add + commit
            updateOverlay('⏳ 正在提交本地变更...', 'git add + commit');
            const commitR = await window.yolongcms.git.commit(repoDir, msg);
            if (!commitR.success) {
                hideOverlay();
                showToast('❌ 提交失败: ' + commitR.error);
                $btn.disabled = false;
                return;
            }

            const shortHash = commitR.commitHash?.substring(0, 7) || '';
            updateOverlay('', '✅ 已提交 ' + shortHash);
            setTimeout(() => {
                hideOverlay();
                document.getElementById('pubCommitMsg').value = '';
                showToast('✅ 已提交本地');
                refresh();
            }, 1200);
        } catch (err) {
            hideOverlay();
            showToast('❌ 操作失败: ' + err.message);
            $btn.disabled = false;
        }
    }

    // ===== 主按钮点击：根据按钮文字自动选择行为 =====
    async function onMainButtonClick() {
        const $btn = document.getElementById('btnCommitPush');
        if ($btn.textContent.includes('📤')) {
            await pushOnly();
        } else {
            await commitOnly();
        }
    }

    // ===== 拉取 =====
    async function gitPull() {
        const site = getSite();
        if (!site) { showToast('请先选择一个站点'); return; }

        const repoDir = site.id;
        try {
            const r = await window.yolongcms.git.pull(repoDir);
            if (r.success) { showToast('✅ 拉取成功'); refresh(); }
            else { showToast('⚠️ 拉取失败: ' + r.error); }
        } catch (err) { showToast('❌ 拉取失败: ' + err.message); }
    }

    function bindEvents() {
        document.getElementById('btnCommitPush').addEventListener('click', onMainButtonClick);
        document.getElementById('btnGitPull').addEventListener('click', gitPull);
    }

    window.init_publish = async function () { bindEvents(); await refresh(); };
    window.addEventListener('siteChanged', () => { refresh(); });
})();
