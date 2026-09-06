# MelodyVow Web

MelodyVow 现在已经从静态展示页升级为一套可接真实生成链路的前端 + 本地 API 服务：

- 首页输入 `新郎姓名 / 新娘姓名 / 歌曲语言 / 曲风`
- 服务端调用 DeepSeek 生成对应语言的婚礼歌词
- 服务端再调用 Suno 生成歌曲
- 歌曲完成后，预览页会自动轮询或接收回调，并尝试自动播放

## 目录说明

- `src/`：React 前端页面
- `server/index.mjs`：本地 API 服务，负责代理 DeepSeek / Suno
- `.env.example`：环境变量模板

## 启动步骤

1. 安装依赖

```bash
npm install
```

2. 复制环境变量模板为 `.env`

```bash
copy .env.example .env
```

3. 填写至少这两个密钥

```env
DEEPSEEK_API_KEY=你的 DeepSeek Key
SUNO_AUTH=你小程序里同一套 Suno Token
```

4. 启动开发环境

```bash
npm run dev
```

默认会同时启动：

- 前端：`http://localhost:5173/`
- API：`http://127.0.0.1:8787/`

## 环境变量

```env
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_API_BASE=https://api.deepseek.com/v1
SUNO_AUTH=
SUNO_API_KEY=
SUNO_MODEL=chirp-v4-5
SUNO_GENERATE_URL=https://api.wike.cc/api/suno/generate
SUNO_FEED_URL=https://api.wike.cc/api/suno/feed
PUBLIC_BASE_URL=
PORT=8787
SUNO_POLL_INTERVAL_MS=12000
SUNO_POLL_MAX_ATTEMPTS=40
```

说明：

- `PUBLIC_BASE_URL` 留空时，本地开发默认使用轮询获取 Suno 结果
- `PUBLIC_BASE_URL` 配成公网地址后，Suno 可以直接回调到 `/api/suno/callback`
- 这套 Suno 接口已经按你另一个微信小程序项目的 `generate -> feed -> callback` 流程对齐

## 已实现功能

- 首页“婚礼日期”已替换为“歌曲语言”
- 支持较大范围的全球主要语言选择
- DeepSeek 歌词生成
- Suno 歌曲任务提交
- 预览页任务状态展示
- 歌曲完成后自动尝试播放

## 校验命令

```bash
npm run build
npm run lint
```
