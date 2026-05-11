// YolongCMS — YAML 文件服务
// 用于读写 _data/ 目录下的 YAML 数据文件（如 categories.yml）
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

/**
 * 读取 YAML 文件
 * @param {string} filePath
 * @returns {{ success: boolean, data?: any, error?: string }}
 */
function read(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            return { success: true, data: [] };
        }
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = yaml.load(raw);
        return { success: true, data: data || [] };
    } catch (err) {
        return { success: false, error: err.message || '读取 YAML 失败' };
    }
}

/**
 * 写入 YAML 文件（覆盖）
 * @param {string} filePath
 * @param {any} data
 * @returns {{ success: boolean, error?: string }}
 */
function write(filePath, data) {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const yamlStr = yaml.dump(data, {
            indent: 2,
            lineWidth: 120,
            noRefs: true,
            sortKeys: false,
        });
        fs.writeFileSync(filePath, yamlStr, 'utf-8');
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message || '写入 YAML 失败' };
    }
}

module.exports = { read, write };
