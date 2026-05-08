# YolongCMS 架构文档

> 版本: v1  
> 日期: 2026-05-08  
> 定位: 一套桌面应用 + 轻量服务端，管理多个 Jekyll/GitHub Pages 企业官网

---

## 一、架构总览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          YolongCMS 架构图                                │
│                                                                         │
│                             你的电脑                                      │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │               YolongCMS 桌面应用 (Electron)                   │        │
│  │                                                             │        │
│  │  站点管理 ─→ 产品管理 ─→ 文章管理 ─→ 分类管理                 │        │
│  │                        图片管理 ─→ 留言查看 ─→ 发布            │        │
│  │                                                             │        │
│  │  ┌──────────────────────────────────────────────────────┐   │        │
│  │  │            本地 Git 仓库                              │   │        │
│  │  │  repos/yolongtec/                                    │   │        │
│  │  │    ├── _products/*.md     ← 编辑产品                  │   │        │
│  │  │    ├── _articles/*.md     ← 编辑文章                  │   │        │
│  │  │    ├── _data/categories.yml ← 编辑分类                │   │        │
│  │  │    └── images/            ← 管理图片                  │   │        │
│  │  └──────────────────────────────────────────────────────┘   │        │
│  └──────────────────────────┬──────────────────────────────────┘        │
│                             │ git push                                  │
│                             ▼                                           │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │  GitHub                                                     │        │
│  │  仓库 → GitHub Actions → GitHub Pages → 官网更新            │        │
│  └─────────────────────────────────────────────────────────────┘        │
│                                                                         │
│                                                                         │
│                     阿里云服务器                                         │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │  hermes-gateway (QQ Bot 网关)                               │        │
│  │                                                             │        │
│  │  原有功能：QQ Bot 消息处理                                    │        │
│  │  新增功能：/api/contact/{site_id}  ← contact 表单 POST 接收 │        │
│  │                                                             │        │
│  │  ┌─────────────────────────────────────────────┐            │        │
│  │  │  SQLite: contact_messages.db                 │            │        │
│  │  │  └── messages 表 (site_id, name, company...) │            │        │
│  │  └─────────────────────────────────────────────┘            │        │
│  │                                                             │        │
│  │  收到留言时：存库 + 推送到你的 QQ                             │        │
│  └─────────────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────────┘

                         ┌───────────────────────┐
                         │    公网用户浏览器       │
                         │                       │
                         │  浏览官网 → 填写contact │
                         │  表单 → POST 到服务器   │
                         └───────────────────────┘
```

---

## 二、核心原则

| 原则 | 说明 |
|------|------|
| **内容在本地** | 所有网站内容（Markdown、YAML、图片）存在你电脑本地 |
| **GitHub 只是管道** | 仅用于触发 GitHub Pages 构建部署 |
| **服务器只做一件事** | 接收 contact 表单数据，存库 + 通知你 |
| **不锁平台** | 数据在本地 Git 仓库里，随时可以换工具管理 |
| **一个应用管所有站** | 切换站点即可管理不同网站的内容 |

---

## 三、桌面应用 (Electron)

### 3.1 为什么用 Electron

| 优势 | 说明 |
|------|------|
| 跨平台 | Windows / macOS / Linux 一个应用 |
| 界面能力强 | HTML + CSS 做 UI，可以做得很好看 |
| 生态成熟 | Git 操作、文件读写都有现成 npm 包 |
| 打包简单 | electron-builder 打包成安装包 |
| **你熟悉** | HTML/CSS/JS 你之前项目都在用 |

### 3.2 技术栈

| 层 | 技术 | 用途 |
|----|------|------|
| 框架 | Electron 33 | 桌面应用容器 |
| 前端 | 原生 HTML + CSS + Vanilla JS | 管理后台界面 |
| Git | simple-git (npm) | clone/pull/commit/push/status |
| 文件 | gray-matter (npm) | 读写 Markdown frontmatter |
| 数据 | JSON 文件 | 存储站点配置、应用状态 |
| 通信 | fetch API | 从服务器拉取留言列表 |

### 3.3 功能模块

#### 站点管理

```
功能:
  - 添加站点 (填: 名称, GitHub 仓库地址, 分支, 联系服务器地址)
  - 删除站点
  - 切换当前管理的站点

流程:
  新增站点:
    1. 填入仓库地址
    2. 应用 git clone 到本地 repos/{id}/
    3. 写入 sites.json
    4. 完成

  切换站点:
    1. 点击目标站点
    2. 应用从 repos/{id}/ 读取内容
    3. 所有操作切换为该站点
```

#### 产品管理

```
功能:
  - 查看产品列表 (表格: 缩略图 | 型号 | 名称 | 分类 | 操作)
  - 搜索产品
  - 新增产品 (表单: 名称, 型号, 分类下拉, 规格动态添加, 特性, 描述)
  - 编辑产品
  - 删除产品

数据:
  读写 repos/{site}/_products/{slug}.md
  Markdown 格式: frontmatter (YAML) + body (描述)
```

#### 文章管理

```
功能:
  - 查看文章列表
  - 新增 / 编辑 / 删除文章

数据:
  读写 repos/{site}/_articles/{slug}.md
```

#### 分类管理

```
功能:
  - 查看分类列表
  - 新增 / 编辑 / 删除分类
  - 删除时检查是否有产品使用该分类

数据:
  读写 repos/{site}/_data/categories.yml
```

#### 图片管理

```
功能:
  - 图片浏览 (网格展示, 按目录分组)
  - 图片上传 (从本地选择文件, 复制到 repos/{site}/images/)
  - 图片删除
  - 自动分类: 产品图 → images/products/{category}/, 通用图 → images/

限制:
  - 仅允许: jpg, png, webp, gif, svg
  - 每张 < 5MB
```

#### 留言查看

```
功能:
  - 从服务器拉取当前站点的留言列表
  - 标记已读 / 未读
  - 查看详情
  - 删除留言

接口:
  GET https://服务器:8123/api/messages/{site_id}
  → 返回 JSON 留言列表
```

#### 发布

```
功能:
  - 查看待修改文件 (git status)
  - 输入提交信息
  - 一键 git add → commit → push
  - 显示发布结果 (commit hash, 构建预计时间)

安全:
  - Git 凭证: SSH Key 或 Personal Access Token
  - 存储在本地, 不离开你的电脑
```

### 3.4 界面设计

**整体调性：深色简洁后台**

```
┌──────────────────────────────────────────────────────────────┐
│  ☰ YolongCMS          亚隆电动工具 ▼   服务器状态 ●   设置   │
├──────────┬───────────────────────────────────────────────────┤
│          │                                                    │
│  站点管理 │  (内容区域)                                       │
│  📦 产品  │                                                    │
│  📝 文章  │  当前模块的内容                                    │
│  🏷️ 分类  │                                                    │
│  🖼️ 图片  │                                                    │
│  ✉️ 留言  │                                                    │
│  🚀 发布  │                                                    │
│          │                                                    │
└──────────┴───────────────────────────────────────────────────┘
```

**左侧导航固定**，右侧根据选中模块切换内容。

### 3.5 项目目录结构

```
~/yolongcms-desktop/
├── ARCHITECTURE.md                  # 本文档
├── README.md                        # 项目说明
├── package.json                     # npm 依赖
│
├── electron/
│   ├── main.js                      # Electron 主进程
│   ├── preload.js                   # 预加载 (安全暴露 API)
│   └── menu.js                      # 应用菜单
│
├── src/
│   ├── index.html                   # 应用入口
│   ├── css/
│   │   └── admin.css               # 全局样式 (深色主题)
│   ├── js/
│   │   ├── app.js                   # 路由 + 全局状态
│   │   ├── sites.js                 # 站点管理
│   │   ├── products.js              # 产品管理
│   │   ├── articles.js              # 文章管理
│   │   ├── categories.js            # 分类管理
│   │   ├── images.js                # 图片管理
│   │   ├── messages.js              # 留言查看
│   │   └── publish.js               # 发布
│   └── pages/
│       ├── dashboard.html           # 仪表盘 (站点概览)
│       ├── products.html            # 产品列表 + 表单
│       ├── articles.html            # 文章列表 + 表单
│       ├── categories.html          # 分类列表
│       ├── images.html              # 图片管理
│       ├── messages.html            # 留言列表
│       └── publish.html             # 发布页
│
├── services/
│   ├── git-service.js               # Git 操作封装
│   ├── md-service.js                # Markdown frontmatter 读写
│   ├── yml-service.js               # YAML 文件读写
│   └── server-service.js            # 与服务器通信
│
├── data/
│   ├── sites.json                   # 站点配置
│   └── app.json                     # 应用状态
│
└── repos/                           # 各站点的 Git 仓库 (git clone)
    ├── yolongtec/                   # 亚隆官网
    │   ├── _products/
    │   ├── _articles/
    │   ├── _data/
    │   └── images/
    └── ...                          # 后续站点
```

---

## 四、服务端 (现有网关扩能)

### 4.1 改动范围

**最小改动**——在已有的 `hermes-gateway` 基础上加 3 个端点：

```
POST   /api/contact/{site_id}   → 接收公网联系表单 (需要跨域)
GET    /api/messages/{site_id}  → 桌面应用拉取留言列表

新增文件:
  gateway/contact_handler.py    → 处理 contact 的逻辑
  gateway/data/contact.db       → SQLite 数据库 (自动创建)
```

**不需要：** 安装新服务、修改 Nginx、新增端口暴露方式

### 4.2 Contact API

```
POST /api/contact/{site_id}
Content-Type: application/json

{
    "name": "张三",
    "company": "XX公司",
    "email": "zhang@example.com",
    "phone": "13800138000",
    "message": "咨询产品报价"
}

响应:
{
    "status": "ok",
    "message_id": 123
}

流程:
  1. 校验必填字段 (name, email, message)
  2. 频率检查 (同一 IP 每小时不超过 5 次)
  3. 写入 SQLite
  4. 推送到你的 QQ (消息模板: [新客户留言] 张三 - XX公司 - 138...)
```

### 4.3 Messages API

```
GET /api/messages/{site_id}?limit=50&offset=0

响应:
{
    "total": 123,
    "items": [
        {
            "id": 123,
            "name": "张三",
            "company": "XX公司",
            "email": "zhang@example.com",
            "phone": "13800138000",
            "message": "咨询产品报价",
            "created_at": "2026-05-08T14:30:00",
            "read": false
        }
    ]
}

DELETE /api/messages/{id}

响应:
{
    "status": "ok"
}
```

### 4.4 SQLite 表结构

```sql
CREATE TABLE messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id     TEXT NOT NULL,
    name        TEXT NOT NULL,
    company     TEXT DEFAULT '',
    email       TEXT NOT NULL,
    phone       TEXT DEFAULT '',
    message     TEXT NOT NULL,
    ip_address  TEXT DEFAULT '',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    read        INTEGER DEFAULT 0
);
```

### 4.5 安全措施

| 措施 | 实现方式 |
|------|---------|
| 频率限制 | 内存中记录 IP + 时间戳，每小时限 5 次 |
| 字段校验 | name/email/message 必填，email 格式校验 |
| 长度限制 | name < 100, email < 200, message < 5000 |
| CORS | 允许指定的 GitHub Pages 域名跨域 |
| 数据保留 | 数据库自动清理 180 天前的数据 |

---

## 五、数据流详解

### 5.1 日常内容管理

```
你在桌面应用:
  1. 编辑产品 → 保存 → 直接写到本地 repos/yolongtec/_products/*.md
  2. 上传图片 → 复制到 repos/yolongtec/images/products/drill/
  3. 编辑分类 → 更新 repos/yolongtec/_data/categories.yml
  4. 所有改动在本地，随时可以 undo
```

### 5.2 发布流程

```
你在桌面应用:
  1. 点击"发布"
  2. 看到 git status (哪些文件改了)
  3. 填写提交信息
  4. 点击确认
  5. 应用执行: git add → git commit → git push
  6. 显示结果: "已推送，GitHub Actions 正在构建..."
```

### 5.3 客户留言

```
客户:
  1. 在官网填写 contact 表单
  2. 表单 POST 到 服务器 /api/contact/yolongtec

服务器:
  1. 校验数据
  2. 写入 SQLite
  3. 推送消息到你的 QQ
  (全程无需你在场)

你在桌面应用:
  1. QQ 上看到新留言通知
  2. 或者在桌面应用里打开"留言"查看所有记录
```

---

## 六、安全性分析

| 攻击面 | 风险 | 缓解 |
|--------|------|------|
| Contact API 被刷 | 低 | 频率限制 + IP 记录 |
| GitHub Token 泄露 | 低 | 存在本地，不离开你的电脑 |
| 本地文件误删 | 低 | Git 可以恢复 |
| 服务器被攻击 | 低 | 只暴露一个端点，无管理员功能 |
| XSS | 无 | 留言只存库不渲染 HTML |

**相比于全栈后端方案，桌面应用 + 极简服务端的安全面小得多。**

---

## 七、开发规划

### Phase 1: 服务端 (半天)

- 在 hermes-gateway 上加 `/api/contact` 和 `/api/messages` 端点
- SQLite 建表
- QQ 推送通知
- 测试: curl 模拟表单提交 → QQ 收到消息

### Phase 2: 桌面应用骨架 (1天)

- Electron 项目初始化
- 主窗口 + 侧边栏 + 页面路由
- 站点管理 (添加/切换)
- Git clone 站点仓库

### Phase 3: 内容管理核心 (2天)

- 产品 CRUD (Markdown 读写)
- 文章 CRUD
- 分类管理 (YAML 读写)
- 图片管理 (上传/浏览/删除)

### Phase 4: 发布 + 集成 (1天)

- Git 发布模块 (status/commit/push)
- 留言查看 (从服务器拉取)
- Contact 表单改 POST 到服务器
- 全流程联调

---

## 八、项目文件

| 文件 | 说明 |
|------|------|
| `ARCHITECTURE.md` | 本文档 |
| `package.json` | npm 依赖配置 |
| `data/sites.json` | 本地站点配置 |
| `~/.ssh/` | Git SSH Key (你已有) |

---

## 九、后续可扩展方向

| 方向 | 说明 |
|------|------|
| 内容模板 | 预设产品/文章模板，新增时自动填充 |
| 批量操作 | 批量导入/导出产品 (CSV/Excel) |
| 图片压缩 | 上传时自动压缩 WebP |
| 离线模式 | 完整离线编辑，联网后批量发布 |
| 多用户 | 一个应用多个操作员账号 |
| 国际化 | 支持多语言站点内容管理 |
| 自动备份 | 定期将 SQLite 和站点配置备份到云端 |
