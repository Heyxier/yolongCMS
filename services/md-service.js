// YolongCMS — Markdown 文件服务
// 读写 repos/{siteId}/ 下的 Markdown 文件（frontmatter + body）
const grayMatter = require('gray-matter');
const fs = require('fs');
const path = require('path');

/**
 * 读取 Markdown 文件，解析 frontmatter + body
 * @param {string} filePath - *.md 文件的绝对路径
 * @returns {{ success: boolean, data?: object, content?: string, error?: string }}
 */
function read(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            return { success: false, error: '文件不存在' };
        }
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = grayMatter(raw);
        return {
            success: true,
            data: parsed.data,        // YAML frontmatter 解析后的对象
            content: parsed.content,  // Markdown body
            isEmpty: !parsed.content?.trim(),
        };
    } catch (err) {
        return { success: false, error: err.message || '读取失败' };
    }
}

/**
 * 写入 Markdown 文件（覆盖）
 * @param {string} filePath - 保存路径
 * @param {object} data - frontmatter 字段
 * @param {string} content - Markdown body
 * @returns {{ success: boolean, error?: string }}
 */
function write(filePath, data, content) {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const md = grayMatter.stringify(content || '', data || {});
        fs.writeFileSync(filePath, md, 'utf-8');
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message || '写入失败' };
    }
}

/**
 * 列出目录下所有 .md 文件
 * @param {string} dir - 目录路径
 * @returns {{ success: boolean, files?: Array, error?: string }}
 */
function list(dir) {
    try {
        if (!fs.existsSync(dir)) {
            return { success: true, files: [] };
        }
        const items = fs.readdirSync(dir, { withFileTypes: true });
        const files = items
            .filter(item => item.isFile() && item.name.endsWith('.md'))
            .map(item => {
                const fullPath = path.join(dir, item.name);
                const stat = fs.statSync(fullPath);
                // 快速读取 frontmatter
                let frontmatter = {};
                try {
                    const raw = fs.readFileSync(fullPath, 'utf-8');
                    const parsed = grayMatter(raw);
                    frontmatter = parsed.data || {};
                } catch {}
                return {
                    name: item.name,
                    slug: item.name.replace(/\.md$/, ''),
                    title: frontmatter.title || frontmatter.name || '',
                    model: frontmatter.model || '',
                    category: frontmatter.category || '',
                    tags: frontmatter.tags || [],
                    status: frontmatter.status,
                    size: stat.size,
                    mtime: stat.mtimeMs,
                };
            })
            .sort((a, b) => b.mtime - a.mtime); // 最近修改的在前

        return { success: true, files };
    } catch (err) {
        return { success: false, error: err.message || '列出文件失败' };
    }
}

/**
 * 删除 Markdown 文件
 * @param {string} filePath
 * @returns {{ success: boolean, error?: string }}
 */
function remove(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message || '删除失败' };
    }
}

module.exports = { read, write, list, remove };
