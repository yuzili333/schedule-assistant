import {
  ExtractedEntities,
  InMemoryToolRegistry,
  RouteDecision,
  ToolDefinition,
} from "../router";
import { AgentMessage } from "../types";
import { McpClient } from "../mcp";

export interface ToolExecutionContext {
  decision: RouteDecision;
  tool: ToolDefinition;
  messages: AgentMessage[];
  mcpClient: McpClient;
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
  async execute({ mcpClient }) {
    const result = await mcpClient.callTool({
      serverId: "calendar",
      toolName: "list_events",
    });

    return {
      content: `今天已识别到以下日程：\n${result.content}`,
      status: "completed",
      metadata: {
        source: "mcp:calendar/list_events",
      },
    };
  },
};

export const createCalendarEventExecutor: ToolExecutor = {
  toolName: "create_calendar_event",
  async execute({ decision, mcpClient }) {
    if (decision.missingParams.length > 0) {
      return {
        content: `可以创建日程，但还缺少参数：${decision.missingParams.join("、")}。请补充具体时间或参会人。`,
        status: "preview",
      };
    }

    const result = await mcpClient.callTool({
      serverId: "calendar",
      toolName: "create_event_draft",
      args: {
        timeText: decision.extractedParams.timeText,
        recipients: joinRecipients(decision.extractedParams),
        location:
          decision.extractedParams.meetingRoom ??
          decision.extractedParams.location ??
          "待补充",
      },
    });

    return {
      content: result.content,
      status: "preview",
      metadata: {
        source: "mcp:calendar/create_event_draft",
      },
    };
  },
};

export const sendScheduleDigestExecutor: ToolExecutor = {
  toolName: "send_schedule_digest",
  async execute({ decision, mcpClient }) {
    const result = await mcpClient.callTool({
      serverId: "notification",
      toolName: "preview_schedule_digest",
      args: {
        recipients: joinRecipients(decision.extractedParams),
      },
    });

    return {
      content: result.content,
      status: "preview",
      metadata: {
        policyDecision: decision.risk.policyDecision,
        source: "mcp:notification/preview_schedule_digest",
      },
    };
  },
};

export const bulkRescheduleExecutor: ToolExecutor = {
  toolName: "bulk_reschedule_events",
  async execute({ decision, mcpClient }) {
    const count =
      decision.extractedParams.numericParams.find((entity) => entity.unit === "个")
        ?.value ??
      decision.extractedParams.numericParams[0]?.value ??
      "多";

    const result = await mcpClient.callTool({
      serverId: "calendar",
      toolName: "bulk_reschedule_preview",
      args: {
        dateRange: decision.extractedParams.dateRange?.raw ?? "待确认",
        count,
      },
    });

    return {
      content: result.content,
      status: "blocked",
      metadata: {
        policyDecision: decision.risk.policyDecision,
        source: "mcp:calendar/bulk_reschedule_preview",
      },
    };
  },
};

export const weatherExecutor: ToolExecutor = {
  toolName: "get_weather",
  async execute({ decision, mcpClient }) {
    const location =
      decision.extractedParams.location ??
      decision.extractedParams.meetingRoom ??
      "默认办公区";

    const result = await mcpClient.callTool({
      serverId: "weather",
      toolName: "get_weather_brief",
      args: {
        location,
      },
    });

    return {
      content: result.content,
      status: "completed",
      metadata: {
        source: "mcp:weather/get_weather_brief",
      },
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
  messages: AgentMessage[];
  toolRegistry: InMemoryToolRegistry;
  executorRegistry: ToolExecutorRegistry;
  mcpClient: McpClient;
}): Promise<ToolExecutionResult> {
  const { decision, messages, toolRegistry, executorRegistry, mcpClient } = params;
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
    mcpClient,
  });
}
