import {
  ComplexityAssessment,
  CostAssessment,
  DirectRuleMatch,
  RouteScores,
  RiskAssessment,
  ToolMatchResult,
  NormalizedRequest,
} from "./types";
import { clamp01 } from "./utils";

export function buildScores(params: {
  normalized: NormalizedRequest;
  directRule: DirectRuleMatch;
  toolMatch: ToolMatchResult;
  complexity: ComplexityAssessment;
  risk: RiskAssessment;
  cost: CostAssessment;
}): RouteScores {
  const {
    normalized,
    directRule,
    toolMatch,
    complexity,
    risk,
    cost,
  } = params;

  const direct = clamp01(
    (directRule.hit ? 0.75 : 0) +
      (normalized.flags.hasQuestionForm ? 0.05 : 0) -
      complexity.score * 0.35 -
      risk.score * 0.2,
  );

  const tool = clamp01(
    toolMatch.score * 0.6 +
      (normalized.flags.hasExplicitAction ? 0.15 : 0) +
      (toolMatch.missingParams.length === 0 ? 0.15 : 0) -
      complexity.score * 0.2 -
      risk.score * 0.15,
  );

  const llm = clamp01(
    complexity.score * 0.45 +
      risk.score * 0.15 +
      cost.llmCostWeight * 0.2 +
      (normalized.flags.hasMultiIntent ? 0.1 : 0) +
      (normalized.intents.includes("analysis") ? 0.1 : 0),
  );

  return { direct, tool, llm };
}
