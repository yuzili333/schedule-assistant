import {
  DateRangeEntity,
  ExtractedEntities,
  NumericEntity,
  NormalizedRequest,
  UserRequest,
} from "./types";
import { includesAny, tokenize, uniq } from "./utils";

const ACTION_VERBS = [
  "查",
  "查询",
  "获取",
  "创建",
  "新建",
  "删除",
  "更新",
  "发送",
  "发",
  "生成",
  "总结",
  "分析",
  "安排",
  "预定",
  "schedule",
  "create",
  "delete",
  "update",
  "send",
  "generate",
  "analyze",
  "query",
  "get",
];

const SIDE_EFFECT_VERBS = [
  "创建",
  "新建",
  "删除",
  "更新",
  "发送",
  "审批",
  "提交",
  "publish",
  "create",
  "delete",
  "update",
  "send",
  "approve",
  "submit",
];

const QUESTION_HINTS = ["吗", "什么", "为何", "为什么", "how", "what", "why", "?"];

const TIME_HINTS = [
  "今天",
  "明天",
  "后天",
  "本周",
  "下周",
  "下午",
  "上午",
  "tomorrow",
  "today",
  "next week",
  "pm",
  "am",
];

const PRIORITY_KEYWORDS = [
  "p0",
  "p1",
  "p2",
  "高优",
  "中优",
  "低优",
  "高优先级",
  "中优先级",
  "低优先级",
  "紧急",
];

const LOCATION_PREPOSITIONS = ["在", "到", "去", "于"];

function extractResourceId(text: string): string | undefined {
  const patterns = [
    /\bINC-\d+\b/i,
    /\bORD-\d+\b/i,
    /\bTICKET-\d+\b/i,
    /\b[A-Z]{2,10}-\d{2,}\b/,
    /\b\d{5,}\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return undefined;
}

function extractEmail(text: string): string | undefined {
  const match = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  return match?.[0];
}

function extractEmails(text: string): string[] {
  return Array.from(
    new Set(text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi) ?? []),
  );
}

function extractTimeText(text: string): string | undefined {
  const timePatterns = [
    /(今天|明天|后天|本周|下周|下午|上午)[^\s，。,.]*/u,
    /\b(today|tomorrow|next week|this week|[0-9]{1,2}(:[0-9]{2})?\s?(am|pm)?)\b/i,
  ];

  for (const pattern of timePatterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return undefined;
}

function extractDateRange(text: string): DateRangeEntity | undefined {
  const dateToken =
    "(本周一|本周二|本周三|本周四|本周五|本周六|本周日|下周一|下周二|下周三|下周四|下周五|下周六|下周日|星期一|星期二|星期三|星期四|星期五|星期六|星期日|今天|明天|后天|本周|下周|周一|周二|周三|周四|周五|周六|周日)";
  const betweenMatch = text.match(
    new RegExp(`(?:从|自)?\\s*${dateToken}\\s*(到|至)\\s*${dateToken}`, "u"),
  );

  if (betweenMatch) {
    return {
      raw: betweenMatch[0],
      start: betweenMatch[1],
      end: betweenMatch[3],
    };
  }

  const englishRange = text.match(
    /\bfrom\s+(today|tomorrow|this week|next week)\s+to\s+(today|tomorrow|this week|next week)\b/i,
  );
  if (englishRange) {
    return {
      raw: englishRange[0],
      start: englishRange[1],
      end: englishRange[2],
    };
  }

  return undefined;
}

function extractPriority(text: string): ExtractedEntities["priority"] {
  const normalized = text.toLowerCase();
  if (normalized.includes("p0") || text.includes("紧急")) return normalized.includes("p0") ? "P0" : "紧急";
  if (normalized.includes("p1") || text.includes("高优")) return normalized.includes("p1") ? "P1" : "high";
  if (normalized.includes("p2") || text.includes("中优")) return normalized.includes("p2") ? "P2" : "medium";
  if (text.includes("低优")) return "low";
  return undefined;
}

function extractNumericParams(text: string): NumericEntity[] {
  const matches = Array.from(
    text.matchAll(/(\d+(?:\.\d+)?)\s*(分钟|小时|天|人|个|间|次|hour|hours|minute|minutes|day|days)?/gi),
  );

  return matches
    .map((match) => ({
      raw: match[0],
      value: Number(match[1]),
      unit: match[2],
    }))
    .filter((entity) => !Number.isNaN(entity.value));
}

function extractPeople(text: string): string[] {
  const roleMatches = text.match(
    /(产品经理|设计师|前端负责人|前端开发|后端开发|客户成功|销售|交付经理|架构师|测试负责人)/g,
  ) ?? [];
  const chineseNameMatches =
    text.match(/(?:叫|联系|通知|邀请|给|和)([一-龥]{2,4})(?=开会|同步|发邮件|安排|参加|沟通|确认|，|。|\s|$)/g) ?? [];
  const cleanedNames = chineseNameMatches.map((value) =>
    value
      .replace(/^(叫|联系|通知|邀请|给|和)/, "")
      .replace(/(开|会|同步|安排|参加|沟通|确认)+$/, ""),
  );
  return Array.from(new Set([...roleMatches, ...cleanedNames].filter(Boolean)));
}

function extractMeetingRoom(text: string): string | undefined {
  const match = text.match(
    /\b([1-9]\d?\s*[Ff]\s*[A-Za-z][A-Za-z0-9-]*|[A-Z][A-Za-z0-9-]*\s*会议室|[一-龥A-Za-z0-9-]+会议室)\b/u,
  );
  return match?.[0]?.trim();
}

function extractLocation(text: string): string | undefined {
  const room = extractMeetingRoom(text);
  if (room) {
    return room;
  }

  for (const preposition of LOCATION_PREPOSITIONS) {
    const match = text.match(
      new RegExp(`${preposition}([\\u4e00-\\u9fa5A-Za-z0-9-]{2,20})(开会|同步|见面|碰头|会面|汇报|讨论)?`),
    );
    if (match?.[1]) {
      return match[1];
    }
  }

  const onlineMatch = text.match(/\b(Tencent Meeting|Zoom|Google Meet|会议室[A-Za-z0-9-]*)\b/i);
  return onlineMatch?.[0];
}

function detectIntents(text: string): string[] {
  const intents: string[] = [];

  if (includesAny(text, ["为什么", "分析", "原因", "why", "analyze"])) {
    intents.push("analysis");
  }
  if (includesAny(text, ["生成", "总结", "写", "generate", "summarize", "write"])) {
    intents.push("generation");
  }
  if (includesAny(text, ["查询", "查", "获取", "query", "get", "status"])) {
    intents.push("query");
  }
  if (
    includesAny(text, [
      "创建",
      "发送",
      "删除",
      "更新",
      "安排",
      "预定",
      "schedule",
      "create",
      "send",
      "delete",
      "update",
    ])
  ) {
    intents.push("action");
  }
  if (includesAny(text, ["周报", "会议纪要", "action items", "待办", "workflow"])) {
    intents.push("workflow");
  }
  if (intents.length === 0) intents.push("unknown");

  return uniq(intents);
}

export function normalizeRequest(req: UserRequest): NormalizedRequest {
  const normalizedText = req.text.trim().toLowerCase();
  const tokens = tokenize(normalizedText);

  const resourceId = extractResourceId(req.text);
  const emails = extractEmails(req.text);
  const email = extractEmail(req.text);
  const timeText = extractTimeText(req.text);
  const dateRange = extractDateRange(req.text);
  const priority = extractPriority(req.text);
  const location = extractLocation(req.text);
  const meetingRoom = extractMeetingRoom(req.text);
  const personNames = extractPeople(req.text);
  const numericParams = extractNumericParams(req.text);
  const intents = detectIntents(normalizedText);

  const hasExplicitAction = includesAny(normalizedText, ACTION_VERBS);
  const hasSideEffectVerb = includesAny(normalizedText, SIDE_EFFECT_VERBS);
  const hasQuestionForm = includesAny(normalizedText, QUESTION_HINTS);
  const hasMultiIntent = intents.length > 1;
  const hasTimeExpression = includesAny(normalizedText, TIME_HINTS) || !!timeText;
  const hasEmail = !!email;
  const hasDateRange = !!dateRange;
  const hasPriority = includesAny(normalizedText, PRIORITY_KEYWORDS) || !!priority;
  const hasLocation = !!location;
  const hasMeetingRoom = !!meetingRoom;
  const hasPeople = personNames.length > 0;
  const hasNumericParams = numericParams.length > 0;

  return {
    raw: req,
    normalizedText,
    tokens,
    intents,
    entities: {
      resourceId,
      email,
      emails,
      timeText,
      personNames,
      numericParams,
      dateRange,
      priority,
      location,
      meetingRoom,
    },
    flags: {
      hasResourceId: !!resourceId,
      hasExplicitAction,
      hasSideEffectVerb,
      hasQuestionForm,
      hasMultiIntent,
      hasTimeExpression,
      hasEmail,
      hasDateRange,
      hasPriority,
      hasLocation,
      hasMeetingRoom,
      hasPeople,
      hasNumericParams,
    },
  };
}
