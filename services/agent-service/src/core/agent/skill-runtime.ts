import {
  AgentMessage,
  AgentResultMetadata,
  CachedCalendarSubmission,
  CalendarEventRecord,
  CreateCalendarDraft,
  PersonLookupCandidate,
  ScheduleRecommendation,
} from "../types";
import { McpClient } from "../mcp";
import { getLatestValidCalendarSubmission } from "./storage";
import { normalizeRequest } from "../router";

interface TodoMessageRecord {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

export interface SkillExecutionContext {
  skillId: string;
  messages: AgentMessage[];
  mcpClient: McpClient;
}

export interface SkillExecutionResult {
  content: string;
  metadata?: AgentResultMetadata;
}

function extractNames(content: string, labels: string[]): string[] {
  for (const label of labels) {
    const match = content.match(new RegExp(`${label}[：:]\\s*([^。\\n]+)`));
    if (match?.[1]) {
      return match[1]
        .split(/[、,，;；]/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function extractDate(content: string, label: "start" | "end"): string | undefined {
  if (label === "start") {
    return (
      content.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s*(?:到|至|~|-)/)?.[1] ??
      content.match(/开始(?:日期|时间)?[：:]\s*([^\n，。]+)/)?.[1]?.trim()
    );
  }

  const start = extractDate(content, "start");
  const endTime = content.match(/(?:到|至|~|-)\s*(\d{2}:\d{2})/)?.[1];
  if (start && endTime) {
    return `${start.slice(0, 10)} ${endTime}`;
  }

  return content.match(/结束(?:日期|时间)?[：:]\s*([^\n，。]+)/)?.[1]?.trim();
}

async function searchCandidates(
  mcpClient: McpClient,
  role: "attendee" | "cc",
  names: string[],
): Promise<PersonLookupCandidate[]> {
  const items = await Promise.all(
    names.map(async (name) => {
      const result = await mcpClient.callTool({
        serverId: "organization",
        toolName: "search_people",
        args: { keyword: name },
      });

      const candidates = Array.isArray(result.data) ? result.data : [];
      return candidates.map((candidate) => ({
        ...(candidate as Omit<PersonLookupCandidate, "role" | "sourceName">),
        role,
        sourceName: name,
      }));
    }),
  );

  return items.flat();
}

function formatRecommendedFields(recommendation: ScheduleRecommendation): string {
  return recommendation.recommendedFields
    .map(
      (field) =>
        `- ${field.fieldLabel}：${field.value}（来源：${field.source === "recent_todo" ? "近期待办" : "最近日程"}）`,
    )
    .join("\n");
}

function findRecentValue(
  recentEvent: CalendarEventRecord | undefined,
  field: "meetingRoom" | "videoMeetingCode" | "attendees" | "ccRecipients",
): string | undefined {
  if (!recentEvent) {
    return undefined;
  }

  if (field === "meetingRoom") {
    return recentEvent.meetingRoom;
  }
  if (field === "videoMeetingCode") {
    return recentEvent.videoMeetingCode;
  }
  if (field === "attendees") {
    return recentEvent.attendees.map((item) => item.name).join("、");
  }
  return recentEvent.ccRecipients?.map((item) => item.name).join("、");
}

function findCachedValue(
  cachedSubmission: CachedCalendarSubmission | undefined,
  field: "attendees" | "ccRecipients",
): string | undefined {
  if (!cachedSubmission) {
    return undefined;
  }

  if (field === "attendees") {
    return cachedSubmission.attendeeNames.join("、");
  }

  return cachedSubmission.ccNames.join("、");
}

export async function runScheduleSkill(
  context: SkillExecutionContext,
): Promise<SkillExecutionResult> {
  if (context.skillId !== "recommend_create_calendar_prefill") {
    return {
      content: `当前 skill ${context.skillId} 未实现。`,
    };
  }

  const [todoResult, recentEventResult] = await Promise.all([
    context.mcpClient.callTool({
      serverId: "todo",
      toolName: "list_recent_todo_messages",
    }),
    context.mcpClient.callTool({
      serverId: "calendar",
      toolName: "list_recent_created_events",
    }),
  ]);

  const latestTodo = (Array.isArray(todoResult.data) ? todoResult.data[0] : undefined) as
    | TodoMessageRecord
    | undefined;
  const recentEvent = (Array.isArray(recentEventResult.data)
    ? recentEventResult.data[0]
    : undefined) as CalendarEventRecord | undefined;
  const latestCache = getLatestValidCalendarSubmission();
  const latestUserMessage = [...context.messages]
    .reverse()
    .find((message) => message.role === "user");
  const normalizedLatestMessage = latestUserMessage
    ? normalizeRequest({
        id: latestUserMessage.id,
        text: latestUserMessage.content,
      })
    : undefined;
  const explicitAttendeeNames =
    normalizedLatestMessage?.entities.selectedPersonNames.length
      ? normalizedLatestMessage.entities.selectedPersonNames
      : (normalizedLatestMessage?.entities.personNames ?? []);
  const explicitCcNames =
    normalizedLatestMessage?.entities.selectedCcNames.length
      ? normalizedLatestMessage.entities.selectedCcNames
      : (normalizedLatestMessage?.entities.ccPersonNames ?? []);
  const explicitAttendeeIds = normalizedLatestMessage?.entities.selectedPersonIds ?? [];
  const explicitCcIds = normalizedLatestMessage?.entities.selectedCcIds ?? [];

  if (!latestTodo) {
    return {
      content: "未读取到近期待办消息，请直接补充主题、开始日期和结束日期后创建日程。",
    };
  }

  const attendeeNames = extractNames(latestTodo.content, ["参与者", "参会人", "参与人"]);
  const ccNames = extractNames(latestTodo.content, ["抄送", "抄送人", "CC"]);
  const draft: CreateCalendarDraft = {
    title: latestTodo.title,
    startDate: extractDate(latestTodo.content, "start") ?? "",
    endDate: extractDate(latestTodo.content, "end") ?? "",
    attendeeNameQueries: explicitAttendeeNames.length > 0 ? explicitAttendeeNames : [],
    ccNameQueries: explicitCcNames.length > 0 ? explicitCcNames : [],
    meetingRoom: findRecentValue(recentEvent, "meetingRoom"),
    videoMeetingCode: findRecentValue(recentEvent, "videoMeetingCode"),
    selectedAttendeeNames: explicitAttendeeNames.length > 0 ? explicitAttendeeNames : [],
    selectedAttendeeIds: explicitAttendeeIds,
    selectedCcNames: explicitCcNames.length > 0 ? explicitCcNames : [],
    selectedCcIds: explicitCcIds,
    suggestionSource: "recent_todo",
    suggestionSummary: "已根据最近一条待办消息生成新增日程推荐内容。",
  };

  const recommendedFields: ScheduleRecommendation["recommendedFields"] = [
    {
      fieldLabel: "主题",
      value: draft.title || "未识别",
      source: "recent_todo",
    },
  ];

  if (draft.startDate) {
    recommendedFields.push({
      fieldLabel: "开始日期",
      value: draft.startDate,
      source: "recent_todo",
    });
  }
  if (draft.endDate) {
    recommendedFields.push({
      fieldLabel: "结束日期",
      value: draft.endDate,
      source: "recent_todo",
    });
  }
  if (explicitAttendeeNames.length === 0 && draft.attendeeNameQueries && draft.attendeeNameQueries.length > 0) {
    recommendedFields.push({
      fieldLabel: "参会人",
      value: draft.attendeeNameQueries.join("、"),
      source: "recent_todo",
    });
  }
  if (explicitCcNames.length === 0 && draft.ccNameQueries && draft.ccNameQueries.length > 0) {
    recommendedFields.push({
      fieldLabel: "抄送人",
      value: draft.ccNameQueries.join("、"),
      source: "recent_todo",
    });
  }
  if (draft.meetingRoom) {
    recommendedFields.push({
      fieldLabel: "会议室",
      value: draft.meetingRoom,
      source: "recent_event",
    });
  }
  if (draft.videoMeetingCode) {
    recommendedFields.push({
      fieldLabel: "视频会议号",
      value: draft.videoMeetingCode,
      source: "recent_event",
    });
  }

  if (explicitAttendeeNames.length === 0 && draft.attendeeNameQueries?.length === 0) {
    const cachedAttendees = findCachedValue(latestCache, "attendees");
    if (cachedAttendees) {
      draft.selectedAttendeeNames = latestCache?.attendeeNames ?? [];
      draft.selectedAttendeeIds = latestCache?.attendeeIds ?? [];
      recommendedFields.push({
        fieldLabel: "参会人",
        value: cachedAttendees,
        source: "cache",
      });
    }
  }

  if (explicitAttendeeNames.length === 0 && draft.attendeeNameQueries?.length === 0 && draft.selectedAttendeeNames?.length === 0) {
    if (attendeeNames.length > 0) {
      draft.attendeeNameQueries = attendeeNames;
      recommendedFields.push({
        fieldLabel: "参会人",
        value: attendeeNames.join("、"),
        source: "recent_todo",
      });
    } else {
      const recentAttendees = findRecentValue(recentEvent, "attendees");
      if (recentAttendees) {
        draft.attendeeNameQueries = recentAttendees.split("、").filter(Boolean);
        recommendedFields.push({
          fieldLabel: "参会人",
          value: recentAttendees,
          source: "recent_event",
        });
      }
    }
  }

  if (explicitCcNames.length === 0 && draft.ccNameQueries?.length === 0) {
    const cachedCc = findCachedValue(latestCache, "ccRecipients");
    if (cachedCc) {
      draft.selectedCcNames = latestCache?.ccNames ?? [];
      draft.selectedCcIds = latestCache?.ccIds ?? [];
      recommendedFields.push({
        fieldLabel: "抄送人",
        value: cachedCc,
        source: "cache",
      });
    }
  }

  if (explicitCcNames.length === 0 && draft.ccNameQueries?.length === 0 && draft.selectedCcNames?.length === 0) {
    if (ccNames.length > 0) {
      draft.ccNameQueries = ccNames;
      recommendedFields.push({
        fieldLabel: "抄送人",
        value: ccNames.join("、"),
        source: "recent_todo",
      });
    } else {
      const recentCc = findRecentValue(recentEvent, "ccRecipients");
      if (recentCc) {
        draft.ccNameQueries = recentCc.split("、").filter(Boolean);
        recommendedFields.push({
          fieldLabel: "抄送人",
          value: recentCc,
          source: "recent_event",
        });
      }
    }
  }

  const [attendeeCandidates, ccCandidates] = await Promise.all([
    searchCandidates(context.mcpClient, "attendee", draft.attendeeNameQueries ?? []),
    searchCandidates(context.mcpClient, "cc", draft.ccNameQueries ?? []),
  ]);

  const recommendation: ScheduleRecommendation = {
    summary:
      "参会人和抄送人的推荐优先级为：用户本次明确描述 > 7 天内有效缓存 > 待办消息 > 最近创建日程；主题和时间仍优先读取最近一条待办消息。",
    sourceTodoTitle: latestTodo.title,
    sourceTodoSummary: latestTodo.content,
    recommendedFields,
    needsUserConfirm: true,
  };

  return {
    content: `已为你生成新增日程推荐草稿：\n${formatRecommendedFields(recommendation)}\n\n如确认采纳上述推荐内容，请点击“采纳推荐填充”；若需确认人员名单，可直接点击下方候选卡片逐步选择。`,
    metadata: {
      draft,
      personCandidates: [...attendeeCandidates, ...ccCandidates],
      recommendation,
    },
  };
}
