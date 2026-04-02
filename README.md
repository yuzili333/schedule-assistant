# 日程 AI 助手 Monorepo

## 项目说明

本仓库现已收敛为两层：

- `playground`：Chatbox 前端，负责 agent service 通信、message schema、卡片渲染协议、流式接口处理与交互体验
- `services/agent-service`：独立 Node 服务，基于 `Express` 提供 HTTP / SSE 接口，内部承载 Router、Skill Runtime、ToolExecutor、MCP、模型治理、审计、缓存、限流、灰度等能力

当前仍聚焦两类核心能力：

- 日程创建
- 日程查询

新增日程时还包含一条专用推荐链路：

- 主题、开始日期、结束日期优先从最近待办消息提取
- 参与者、抄送者优先级为：用户明确输入 > 7 天有效缓存 > 待办消息 > 最近创建日程
- 机构人员候选通过 `lit` 卡片回传给用户手动确认

## 目录结构

```text
.
├── package.json
├── pnpm-workspace.yaml
├── netlify.toml
├── README.md
├── tsconfig.base.json
├── playground
│   ├── package.json
│   ├── rsbuild.config.ts
│   ├── postcss.config.cjs
│   ├── tailwind.config.cjs
│   ├── tsconfig.json
│   └── src
│       ├── App.tsx
│       ├── components
│       ├── index.css
│       ├── lib
│       ├── main.tsx
│       └── types
└── services
    └── agent-service
        ├── package.json
        ├── tsconfig.json
        ├── tsconfig.build.json
        ├── netlify
        │   └── functions
        └── src
            ├── audit.ts
            ├── bin
            ├── config.ts
            ├── context.ts
            ├── core
            │   ├── agent
            │   ├── data
            │   ├── mcp
            │   ├── router
            │   ├── service-protocol.ts
            │   └── types.ts
            ├── gray-release.ts
            ├── rate-limit.ts
            └── server.ts
```

## 架构边界

### 1. Chatbox 前端

`playground` 不再直接调用 agent runtime，而是只通过 HTTP / SSE 调用 agent service：

- `playground/src/lib/agent-service.ts`：封装 `/api/chat/stream`
- `playground/src/lib/agent-schema.ts`：前端本地 message schema / 卡片协议类型
- `playground/src/components/chat-message-card.ts`：`lit` 消息卡片渲染
- `playground/src/App.tsx`：输入区、语音输入、流式消息拼接、候选人选择、推荐草稿采纳

### 2. Agent Service

`services/agent-service/src/server.ts` 对外提供：

- `POST /api/chat`
- `POST /api/chat/stream`
- `GET /health`
- `GET /api/health`

服务层职责：

- 决策与执行编排
- 技能注册
- 工具权限控制
- MCP 连接与调用
- 模型治理
- 审计记录
- 缓存
- 限流
- 灰度

### 3. Agent Core

`services/agent-service/src/core` 内聚原先 agent 包能力：

- `router/*`：请求标准化、匹配、风险评估与路由
- `agent/runtime.ts`：组合 Router、Skill Runtime、ToolExecutor 与 LLM
- `agent/skill-runtime.ts`：新增日程推荐填充
- `agent/tool-executor.ts`：工具执行分发
- `agent/storage.ts`：模型配置与新增日程缓存
- `mcp/*`：MCP server 注册、发现、调用、卸载

## 运行方式

安装依赖：

```bash
pnpm install
```

启动前端：

```bash
pnpm dev:playground
```

启动 Node 服务：

```bash
pnpm dev:service
```

完整校验：

```bash
pnpm lint
pnpm test
pnpm build
```

## 环境变量

### 前端

`playground` 支持：

```bash
PUBLIC_AGENT_SERVICE_BASE_URL=/api
```

默认使用同域 `/api`。

### Agent Service

`services/agent-service` 默认直接读取本目录下的 `.env.local`，也可通过 `AGENT_SERVICE_ENV_FILE` 指定其它配置文件。建议将模型治理和服务端运行配置都放在这里，而不是放在 `playground/.env.local`。

`services/agent-service/.env.local` 支持：

```bash
PORT=8787
AGENT_SERVICE_API_PREFIX=/api
AGENT_SERVICE_RATE_LIMIT_WINDOW_MS=60000
AGENT_SERVICE_RATE_LIMIT_MAX_REQUESTS=30
AGENT_SERVICE_GRAY_RELEASE_RATIO=1
AGENT_SERVICE_CORS_ORIGIN=*

PUBLIC_MODEL_ENABLED=false
PUBLIC_MODEL_ACTIVE=GPT
PUBLIC_MODEL_REGISTRY_JSON={"GPT":{"provider":"GPT","label":"GPT","baseUrl":"","apiKey":"","model":"gpt-4o-mini"},"QWEN":{"provider":"QWEN","label":"Qwen/Qwen3-32B","baseUrl":"","apiKey":"","model":"Qwen/Qwen3-32B"}}
PUBLIC_MODEL_SYSTEM_PROMPT=你是企业日程 AI 助手。仅处理日程创建与日程查询。
```

## Netlify 部署

根目录已提供 [netlify.toml](/Users/yuzili/Projects/agents/schedule-assistant/netlify.toml)：

- `playground/dist` 作为静态站点
- `services/agent-service/netlify/functions` 作为 Netlify Functions 目录
- `/api/*` 重写到 `agent` function
- `/health` 重写到 agent service 健康检查

## 当前实现重点

- 创建日程与查询日程两个 tool
- 新增日程 prefill skill
- 7 天有效缓存
- 机构人员候选卡片确认
- SSE 流式响应
- 浏览器语音输入按钮

## 后续建议

- 将当前内存版审计、限流、灰度与缓存替换为外部持久化存储
- 将 mock MCP domain servers 替换成真实组织人员、待办、日历服务
- 补 service 层集成测试，覆盖 `/api/chat` 和 `/api/chat/stream`
