import { SkillDefinition, ToolDefinition } from "../router/types";

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  attendees: string[];
  location: string;
}

export interface PendingTask {
  id: string;
  title: string;
  dueText: string;
  priority: "P0" | "P1" | "P2";
  owner: string;
}

export const skillDefinitions: SkillDefinition[] = [
  {
    skillId: "plan_daily_schedule",
    name: "plan daily schedule",
    aliases: ["日程规划", "安排今天工作", "整理行程", "生成今日计划"],
    description: "根据任务、会议和时间偏好生成可执行的日程安排",
    supportedIntents: ["workflow", "generation"],
    requiredEntities: ["timeText"],
    optionalEntities: ["priority", "location", "meetingRoom", "personNames"],
    sideEffect: false,
    complexityBand: "medium",
    tags: ["schedule", "planning"],
  },
  {
    skillId: "meeting_to_actions",
    name: "meeting to actions",
    aliases: ["会议纪要转待办", "提取行动项", "会议行动项"],
    description: "从会议内容提取行动项、负责人和截止时间",
    supportedIntents: ["workflow", "generation"],
    requiredEntities: [],
    optionalEntities: ["timeText", "personNames", "dateRange"],
    sideEffect: false,
    complexityBand: "medium",
    tags: ["meeting"],
  },
  {
    skillId: "schedule_optimization",
    name: "schedule optimization",
    aliases: ["优化日程", "时间分析", "优化时间管理"],
    description: "分析现有安排中的冲突、碎片时间和专注窗口",
    supportedIntents: ["analysis", "workflow"],
    requiredEntities: [],
    optionalEntities: ["priority", "dateRange"],
    sideEffect: false,
    complexityBand: "high",
    tags: ["optimization"],
  },
];

export const toolDefinitions: ToolDefinition[] = [
  {
    toolName: "create_calendar_event",
    description: "创建日历事件",
    actionType: "create",
    objectType: "calendar_event",
    requiredParams: ["timeText"],
    optionalParams: ["email", "personNames", "location", "meetingRoom", "priority"],
    executionPolicy: {
      effectType: "reversible",
      requiresConfirmation: true,
      reversible: true,
      allowInProd: true,
    },
    latencyClass: "normal",
    aliases: ["安排会议", "安排", "创建日程", "约会", "schedule meeting", "预定会议室"],
    tags: ["calendar", "meeting"],
  },
  {
    toolName: "get_calendar_events",
    description: "查询现有日程安排",
    actionType: "query",
    objectType: "calendar_event",
    requiredParams: [],
    optionalParams: ["timeText", "dateRange", "personNames"],
    executionPolicy: {
      effectType: "read_only",
      allowInProd: true,
    },
    latencyClass: "fast",
    aliases: ["今日日程", "我的日历", "查询日程"],
    tags: ["calendar", "read"],
  },
  {
    toolName: "send_schedule_digest",
    description: "将日程摘要通过邮件发送给参会人",
    actionType: "send",
    objectType: "email",
    requiredParams: ["email"],
    optionalParams: ["timeText", "personNames"],
    executionPolicy: {
      effectType: "external_side_effect",
      requiresConfirmation: true,
      allowInProd: true,
    },
    latencyClass: "normal",
    aliases: ["发送提醒", "发邮件", "send mail"],
    tags: ["mail", "notification"],
  },
  {
    toolName: "bulk_reschedule_events",
    description: "批量改期多个日程",
    actionType: "update",
    objectType: "calendar_event",
    requiredParams: ["dateRange"],
    optionalParams: ["numericParams", "meetingRoom"],
    executionPolicy: {
      effectType: "bulk_write",
      requiresConfirmation: true,
      allowInProd: false,
    },
    latencyClass: "slow",
    aliases: ["批量改期", "批量调整", "批量调整日程", "批量调整会议", "批量移动会议"],
    tags: ["calendar", "bulk"],
  },
  {
    toolName: "get_weather",
    description: "查询出行天气",
    actionType: "query",
    objectType: "weather",
    requiredParams: [],
    optionalParams: ["timeText", "dateRange", "location"],
    executionPolicy: {
      effectType: "read_only",
      allowInProd: true,
    },
    latencyClass: "fast",
    aliases: ["天气", "weather"],
    tags: ["travel", "read"],
  },
];

export const mockEvents: CalendarEvent[] = [
  {
    id: "evt-1",
    title: "产品周会",
    start: "09:30",
    end: "10:15",
    attendees: ["产品经理", "设计师", "前端负责人"],
    location: "3F Aurora",
  },
  {
    id: "evt-2",
    title: "客户对齐会",
    start: "14:00",
    end: "15:00",
    attendees: ["客户成功", "销售", "交付经理"],
    location: "Tencent Meeting",
  },
  {
    id: "evt-3",
    title: "Agent 设计评审",
    start: "16:30",
    end: "17:15",
    attendees: ["架构师", "前端开发", "后端开发"],
    location: "6F Maple",
  },
];

export const mockTasks: PendingTask[] = [
  {
    id: "task-1",
    title: "完成新版本排期评审材料",
    dueText: "今天 18:00 前",
    priority: "P0",
    owner: "你",
  },
  {
    id: "task-2",
    title: "同步供应商接入 checklist",
    dueText: "明天上午",
    priority: "P1",
    owner: "你",
  },
  {
    id: "task-3",
    title: "整理 1:1 follow-up",
    dueText: "本周内",
    priority: "P2",
    owner: "你",
  },
];

export const faqPairs = new Map<string, string>([
  ["公司请假流程是什么", "请在 OA 中进入人事服务，提交请假申请并等待直属主管审批。"],
  ["今天有哪些会议", "今天共有 3 个已确认会议，首个会议 09:30 开始。"],
]);
