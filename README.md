# 日程 AI 助手 Monorepo

## 项目说明

本仓库实现了一个面向企业场景的日程 AI 助手 Agent。应用端采用 `rsbuild + React + tailwindcss`，消息卡片使用 `lit` 自定义元素渲染，当前版本围绕“日程创建”和“日程查询”两个 tool 落地，并补充了一个仅服务于新增日程的推荐填充 skill：

`Router + Skill Runtime + ToolExecutor + MCP Client + Domain MCP Servers + Policy/State/Cost Control`

当前版本提供一个可直接运行的 Web Chatbox 原型，支持：

- 日程创建和日程查询
- 新增日程时优先读取用户最近一条待办消息，推荐主题、开始日期、结束日期
- 待办消息缺失会议室、视频会议号、参会人、抄送人时，回退读取最近创建的日程字段做推荐填充
- 新增日程提交后的参会人、抄送人会进入本地 7 天有效缓存；后续未显式填写这些字段时，会优先提示用户采纳缓存中的历史名单
- 创建日程时根据参会人姓名调用机构人员服务查询候选人，并在 Chatbox 中以 `lit` 卡片供用户手动选择
- 抄送人名单也会走同样的机构人员候选确认链路
- Router 对规则直达、工具、LLM 的打分决策
- ToolExecutor Registry + Executor Contract 的工具分发与执行
- MCP server 的注册、发现、调用、卸载
- 对日程写入动作做可逆写入风险识别与人工确认提示
- 通过 `.env.local` 的模型列表 JSON 配置当前可用模型，并用激活 key 切换
- 通过 `lit` 消息卡片展示路由结果、置信度和延迟

## 目录结构

```text
.
├── package.json
├── pnpm-workspace.yaml
├── README.md
├── tsconfig.base.json
├── playground
│   ├── .env.local
│   ├── package.json
│   ├── postcss.config.cjs
│   ├── rsbuild.config.ts
│   ├── tailwind.config.cjs
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   └── src
│       ├── App.tsx
│       ├── components
│       ├── index.css
│       ├── main.tsx
│       └── types
└── packages
    └── agent
        ├── package.json
        ├── tsconfig.json
        ├── tsconfig.build.json
        ├── vitest.config.ts
        └── src
            ├── agent
            ├── data
            ├── index.ts
            ├── mcp
            ├── router
            └── types.ts
```

## Workspace 划分

- `playground`：chatbot 应用目录，负责 UI、聊天交互和本地调试
- `packages/agent`：日程助手 agent 包目录，负责 Router、ToolExecutor、MCP 等核心逻辑，后续可单独开发、测试和发布

## 功能设计

### 1. Router

`packages/agent/src/router/*` 负责对用户请求做标准化、匹配、风险评估和最终路由。

- `direct`：FAQ 或固定规则直达
- `tool`：执行型工具，仅保留 `create_calendar_event` 和 `get_calendar_events`
- `skill`：新增日程预填充，仅保留 `recommend_create_calendar_prefill`
- `llm`：低置信度或开放式复杂问题回退到大模型
- `block`：高风险写入操作拦截

### 2. Skill Runtime

`packages/agent/src/agent/skill-runtime.ts` 负责新增日程推荐填充：

- 读取近期待办消息，优先推荐最新一条待办作为日程主题来源
- 从待办消息中解析时间、参会人、抄送人
- 待办未给出参会人或抄送人时，优先读取 7 天内有效缓存中的历史名单
- 缺失字段时回退读取最近创建的日程，推荐会议室、视频会议号等字段
- 预先查询机构人员候选，供 Chatbox 中的 `lit` 卡片逐步确认

### 3. ToolExecutor

`packages/agent/src/agent/tool-executor.ts` 提供正式的 ToolExecutor 抽象：

- `ToolExecutor`：单工具执行 contract
- `ToolExecutorRegistry`：执行器注册与发现
- `dispatchToolExecution(...)`：按 Router 决策、policy 和 registry 分发
- 默认执行器仅覆盖 `create_calendar_event` 和 `get_calendar_events`
- `packages/agent/src/agent/storage.ts`：负责模型配置与新增日程缓存读写，缓存有效期为 7 天

`packages/agent/src/agent/runtime.ts` 负责组合 Router、ToolExecutor 和模型流式回退能力，并将结果输出给 Chat UI。

### 4. MCP Client / Server

`packages/agent/src/mcp/*` 提供 MCP 能力：

- `InMemoryMcpServerRegistry`：server 注册中心
- `DefaultMcpClient`：server 发现与工具调用入口
- `registerServer(...)`：注册 server
- `discoverServers(...)`：按 capability / toolName 发现 server
- `callTool(...)`：调用 MCP server tool
- `uninstallServer(...)`：卸载 server

默认内置了三个 mock domain servers：

- `calendar`
- `organization`
- `todo`

其中：

- `calendar/list_events`：查询日程数据
- `calendar/create_event_draft`：生成待确认的日程创建草稿
- `calendar/list_recent_created_events`：读取最近创建的日程记录
- `organization/search_people`：按姓名查询机构人员候选数据
- `todo/list_recent_todo_messages`：读取用户近期待办消息

### 5. 动态模型接口配置

`packages/agent/src/agent/storage.ts` + `packages/agent/src/agent/llm.ts` 通过 `playground/.env.local` 提供模型配置能力：

- `PUBLIC_MODEL_ACTIVE`：当前激活模型 key
- `PUBLIC_MODEL_REGISTRY_JSON`：模型列表 JSON，包含 provider / label / baseUrl / apiKey / model
- `systemPrompt`：系统提示词
- `enabled`：开启或关闭真实模型调用

示例配置：

```bash
PUBLIC_MODEL_ENABLED=false
PUBLIC_MODEL_ACTIVE=GPT
PUBLIC_MODEL_REGISTRY_JSON={"GPT":{"provider":"GPT","label":"GPT","baseUrl":"","apiKey":"","model":"gpt-4o-mini"},"QWEN":{"provider":"QWEN","label":"Qwen/Qwen3-32B","baseUrl":"","apiKey":"","model":"Qwen/Qwen3-32B"}}
PUBLIC_MODEL_SYSTEM_PROMPT=你是企业日程 AI 助手。仅处理日程创建与日程查询。新增日程时优先基于最近待办消息推荐主题和时间，并校验主题、开始日期、结束日期是否齐全。
```

若未开启或接口不可用，则自动回退到内置 Agent 响应模板。实际上线切换时，只需要更新 `playground/.env.local` 中的激活 key，或直接增删 `PUBLIC_MODEL_REGISTRY_JSON` 里的模型项。

## 开发启动

```bash
pnpm install
pnpm dev
```

单独开发 agent 包：

```bash
pnpm --filter @schedule-assistant/agent test
pnpm --filter @schedule-assistant/agent build
```

## 构建与测试

```bash
pnpm build
pnpm test
pnpm lint
```

## Lint 与保存自动修复

项目已接入 `oxlint`：

- 运行检查：`pnpm lint`
- 自动修复：`pnpm lint:fix`
- 编辑器保存自动修复：依赖工作区 [`.vscode/settings.json`](/Users/yuzili/Projects/agents/schedule-assistant/.vscode/settings.json) 中的 `source.fixAll.oxc`

推荐安装 [`.vscode/extensions.json`](/Users/yuzili/Projects/agents/schedule-assistant/.vscode/extensions.json) 里的 `oxc.oxc-vscode` 扩展。

## 后续可扩展方向

- 将 `mock.ts` 替换为真实 MCP Client 与 Domain MCP Servers
- 将机构人员服务、会议室服务、日历写入接口替换为真实后端服务
- 将工具执行改为确认后真正写入日历系统
- 为不同模型协议增加适配层，而不仅限于 OpenAI 兼容格式
