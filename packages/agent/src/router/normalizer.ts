import {
  DateRangeEntity,
  ExtractedEntities,
  NumericEntity,
  NormalizedRequest,
  UserRequest,
} from "./types";
import { includesAny, tokenize, uniq } from "./utils";

const ACTION_VERBS = ["创建", "新建", "新增", "安排", "create"];
const SIDE_EFFECT_VERBS = ["创建", "新建", "新增", "create"];
const QUESTION_HINTS = ["吗", "哪些", "查询", "查看", "?", "what"];
const TIME_HINTS = ["今天", "明天", "后天", "本周", "下周", "上午", "下午"];
const PRIORITY_KEYWORDS = ["p0", "p1", "p2", "紧急"];

function extractResourceId(text: string): string | undefined {
  const match = text.match(/\b[A-Z]{2,10}-\d{2,}\b/);
  return match?.[0];
}

function extractEmails(text: string): string[] {
  return Array.from(
    new Set(text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi) ?? []),
  );
}

function extractEmail(text: string): string | undefined {
  return extractEmails(text)[0];
}

function extractFieldValue(text: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const match = text.match(new RegExp(`${label}[：:]\\s*([^\\n]+)`));
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return undefined;
}

function extractTimeText(text: string): string | undefined {
  const match = text.match(/(今天|明天|后天|本周|下周)[^\s，。,.]*/u);
  return match?.[0];
}

function extractDateRange(text: string): DateRangeEntity | undefined {
  const dateToken =
    "(本周一|本周二|本周三|本周四|本周五|本周六|本周日|下周一|下周二|下周三|下周四|下周五|下周六|下周日|星期一|星期二|星期三|星期四|星期五|星期六|星期日|今天|明天|后天|本周|下周|周一|周二|周三|周四|周五|周六|周日)";
  const betweenMatch = text.match(
    new RegExp(`(?:从|自)?\\s*${dateToken}\\s*(到|至)\\s*${dateToken}`, "u"),
  );

  if (!betweenMatch) {
    return undefined;
  }

  return {
    raw: betweenMatch[0],
    start: betweenMatch[1],
    end: betweenMatch[3],
  };
}

function extractPriority(text: string): ExtractedEntities["priority"] {
  const normalized = text.toLowerCase();
  if (normalized.includes("p0") || text.includes("紧急")) return normalized.includes("p0") ? "P0" : "紧急";
  if (normalized.includes("p1")) return "P1";
  if (normalized.includes("p2")) return "P2";
  return undefined;
}

function extractNumericParams(text: string): NumericEntity[] {
  const matches = Array.from(
    text.matchAll(/(\d+(?:\.\d+)?)\s*(分钟|小时|天|人|个|次)?/gi),
  );

  return matches
    .map((match) => ({
      raw: match[0],
      value: Number(match[1]),
      unit: match[2],
    }))
    .filter((item) => !Number.isNaN(item.value));
}

function splitNames(raw?: string): string[] {
  return (raw?.split(/[、,，;；]/) ?? [])
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractPersonNames(text: string): string[] {
  const labeled = extractFieldValue(text, ["参会人", "邀请人"]);
  if (labeled) {
    return splitNames(labeled);
  }

  const matches =
    text.match(/(?:邀请|和)([一-龥]{2,4})(?=开会|参加|参会|，|。|\s|$)/g) ?? [];

  return Array.from(
    new Set(
      matches
        .map((item) => item.replace(/^(邀请|和)/, "").trim())
        .filter(Boolean),
    ),
  );
}

function extractCcNames(text: string): string[] {
  return splitNames(extractFieldValue(text, ["抄送人", "抄送", "CC", "cc"]));
}

function extractMeetingRoom(text: string): string | undefined {
  const fieldValue = extractFieldValue(text, ["会议室"]);
  if (fieldValue) {
    return fieldValue;
  }

  const match = text.match(/\b([1-9]\d?\s*[Ff]\s*[A-Za-z][A-Za-z0-9-]*)\b/u);
  return match?.[0]?.trim();
}

function detectIntents(text: string): string[] {
  const intents: string[] = [];

  if (includesAny(text, ["查询", "查", "获取", "查看", "query", "get"])) {
    intents.push("query");
  }

  if (includesAny(text, ["创建", "新建", "新增", "安排", "create"])) {
    intents.push("action");
  }

  if (includesAny(text, ["新增日程", "推荐", "待办"])) {
    intents.push("workflow");
  }

  if (intents.length === 0) {
    intents.push("unknown");
  }

  return uniq(intents);
}

export function normalizeRequest(req: UserRequest): NormalizedRequest {
  const normalizedText = req.text.trim().toLowerCase();
  const tokens = tokenize(normalizedText);

  const emails = extractEmails(req.text);
  const email = extractEmail(req.text);
  const resourceId = extractResourceId(req.text);
  const timeText = extractTimeText(req.text);
  const dateRange = extractDateRange(req.text);
  const priority = extractPriority(req.text);
  const meetingRoom = extractMeetingRoom(req.text);
  const personNames = extractPersonNames(req.text);
  const ccPersonNames = extractCcNames(req.text);
  const selectedPersonIds = (
    extractFieldValue(req.text, ["参会人ID"])?.split(/[、,，;；\s]+/) ?? []
  ).filter(Boolean);
  const selectedPersonNames = (
    extractFieldValue(req.text, ["已选参会人"])?.split(/[、,，;；]/) ?? []
  )
    .map((item) => item.trim())
    .filter(Boolean);
  const selectedCcIds = (
    extractFieldValue(req.text, ["抄送人ID", "CC ID"])?.split(/[、,，;；\s]+/) ?? []
  ).filter(Boolean);
  const selectedCcNames = splitNames(extractFieldValue(req.text, ["已选抄送人", "已选CC"]));
  const eventTitle =
    extractFieldValue(req.text, ["主题", "标题"]) ??
    req.text.match(/创建(?:一个)?(?:日程|会议)([^，。]*)/)?.[1]?.trim();
  const startDate = extractFieldValue(req.text, ["开始日期", "开始时间", "开始"]);
  const endDate = extractFieldValue(req.text, ["结束日期", "结束时间", "结束"]);
  const allDayRaw = extractFieldValue(req.text, ["是否全天"]);
  const videoMeetingCode = extractFieldValue(req.text, ["视频会议号", "会议号"]);
  const description = extractFieldValue(req.text, ["描述", "说明"]);
  const attachments = (
    extractFieldValue(req.text, ["附件"])?.split(/[、,，;；]/) ?? []
  )
    .map((item) => item.trim())
    .filter(Boolean);
  const reminderChannels = (
    extractFieldValue(req.text, ["提醒渠道"])?.split(/[、,，;；]/) ?? []
  )
    .map((item) => item.trim())
    .filter(Boolean);
  const urgentRaw = extractFieldValue(req.text, ["紧急状态", "紧急"]);
  const numericParams = extractNumericParams(req.text);
  const intents = detectIntents(normalizedText);
  const allDay =
    allDayRaw === "是" || allDayRaw?.toLowerCase() === "true"
      ? true
      : allDayRaw === "否" || allDayRaw?.toLowerCase() === "false"
        ? false
        : undefined;
  const urgent = urgentRaw === "是" || urgentRaw === "紧急" || priority === "紧急";

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
      ccPersonNames,
      selectedPersonIds,
      selectedPersonNames,
      selectedCcIds,
      selectedCcNames,
      numericParams,
      dateRange,
      priority,
      meetingRoom,
      location: meetingRoom,
      eventTitle,
      startDate,
      endDate,
      allDay,
      videoMeetingCode,
      description,
      attachments,
      reminderChannels,
      urgent,
    },
    flags: {
      hasResourceId: !!resourceId,
      hasExplicitAction: includesAny(normalizedText, ACTION_VERBS),
      hasSideEffectVerb: includesAny(normalizedText, SIDE_EFFECT_VERBS),
      hasQuestionForm: includesAny(normalizedText, QUESTION_HINTS),
      hasMultiIntent: intents.length > 1,
      hasTimeExpression: includesAny(normalizedText, TIME_HINTS) || !!timeText,
      hasEmail: !!email,
      hasDateRange: !!dateRange,
      hasPriority: includesAny(normalizedText, PRIORITY_KEYWORDS) || !!priority,
      hasLocation: !!meetingRoom,
      hasMeetingRoom: !!meetingRoom,
      hasPeople:
        personNames.length > 0 ||
        ccPersonNames.length > 0 ||
        selectedPersonNames.length > 0 ||
        selectedCcNames.length > 0,
      hasNumericParams: numericParams.length > 0,
    },
  };
}
