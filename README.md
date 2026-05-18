# YolongCMS

多网站统一内容管理桌面应用 + 轻量服务端

> **当前版本：** v0.3.0

## 功能特性

- 📝 文章管理 — Markdown 编辑器 + 富文本编辑器（支持加粗、斜体、下划线、标题、引用、对齐、链接、列表等）
- 🖼️ 图片管理 — 文件夹浏览、拖拽上传、一键插入
- 🏷️ 分类管理 — 文章/产品分类自动归类
- 📦 产品管理 — 产品信息维护
- 🚀 一键发布 — 推送到 GitHub Pages
- 🌐 多站点支持 — 管理多个 Jekyll 网站

## 项目结构

```
yolongCMS/
├── electron/          ← 主进程
├── src/               ← 前端界面
│   ├── js/
│   ├── css/
│   └── pages/
├── package.json
└── README.md
```

## 开发

```bash
# 启动
npm start

# 开发模式
npm run dev

# 打包 Windows 安装包
npm run pack
```

打包产物在 `release/` 目录下。
