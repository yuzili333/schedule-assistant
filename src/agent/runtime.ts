import {
  ChatMessage,
  InMemorySkillRegistry,
  InMemoryToolRegistry,
  RequestRouter,
  RouteDecision,
} from "../router";
import {
  faqPairs,
  mockEvents,
  mockTasks,
  skillDefinitions,
  toolDefinitions,
} from "../data/mock";
import { ChatItem, ModelSettings } from "../types/chat";
import { generateWithDynamicModel } from "./llm";
import {
  createDefaultToolExecutorRegistry,
  dispatchToolExecution,
} from "./tool-executor";

const router = new RequestRouter({
  skillRegistry: new InMemorySkillRegistry(skillDefinitions),
  toolRegistry: new InMemoryToolRegistry(toolDefinitions),
  options: {
    directThreshold: 0.78,
    skillThreshold: 0.66,
    toolThreshold: 0.7,
    llmThreshold: 0.52,
  },
});
const toolRegistry = new InMemoryToolRegistry(toolDefinitions);
const toolExecutorRegistry = createDefaultToolExecutorRegistry();

function toHistory(messages: ChatItem[]): ChatMessage[] {
  return messages.map((item) => ({
    role: item.role,
    content: item.content,
  }));
}

function summarizeEvents(): string {
  return mockEvents
    .map((event) => {
      const attendees = event.attendees.join("、");
      return `- ${event.start}-${event.end} ${event.title}，地点 ${event.location}，参会人 ${attendees}`;
    })
    .join("\n");
}

function summarizeTasks(): string {
  return mockTasks
    .map((task) => `- [${task.priority}] ${task.title}，截止 ${task.dueText}`)
    .join("\n");
}

function handleSkillRoute(decision: RouteDecision): string {
  switch (decision.target) {
    case "plan_daily_schedule":
      return `我为你整理了一版执行顺序：\n${summarizeEvents()}\n待办建议：\n${summarizeTasks()}\n建议将 10:30-12:00 和 15:15-16:15 作为深度工作窗口，用于完成 P0 材料。`;
    case "meeting_to_actions":
      return `会议行动项建议：\n- 你：今天 18:00 前完成版本排期评审材料\n- 交付经理：明天上午补齐供应商接入 checklist\n- 产品经理：本周内整理客户问题优先级并同步`;
    case "schedule_optimization":
      return `当前日程存在两个优化点：\n- 上午只有 45 分钟会议，建议将 P0 文档编写集中到 10:30-12:00，减少上下文切换。\n- 14:00 与 16:30 之间有 90 分钟空档，可插入 45 分钟复盘和 30 分钟消息处理。`;
    default:
      return "技能运行时已命中，但没有找到匹配的业务模板。";
  }
}

function buildFallbackLLMResponse(question: string): string {
  return `我将按企业级日程 agent 的方式处理你的请求：\n- 先识别时间、参会人和副作用动作\n- 再判断是查询、规划还是执行型任务\n- 当前问题：${question}\n建议先补充“时间范围、参与人、目标结果”这三个关键信息，我可以继续生成更精确的安排方案。`;
}

async function handleLLMRoute(
  decision: RouteDecision,
  messages: ChatItem[],
  settings: ModelSettings,
): Promise<string> {
  const llmResult = await generateWithDynamicModel(settings, toHistory(messages));
  if (llmResult) {
    return llmResult;
  }

  return buildFallbackLLMResponse(messages[messages.length - 1]?.content ?? "");
}

export async function runScheduleAgent(
  messages: ChatItem[],
  settings: ModelSettings,
): Promise<{ content: string; decision: RouteDecision; latencyMs: number }> {
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

  if (decision.route === "direct") {
    content =
      faqPairs.get(latest.content.trim()) ??
      "已命中直达规则，但当前未找到可返回的固定结果。";
  } else if (decision.route === "tool") {
    const result = await dispatchToolExecution({
      decision,
      messages,
      toolRegistry,
      executorRegistry: toolExecutorRegistry,
    });
    content = result.content;
  } else if (decision.route === "skill") {
    content = handleSkillRoute(decision);
  } else if (decision.route === "block") {
    content =
      "当前请求属于高风险不可逆动作，策略已阻断自动执行。请先进行人工确认。";
  } else {
    content = await handleLLMRoute(decision, messages, settings);
  }

  const latencyMs = Math.round(performance.now() - startedAt);
  return { content, decision, latencyMs };
}
