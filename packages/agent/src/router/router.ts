import {
  RouteDecision,
  RouteDependencies,
  RouterContext,
  RouterOptions,
  RouteType,
} from "./types";
import { normalizeRequest } from "./normalizer";
import { runDirectRules } from "./rule-engine";
import { matchSkill, matchTool } from "./matchers";
import { assessComplexity, assessCost, assessRisk } from "./evaluators";
import { buildScores } from "./scorer";
import { isScoreTooClose } from "./utils";

const DEFAULT_OPTIONS: RouterOptions = {
  directThreshold: 0.8,
  skillThreshold: 0.68,
  toolThreshold: 0.72,
  llmThreshold: 0.5,
  scoreCloseDelta: 0.08,
  blockHighRiskIrreversible: true,
};

export class RequestRouter {
  private readonly deps: RouteDependencies;
  private readonly options: RouterOptions;

  constructor(deps: RouteDependencies) {
    this.deps = deps;
    this.options = {
      ...DEFAULT_OPTIONS,
      ...deps.options,
    };
  }

  route(req: Parameters<typeof normalizeRequest>[0], context?: RouterContext): RouteDecision {
    const normalized = normalizeRequest(req);
    const directRule = runDirectRules(normalized, context);

    const skillMatch = matchSkill(normalized, this.deps.skillRegistry);
    const toolMatch = matchTool(normalized, this.deps.toolRegistry);

    const complexity = assessComplexity(normalized, toolMatch, skillMatch);
    const risk = assessRisk(normalized, toolMatch, context);
    const cost = assessCost(normalized, complexity, toolMatch);

    if (this.options.blockHighRiskIrreversible && risk.requiresBlock) {
      return {
        route: "block",
        target: toolMatch.matchedTool?.toolName,
        confidence: 0.98,
        scores: {
          direct: 0,
          skill: 0,
          tool: 0,
          llm: 0.2,
        },
        reasonCodes: [...risk.reasonCodes, "HIGH_RISK_BLOCK"],
        extractedParams: normalized.entities,
        missingParams: toolMatch.missingParams,
        complexity,
        risk,
        cost,
        requiresLLM: false,
        metadata: {
          normalizedText: normalized.normalizedText,
        },
      };
    }

    const scores = buildScores({
      normalized,
      directRule,
      skillMatch,
      toolMatch,
      complexity,
      risk,
      cost,
    });

    const ranked = (Object.entries(scores) as Array<[Exclude<RouteType, "block">, number]>)
      .sort((a, b) => b[1] - a[1]);

    let route: RouteType = ranked[0][0];
    let confidence = ranked[0][1];
    let target: string | undefined;
    let missingParams: string[] = [];

    // 低置信度或分数过近 -> 走 llm
    if (
      confidence < this.options.llmThreshold ||
      isScoreTooClose(scores, this.options.scoreCloseDelta)
    ) {
      route = "llm";
      confidence = Math.max(scores.llm, 0.6);
    }

    // direct 命中但 target 是 tool 映射时，转成 tool 更统一
    if (route === "direct" && directRule.hit && directRule.target?.startsWith("tool:")) {
      route = "tool";
      target = String(directRule.payload?.toolName ?? directRule.target.replace("tool:", ""));
      confidence = Math.max(confidence, directRule.confidence);
    }

    if (route === "skill") {
      target = skillMatch.matchedSkill?.skillId;
      missingParams = skillMatch.missingEntities;
      if (!target || confidence < this.options.skillThreshold) {
        route = "llm";
        confidence = Math.max(scores.llm, 0.62);
      }
    }

    if (route === "tool") {
      target = target ?? toolMatch.matchedTool?.toolName;
      missingParams = toolMatch.missingParams;
      if (!target || confidence < this.options.toolThreshold) {
        route = "llm";
        confidence = Math.max(scores.llm, 0.64);
      }
    }

    if (route === "direct") {
      target = directRule.target;
      missingParams = [];
      if (!directRule.hit || confidence < this.options.directThreshold) {
        route = "llm";
        confidence = Math.max(scores.llm, 0.58);
      }
    }

    if (route === "llm") {
      target = "general_reasoning";
      missingParams = [];
    }

    const reasonCodes = [
      ...(directRule.hit ? directRule.reasonCodes : []),
      ...skillMatch.reasonCodes,
      ...toolMatch.reasonCodes,
      ...complexity.reasonCodes,
      ...risk.reasonCodes,
      ...cost.reasonCodes,
      `FINAL_ROUTE_${route.toUpperCase()}`,
    ];

    return {
      route,
      target,
      confidence: Number(confidence.toFixed(3)),
      scores,
      reasonCodes: Array.from(new Set(reasonCodes)),
      extractedParams: normalized.entities,
      missingParams,
      complexity,
      risk,
      cost,
      requiresLLM: route === "llm",
      metadata: {
        normalizedText: normalized.normalizedText,
        intents: normalized.intents,
      },
    };
  }
}
