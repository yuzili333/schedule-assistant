import { DirectRuleMatch, NormalizedRequest, RouterContext } from "./types";

export function runDirectRules(
  normalized: NormalizedRequest,
  _context?: RouterContext,
): DirectRuleMatch {
  const text = normalized.normalizedText;

  if (
    text.includes("今天有哪些会议") ||
    text.includes("查询日程") ||
    text.includes("查看日程")
  ) {
    return {
      hit: true,
      target: "tool:get_calendar_events",
      confidence: 0.95,
      reasonCodes: ["CALENDAR_QUERY_RULE_HIT"],
      payload: {
        toolName: "get_calendar_events",
      },
    };
  }

  return {
    hit: false,
    confidence: 0,
    reasonCodes: [],
  };
}
