import { DirectRuleMatch, NormalizedRequest, RouterContext } from "./types";

export function runDirectRules(
  normalized: NormalizedRequest,
  context?: RouterContext,
): DirectRuleMatch {
  const text = normalized.normalizedText;

  // 1. FAQ / 固定回答缓存
  if (context?.faqCache?.has(text)) {
    return {
      hit: true,
      target: "faq_cache",
      confidence: 0.99,
      reasonCodes: ["FAQ_CACHE_HIT"],
      payload: {
        answer: context.faqCache.get(text),
      },
    };
  }

  // 2. 查询固定资源 ID -> 直接 tool route 候选
  if (
    normalized.flags.hasResourceId &&
    (text.includes("查") ||
      text.includes("查询") ||
      text.includes("status") ||
      text.includes("工单") ||
      text.includes("ticket"))
  ) {
    return {
      hit: true,
      target: "tool:get_ticket",
      confidence: 0.97,
      reasonCodes: ["RESOURCE_ID_QUERY_RULE", "LOW_COMPLEXITY"],
      payload: {
        toolName: "get_ticket",
      },
    };
  }

  // 3. 简单天气/时间类也可短路到特定 tool
  if (text.includes("天气")) {
    return {
      hit: true,
      target: "tool:get_weather",
      confidence: 0.95,
      reasonCodes: ["WEATHER_RULE_HIT"],
      payload: {
        toolName: "get_weather",
      },
    };
  }

  return {
    hit: false,
    confidence: 0,
    reasonCodes: [],
  };
}
