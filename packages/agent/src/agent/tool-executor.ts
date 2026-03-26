import {
  AgentMessage,
  AgentResultMetadata,
  CreateCalendarDraft,
  PersonCandidate,
} from "../types";
import {
  ExtractedEntities,
  InMemoryToolRegistry,
  RouteDecision,
  ToolDefinition,
} from "../router";
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
  metadata?: AgentResultMetadata & Record<string, unknown>;
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
  if (entities.selectedPersonNames.length > 0) {
    return entities.selectedPersonNames.join("、");
  }
  if (entities.personNames.length > 0) {
    return entities.personNames.join("、");
  }
  if (entities.emails.length > 0) {
    return entities.emails.join("、");
  }
  return "未选择";
}

function buildDraft(entities: ExtractedEntities): CreateCalendarDraft {
  return {
    title: entities.eventTitle ?? "",
    startDate: entities.startDate ?? "",
    endDate: entities.endDate ?? "",
    allDay: entities.allDay,
    meetingRoom: entities.meetingRoom,
    description: entities.description,
    attachments: entities.attachments,
    reminderChannels: entities.reminderChannels,
    urgent: entities.urgent,
    attendeeNameQuery: entities.personNames[0],
    selectedAttendeeIds: entities.selectedPersonIds,
    selectedAttendeeNames: entities.selectedPersonNames,
  };
}

export const getCalendarEventsExecutor: ToolExecutor = {
  toolName: "get_calendar_events",
  async execute({ mcpClient, decision }) {
    const result = await mcpClient.callTool({
      serverId: "calendar",
      toolName: "list_events",
      args: {
        title: decision.extractedParams.eventTitle,
        startDate: decision.extractedParams.startDate ?? decision.extractedParams.dateRange?.start,
        endDate: decision.extractedParams.endDate ?? decision.extractedParams.dateRange?.end,
      },
    });

    return {
      content: result.content || "未查询到符合条件的日程数据。",
      status: "completed",
      metadata: {
        queriedEvents: Array.isArray(result.data)
          ? (result.data as AgentResultMetadata["queriedEvents"])
          : undefined,
      },
    };
  },
};

export const createCalendarEventExecutor: ToolExecutor = {
  toolName: "create_calendar_event",
  async execute({ decision, mcpClient }) {
    const draft = buildDraft(decision.extractedParams);

    if (decision.missingParams.length > 0) {
      return {
        content: `可以创建日程，但还缺少参数：${decision.missingParams.join("、")}。请至少补充“主题、开始日期、结束日期”。`,
        status: "preview",
        metadata: {
          draft,
        },
      };
    }

    if (
      decision.extractedParams.personNames.length > 0 &&
      decision.extractedParams.selectedPersonIds.length === 0
    ) {
      const searchName = decision.extractedParams.personNames[0];
      const peopleResult = await mcpClient.callTool({
        serverId: "organization",
        toolName: "search_people",
        args: {
          keyword: searchName,
        },
      });
      const candidates = Array.isArray(peopleResult.data)
        ? (peopleResult.data as PersonCandidate[])
        : [];

      return {
        content:
          candidates.length > 0
            ? `已根据参会人姓名“${searchName}”找到候选人员，请在下方卡片中手动选择。`
            : `未找到参会人“${searchName}”的候选人员，请更换姓名或稍后重试。`,
        status: "preview",
        metadata: {
          draft,
          personCandidates: candidates,
        },
      };
    }

    const result = await mcpClient.callTool({
      serverId: "calendar",
      toolName: "create_event_draft",
      args: {
        title: decision.extractedParams.eventTitle,
        startDate: decision.extractedParams.startDate,
        endDate: decision.extractedParams.endDate,
        allDay: decision.extractedParams.allDay ?? false,
        meetingRoom: decision.extractedParams.meetingRoom,
        description: decision.extractedParams.description,
        attachments: decision.extractedParams.attachments.join("、"),
        reminderChannels: decision.extractedParams.reminderChannels.join("、"),
        urgent: decision.extractedParams.urgent ?? false,
        recipients: joinRecipients(decision.extractedParams),
      },
    });

    return {
      content: result.content,
      status: "preview",
      metadata: {
        draft,
      },
    };
  },
};

export function createDefaultToolExecutorRegistry(): InMemoryToolExecutorRegistry {
  return new InMemoryToolExecutorRegistry([
    getCalendarEventsExecutor,
    createCalendarEventExecutor,
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

  return executor.execute({
    decision,
    tool,
    messages,
    mcpClient,
  });
}
