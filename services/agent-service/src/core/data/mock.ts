import { SkillDefinition, ToolDefinition } from "../router/types";
import { CalendarEventRecord, PersonCandidate } from "../types";

export interface TodoMessageRecord {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

export const skillDefinitions: SkillDefinition[] = [
  {
    skillId: "recommend_create_calendar_prefill",
    name: "新增日程预填充",
    aliases: ["新增日程", "创建日程", "新建会议", "安排会议", "推荐日程"],
    description: "基于近期待办消息和最近创建的日程，为新增日程推荐主题、时间、参会人、抄送人与资源字段。",
    supportedIntents: ["action", "workflow"],
    tags: ["calendar", "prefill"],
  },
];

export const toolDefinitions: ToolDefinition[] = [
  {
    toolName: "create_calendar_event",
    description: "创建日程数据",
    actionType: "create",
    objectType: "calendar_event",
    requiredParams: ["eventTitle", "startDate", "endDate"],
    optionalParams: [
      "allDay",
      "meetingRoom",
      "description",
      "attachments",
      "reminderChannels",
      "urgent",
      "personNames",
      "selectedPersonIds",
      "selectedPersonNames",
    ],
    executionPolicy: {
      effectType: "reversible",
      requiresConfirmation: true,
      reversible: true,
      allowInProd: true,
    },
    latencyClass: "normal",
    aliases: ["创建日程", "新建日程", "创建会议", "安排日程", "安排会议"],
    tags: ["calendar", "create"],
  },
  {
    toolName: "get_calendar_events",
    description: "查询日程数据",
    actionType: "query",
    objectType: "calendar_event",
    requiredParams: [],
    optionalParams: ["dateRange", "startDate", "endDate", "eventTitle"],
    executionPolicy: {
      effectType: "read_only",
      allowInProd: true,
    },
    latencyClass: "fast",
    aliases: ["查询日程", "查看日程", "获取日程", "今天有哪些会议", "日程查询"],
    tags: ["calendar", "query"],
  },
];

export const mockPeople: PersonCandidate[] = [
  {
    id: "EMP-1001",
    name: "张三",
    department: "产品研发中心",
    title: "产品经理",
    email: "zhangsan@example.com",
  },
  {
    id: "EMP-1002",
    name: "张三",
    department: "增长运营中心",
    title: "运营经理",
    email: "zhangsan.ops@example.com",
  },
  {
    id: "EMP-1003",
    name: "李四",
    department: "交付中心",
    title: "交付经理",
    email: "lisi@example.com",
  },
  {
    id: "EMP-1004",
    name: "王五",
    department: "设计中心",
    title: "视觉设计师",
    email: "wangwu@example.com",
  },
];

export const mockEvents: CalendarEventRecord[] = [
  {
    id: "evt-1",
    title: "需求评审会",
    startDate: "2026-03-26 09:30",
    endDate: "2026-03-26 10:30",
    allDay: false,
    meetingRoom: "6F Maple",
    videoMeetingCode: "885-210-330",
    description: "评审新版本需求范围",
    attendees: [mockPeople[0], mockPeople[3]],
    ccRecipients: [mockPeople[2]],
    reminderChannels: ["app"],
    urgent: false,
  },
  {
    id: "evt-2",
    title: "客户项目同步",
    startDate: "2026-03-26 14:00",
    endDate: "2026-03-26 15:00",
    allDay: false,
    meetingRoom: "3F Aurora",
    videoMeetingCode: "990-111-452",
    description: "同步交付里程碑",
    attendees: [mockPeople[2]],
    ccRecipients: [mockPeople[0]],
    reminderChannels: ["app", "sms"],
    urgent: true,
  },
];

export const mockTodoMessages: TodoMessageRecord[] = [
  {
    id: "todo-1",
    title: "客户需求澄清会议待安排",
    content:
      "请尽快安排客户需求澄清会，建议在 2026-03-28 15:00 到 16:00 进行。参与者：张三、李四。抄送：王五。需要同步需求边界和交付排期。",
    createdAt: "2026-03-26 09:10",
  },
  {
    id: "todo-2",
    title: "版本复盘会议",
    content:
      "下周安排一次版本复盘，重点讨论发布问题和优化项，暂未指定参会人与会议室。",
    createdAt: "2026-03-25 17:45",
  },
];

export const faqPairs = new Map<string, string>();
