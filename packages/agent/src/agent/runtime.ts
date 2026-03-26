import {
  ChatMessage,
  InMemoryToolRegistry,
  RequestRouter,
  RouteDecision,
} from "../router";
import { faqPairs, toolDefinitions } from "../data/mock";
import { AgentMessage, AgentResultMetadata, ModelSettings } from "../types";
import { streamWithDynamicModel } from "./llm";
import {
  createDefaultToolExecutorRegistry,
  dispatchToolExecution,
} from "./tool-executor";
import {
  createDefaultMcpServers,
  DefaultMcpClient,
  InMemoryMcpServerRegistry,
} from "../mcp";

const router = new RequestRouter({
  toolRegistry: new InMemoryToolRegistry(toolDefinitions),
  options: {
    directThreshold: 0.78,
    toolThreshold: 0.7,
    llmThreshold: 0.52,
  },
});
const toolRegistry = new InMemoryToolRegistry(toolDefinitions);
const toolExecutorRegistry = createDefaultToolExecutorRegistry();
const mcpServerRegistry = new InMemoryMcpServerRegistry(createDefaultMcpServers());
const mcpClient = new DefaultMcpClient(mcpServerRegistry);

function toHistory(messages: AgentMessage[]): ChatMessage[] {
  return messages.map((item) => ({
    role: item.role,
    content: item.content,
  }));
}

function buildFallbackLLMResponse(question: string): string {
  return `当前助手聚焦两个能力：日程创建和日程查询。\n你的输入：${question}\n创建日程请至少提供“主题、开始日期、结束日期”；如需添加参会人，请写明姓名，系统会返回机构人员候选卡片供手动选择。`;
}

function splitIntoChunks(content: string): string[] {
  const chunks = content.match(/.{1,12}|\n/g) ?? [];
  return chunks.length > 0 ? chunks : [content];
}

async function handleLLMRoute(
  messages: AgentMessage[],
  settings: ModelSettings,
  onChunk?: (chunk: string) => void,
): Promise<string> {
  const llmResult = await streamWithDynamicModel({
    settings,
    messages: toHistory(messages),
    onChunk,
  });
  if (llmResult) {
    return llmResult;
  }

  const fallback = buildFallbackLLMResponse(messages[messages.length - 1]?.content ?? "");
  for (const chunk of splitIntoChunks(fallback)) {
    onChunk?.(chunk);
  }
  return fallback;
}

export async function runScheduleAgent(
  messages: AgentMessage[],
  settings: ModelSettings,
  onChunk?: (chunk: string) => void,
): Promise<{
  content: string;
  decision: RouteDecision;
  latencyMs: number;
  resultMetadata?: AgentResultMetadata;
}> {
  const startedAt = performance.now();
  const latest = messages[messages.length - 1];

  const decision = router.route(
    {
      id: latest.id,
      text: latest.content,
      history: toHistory(messages.slice(-8)),
    },
    {
      environment: "prod",
      faqCache: faqPairs,
    },
  );

  let content: string;
  let resultMetadata: AgentResultMetadata | undefined;

  if (decision.route === "tool") {
    const result = await dispatchToolExecution({
      decision,
      messages,
      toolRegistry,
      executorRegistry: toolExecutorRegistry,
      mcpClient,
    });
    content = result.content;
    resultMetadata = result.metadata;
    for (const chunk of splitIntoChunks(content)) {
      onChunk?.(chunk);
    }
  } else if (decision.route === "direct") {
    content = "已识别为日程查询请求，建议直接补充查询条件后执行。";
    for (const chunk of splitIntoChunks(content)) {
      onChunk?.(chunk);
    }
  } else if (decision.route === "block") {
    content = "当前请求被策略阻断，请检查输入参数后重试。";
    for (const chunk of splitIntoChunks(content)) {
      onChunk?.(chunk);
    }
  } else {
    content = await handleLLMRoute(messages, settings, onChunk);
  }

  const latencyMs = Math.round(performance.now() - startedAt);
  return { content, decision, latencyMs, resultMetadata };
}
