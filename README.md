# Socket.IO 聊天平台（chat_platform）

<p align="center">
  <img alt="Node.js" src="https://img.shields.io/badge/node.js-20-339933">
  <img alt="Socket.IO" src="https://img.shields.io/badge/socket.io-4.x-010101">
  <img alt="Express" src="https://img.shields.io/badge/express-4.x-lightgrey">
  <img alt="Vue" src="https://img.shields.io/badge/vue-3.x-42b883">
  <img alt="Vite" src="https://img.shields.io/badge/vite-4.x-646cff">
  <img alt="Pinia" src="https://img.shields.io/badge/pinia-2.x-ffd859">
  <img alt="MySQL" src="https://img.shields.io/badge/mysql-8.4-4479a1">
  <img alt="Docker Compose" src="https://img.shields.io/badge/docker-compose-2496ed">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-green">
</p>

这是一个基于 [Socket.IO](https://socket.io/) 的基础聊天平台，后端使用 Node.js + Express + Socket.IO + MySQL，前端使用 Vue 3 + Vite + Pinia。项目目前实现了用户注册/登录、公共频道消息、私聊消息、用户搜索、输入状态提示、已读确认和中英文界面，并提供基于 Docker Compose（Nginx + 后端 + MySQL）的一键部署。

频道消息：

![公共频道截图](./assets/channel_based_messages.png)

私聊消息：

![私聊截图](./assets/private_messages.png)

## 功能特性

- **用户认证**：通过 `/signup`、`/login`、`/logout`、`/self` 接口注册和登录，密码使用 argon2 哈希，会话由 express-session 存储在 MySQL 中，并共享给 Socket.IO 连接。
- **频道**：支持创建、删除、加入、列出和搜索频道（`channel:*` 事件）。
- **私聊**：通过 `user:reach` 与指定用户建立私聊频道。
- **消息**：支持发送、分页列出、已读确认和「正在输入」提示（`message:*` 事件）。
- **用户**：支持获取用户信息和搜索用户（`user:*` 事件）。
- **参数校验**：使用 ajv 校验注册接口和 Socket.IO 事件的请求参数。
- **多语言界面**：Vue 客户端内置英文和中文语言包。
- **容器化部署**：Nginx 托管构建后的前端，并把 `/api/` 反向代理到后端（含 WebSocket）。

## 项目结构

```text
.
├── server/                  # Node.js 后端
│   ├── index.js             # 本地开发入口（读取 .env，监听 3000 端口）
│   ├── entrypoint.js        # Docker 容器入口
│   ├── src/
│   │   ├── auth/            # 注册、登录、登出、会话
│   │   ├── channel/         # 频道相关事件
│   │   ├── message/         # 消息相关事件
│   │   ├── user/            # 用户相关事件
│   │   └── db.js            # MySQL 数据访问
│   ├── sql/mysql/           # MySQL 建表脚本
│   └── test/                # mocha 测试
├── vue-client/              # Vue 3 前端
│   └── src/
│       ├── views/           # 登录、注册、频道页面
│       ├── components/      # 聊天面板、侧边栏、弹窗等组件
│       ├── stores/          # Pinia 状态（含 i18n）
│       └── locales/         # en / zh 语言包
├── nginx/                   # Nginx 镜像与配置
├── compose.yaml             # Nginx + 后端 + MySQL
├── .env.example             # Docker Compose 环境变量模板
└── assets/                  # 截图和数据模型图
```

## 快速开始

### 环境要求

- Docker 与 Docker Compose（一键部署）
- Node.js 20 与 npm（本地开发）
- MySQL 8（本地开发）

### 使用 Docker Compose 运行

```bash
cp .env.example .env   # 修改其中的密码和 SESSION_SECRET
docker compose up -d
```

然后访问 http://localhost:8080 （端口可通过 `.env` 中的 `APP_PORT` 修改）。MySQL 容器首次启动时会自动执行 `server/sql/mysql/001-init.sql` 建表。

### 本地开发：后端

先创建数据库和表：

```bash
mysql -u root -p < server/sql/mysql/001-init.sql
```

在 `server/` 目录下创建 `.env`，按需填写 `MYSQL_HOST`、`MYSQL_PORT`、`MYSQL_USER`、`MYSQL_PASSWORD`、`MYSQL_DATABASE`、`SESSION_SECRET`（默认连接 `127.0.0.1:3306` 的 `socketio_chat` 库，用户为 `root`），然后启动：

```bash
cd server
npm install
npm run dev
```

开发服务器监听 http://localhost:3000 ，允许来自 5173 和 8090 端口的 Vue 客户端连接。

### 本地开发：前端

```bash
cd vue-client
npm install
npm run dev
```

然后访问 http://localhost:5173 。构建生产版本：

```bash
npm run build
```

## 数据模型

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/data_model_dark.png">
  <img alt="数据模型" src="./assets/data_model.png">
</picture>

## 当前状态

后端已从 PostgreSQL 迁移到 MySQL，已实现主要聊天功能和 Docker Compose 部署配置。后续可继续完善：

- 将 `server/test/` 中的测试和 GitHub Actions CI 从 PostgreSQL 迁移到 MySQL（目前仍使用 `postgres` 配置，无法直接通过）
- 移除已不再使用的 `server/compose.yaml`（PostgreSQL）和 `server/sql/0001-init.sql`
- 修正 `server/package.json` 中的版本号（当前为 `°0.0.1`）
- 替换 `vue-client/README.md` 中的 Vite 模板说明

## 数据和敏感信息

`.env`、`server/.env`、`node_modules/` 和 `app-icons.zip` 已通过 `.gitignore` 排除，不应提交到仓库。部署前请务必修改 `.env` 中的数据库密码和 `SESSION_SECRET`。

## 许可证

[MIT](./LICENSE)
