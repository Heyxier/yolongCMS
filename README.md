# YolongCMS

多网站统一内容管理桌面应用 + 轻量服务端

## 项目结构

```
yolongCMS/
├── desktop/          ← Electron 桌面应用 (内容管理)
│   ├── electron/     ← 主进程
│   ├── src/          ← 前端界面
│   ├── services/     ← Git/Markdown 服务
│   └── data/         ← 站点配置
├── server/           ← 联系表单接收服务 (部署在服务器)
│   ├── server.py     ← HTTP API 服务
│   └── yolongcms-contact.service  ← systemd 配置
├── ARCHITECTURE.md   ← 架构文档
└── README.md         ← 本文件
```
