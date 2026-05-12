// YolongCMS Desktop — 发布管理
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
    function formatDate(d) { if (!d) return ''; const x = new Date(d); const p = n => String(n).padStart(2, '0'); return p(x.getMonth() + 1) + '-' + p(x.getDate()) + ' ' + p(x.getHours()) + ':' + p(x.getMinutes()); }

    function getStatusLabel(code) {
        const map = { 'M': '修改', 'A': '新增', 'D': '删除', 'R': '重命名', '?': '未跟踪', ' ': '-' };
        return map[code] || code;
    }

    async function refresh() {
        const site = getSite();
        const $empty = document.getElementById('publishEmpty');
        const $info = document.getElementById('publishInfo');
        const $content = document.getElementById('publishContent');

        if (!site) {
            $empty.style.display = 'flex';
            $info.style.display = 'none';
            $content.style.display = 'none';
            return;
        }
        $empty.style.display = 'none';

        const repoDir = site.id;

        try {
            // 状态
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

                // 文件列表
                const $fl = document.getElementById('pubFileList');
                const files = statusR.files || [];
                document.getElementById('pubFileCount').textContent = files.length + ' 个文件';

                if (!files.length) {
                    $fl.innerHTML = '<div class="log-empty">暂无变更</div>';
                    document.getElementById('btnCommitPush').disabled = true;
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
                    document.getElementById('btnCommitPush').disabled = false;
                }

                // 最近提交
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

    async function commitAndPush() {
        const site = getSite();
        if (!site) { showToast('请先选择一个站点'); return; }

        const msg = document.getElementById('pubCommitMsg').value.trim();
        if (!msg) { showToast('请输入提交信息'); return; }

        const $result = document.getElementById('pubResult');
        $result.style.display = 'block';
        $result.innerHTML = '⏳ 正在提交...';
        $result.className = 'pub-result pub-result-info';
        document.getElementById('btnCommitPush').disabled = true;

        const repoDir = site.id;

        try {
            // 先 add + commit
            const commitR = await window.yolongcms.git.commit(repoDir, msg);
            if (!commitR.success) {
                $result.innerHTML = '❌ 提交失败: ' + escapeHtml(commitR.error);
                $result.className = 'pub-result pub-result-error';
                document.getElementById('btnCommitPush').disabled = false;
                return;
            }

            $result.innerHTML = '✅ 提交成功' + (commitR.commitHash ? ' (' + commitR.commitHash.substring(0, 7) + ')' : '') + '<br>⏳ 正在推送到远程...';

            // 再 push
            const pushR = await window.yolongcms.git.push(repoDir);
            if (pushR.success) {
                $result.innerHTML = '✅ ' + commitR.commitHash.substring(0, 7) + ' 已提交并推送到 GitHub 🚀';
                $result.className = 'pub-result pub-result-success';
                document.getElementById('pubCommitMsg').value = '';
            } else {
                $result.innerHTML = '⚠️ 已提交但推送失败: ' + escapeHtml(pushR.error) + '<br>稍后可在命令行手动 push';
                $result.className = 'pub-result pub-result-warn';
            }

            await refresh();
        } catch (err) {
            $result.innerHTML = '❌ 操作失败: ' + escapeHtml(err.message);
            $result.className = 'pub-result pub-result-error';
            document.getElementById('btnCommitPush').disabled = false;
        }
    }

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
        document.getElementById('btnCommitPush').addEventListener('click', commitAndPush);
        document.getElementById('btnGitPull').addEventListener('click', gitPull);
    }

    window.init_publish = async function () { bindEvents(); await refresh(); };
    window.addEventListener('siteChanged', () => { refresh(); });
})();
