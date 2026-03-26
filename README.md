# 日程 AI 助手 Monorepo

## 项目说明

本仓库实现了一个面向企业场景的日程 AI 助手 Agent。应用端采用 `rsbuild + React + tailwindcss`，消息卡片使用 `lit` 自定义元素渲染，Agent 运行时则围绕 README 中定义的企业级架构落地：

`Router + SkillRuntime + ToolExecutor + MCP Client + Domain MCP Servers + Result Compressor + Policy/State/Cost Control`

当前版本提供一个可直接运行的 Web Chatbox 原型，支持：

- 自然语言日程规划、时间优化、会议行动项提取
- Router 对查询、技能、工具、LLM 的打分决策
- ToolExecutor Registry + Executor Contract 的工具分发与执行
- MCP server 的注册、发现、调用、卸载
- 高风险副作用动作的风险识别与人工确认提示
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
- `packages/agent`：日程助手 agent 包目录，负责 Router、SkillRuntime、ToolExecutor、MCP 等核心逻辑，后续可单独开发、测试和发布

## 功能设计

### 1. Router

`packages/agent/src/router/*` 负责对用户请求做标准化、匹配、风险评估和最终路由。

- `direct`：FAQ 或固定规则直达
- `tool`：执行型工具，如创建日程、发送摘要、查询天气
- `skill`：规划型技能，如日程规划、会议纪要转行动项、时间优化
- `llm`：低置信度或开放式复杂问题回退到大模型
- `block`：高风险不可逆操作拦截

### 2. Skill Runtime

`packages/agent/src/agent/runtime.ts` 提供最小可运行的 Agent 运行时：

- 复用 Router 做意图判断
- 对 `tool` 路由交由独立 ToolExecutor 层分发执行
- 基于 mock 数据模拟 Calendar / Mail / Weather / Task 等领域服务
- 对工具结果进行压缩整理后输出给 Chat UI

### 3. ToolExecutor

`packages/agent/src/agent/tool-executor.ts` 提供正式的 ToolExecutor 抽象：

- `ToolExecutor`：单工具执行 contract
- `ToolExecutorRegistry`：执行器注册与发现
- `dispatchToolExecution(...)`：按 Router 决策、policy 和 registry 分发
- 默认执行器覆盖 Calendar / Mail / Weather / Bulk Reschedule

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
- `notification`
- `weather`

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
PUBLIC_MODEL_SYSTEM_PROMPT=你是企业日程 AI 助手。优先输出结构化、可执行、低风险的安排建议。
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
- 增加语音输入、拖拽排期、提醒通知等交互能力
- 将工具执行改为确认后真正写入日历和邮件系统
- 为不同模型协议增加适配层，而不仅限于 OpenAI 兼容格式
