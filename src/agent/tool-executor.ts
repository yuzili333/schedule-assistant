import { mockEvents } from "../data/mock";
import {
  ExtractedEntities,
  InMemoryToolRegistry,
  RouteDecision,
  ToolDefinition,
} from "../router";
import { ChatItem } from "../types/chat";

export interface ToolExecutionContext {
  decision: RouteDecision;
  tool: ToolDefinition;
  messages: ChatItem[];
}

export interface ToolExecutionResult {
  content: string;
  status: "completed" | "preview" | "blocked" | "unsupported";
  metadata?: Record<string, unknown>;
}

export interface ToolExecutor {
  toolName: string;
  execute(context: ToolExecutionContext): Promise<ToolExecutionResult> | ToolExecutionResult;
}

export interface ToolExecutorRegistry {
  list(): ToolExecutor[];
  get(toolName: string): ToolExecutor | undefined;
  register(executor: ToolExecutor): void;
}

export class InMemoryToolExecutorRegistry implements ToolExecutorRegistry {
  private readonly executors = new Map<string, ToolExecutor>();

  constructor(executors: ToolExecutor[] = []) {
    for (const executor of executors) {
      this.register(executor);
    }
  }

  list(): ToolExecutor[] {
    return [...this.executors.values()];
  }

  get(toolName: string): ToolExecutor | undefined {
    return this.executors.get(toolName);
  }

  register(executor: ToolExecutor): void {
    this.executors.set(executor.toolName, executor);
  }
}

function joinRecipients(entities: ExtractedEntities): string {
  if (entities.personNames.length > 0) {
    return entities.personNames.join("、");
  }
  if (entities.emails.length > 0) {
    return entities.emails.join("、");
  }
  return entities.email ?? "待补充";
}

export const getCalendarEventsExecutor: ToolExecutor = {
  toolName: "get_calendar_events",
  execute() {
    const content = mockEvents
      .map((event) => {
        const attendees = event.attendees.join("、");
        return `- ${event.start}-${event.end} ${event.title}，地点 ${event.location}，参会人 ${attendees}`;
      })
      .join("\n");

    return {
      content: `今天已识别到以下日程：\n${content}`,
      status: "completed",
    };
  },
};

export const createCalendarEventExecutor: ToolExecutor = {
  toolName: "create_calendar_event",
  execute({ decision }) {
    if (decision.missingParams.length > 0) {
      return {
        content: `可以创建日程，但还缺少参数：${decision.missingParams.join("、")}。请补充具体时间或参会人。`,
        status: "preview",
      };
    }

    return {
      content: `已生成会议草案：\n- 标题：项目同步会\n- 时间：${String(
        decision.extractedParams.timeText ?? "待确认",
      )}\n- 参会人：${joinRecipients(decision.extractedParams)}\n- 地点：${String(
        decision.extractedParams.meetingRoom ??
          decision.extractedParams.location ??
          "待补充",
      )}\n- 状态：待人工确认后写入日历`,
      status: "preview",
    };
  },
};

export const sendScheduleDigestExecutor: ToolExecutor = {
  toolName: "send_schedule_digest",
  execute({ decision }) {
    return {
      content: `这是外部副作用动作，当前策略要求人工确认。\n建议先预览摘要，再确认收件人 ${joinRecipients(
        decision.extractedParams,
      )}。`,
      status: "preview",
      metadata: {
        policyDecision: decision.risk.policyDecision,
      },
    };
  },
};

export const bulkRescheduleExecutor: ToolExecutor = {
  toolName: "bulk_reschedule_events",
  execute({ decision }) {
    const count =
      decision.extractedParams.numericParams.find((entity) => entity.unit === "个")
        ?.value ??
      decision.extractedParams.numericParams[0]?.value ??
      "多";

    return {
      content: `检测到批量改期请求，范围 ${decision.extractedParams.dateRange?.raw ?? "待确认"}，预计影响 ${count} 个日程。该操作需要审批后才能执行。`,
      status: "blocked",
      metadata: {
        policyDecision: decision.risk.policyDecision,
      },
    };
  },
};

export const weatherExecutor: ToolExecutor = {
  toolName: "get_weather",
  execute({ decision }) {
    const location =
      decision.extractedParams.location ??
      decision.extractedParams.meetingRoom ??
      "默认办公区";
    return {
      content: `${location} 明天下午有小雨，适合线上会议；若需要外出，建议预留 20 分钟机动时间。`,
      status: "completed",
    };
  },
};

export function createDefaultToolExecutorRegistry(): InMemoryToolExecutorRegistry {
  return new InMemoryToolExecutorRegistry([
    getCalendarEventsExecutor,
    createCalendarEventExecutor,
    sendScheduleDigestExecutor,
    bulkRescheduleExecutor,
    weatherExecutor,
  ]);
}

export async function dispatchToolExecution(params: {
  decision: RouteDecision;
  messages: ChatItem[];
  toolRegistry: InMemoryToolRegistry;
  executorRegistry: ToolExecutorRegistry;
}): Promise<ToolExecutionResult> {
  const { decision, messages, toolRegistry, executorRegistry } = params;
  const toolName = decision.target;

  if (!toolName) {
    return {
      content: "工具路由缺少目标工具名，无法执行。",
      status: "unsupported",
    };
  }

  const tool = toolRegistry.getByName(toolName);
  if (!tool) {
    return {
      content: `工具 ${toolName} 未在 registry 中注册。`,
      status: "unsupported",
    };
  }

  const executor = executorRegistry.get(toolName);
  if (!executor) {
    return {
      content: `工具 ${toolName} 已命中，但当前没有对应的 ToolExecutor。`,
      status: "unsupported",
    };
  }

  if (decision.risk.policyDecision === "block") {
    return {
      content: `工具 ${toolName} 属于 ${tool.executionPolicy.effectType}，当前策略已阻断自动执行。`,
      status: "blocked",
      metadata: {
        policyDecision: decision.risk.policyDecision,
        effectType: tool.executionPolicy.effectType,
      },
    };
  }

  return executor.execute({
    decision,
    tool,
    messages,
  });
}
