import {
  ComplexityAssessment,
  CostAssessment,
  NormalizedRequest,
  RiskAssessment,
  ToolEffectType,
  ToolMatchResult,
  SkillMatchResult,
  RouterContext,
} from "./types";
import { clamp01, toComplexityLevel, toRiskLevel } from "./utils";

export function assessComplexity(
  normalized: NormalizedRequest,
  toolMatch: ToolMatchResult,
  skillMatch: SkillMatchResult,
): ComplexityAssessment {
  let score = 0;
  const reasonCodes: string[] = [];

  if (normalized.flags.hasMultiIntent) {
    score += 0.25;
    reasonCodes.push("MULTI_INTENT");
  }

  if (normalized.flags.hasQuestionForm && normalized.intents.includes("analysis")) {
    score += 0.2;
    reasonCodes.push("ANALYSIS_REQUEST");
  }

  if (normalized.raw.history && normalized.raw.history.length > 8) {
    score += 0.1;
    reasonCodes.push("LONG_CONTEXT_DEPENDENCY");
  }

  if (toolMatch.missingParams.length > 0 || skillMatch.missingEntities.length > 0) {
    score += 0.15;
    reasonCodes.push("MISSING_REQUIRED_INPUT");
  }

  if (
    normalized.intents.includes("generation") ||
    normalized.intents.includes("analysis")
  ) {
    score += 0.15;
    reasonCodes.push("OPEN_ENDED_OUTPUT");
  }

  if (toolMatch.score < 0.5 && skillMatch.score < 0.5) {
    score += 0.2;
    reasonCodes.push("LOW_CAPABILITY_MATCH");
  }

  score = clamp01(score);

  return {
    score,
    level: toComplexityLevel(score),
    reasonCodes,
  };
}

export function assessRisk(
  normalized: NormalizedRequest,
  toolMatch: ToolMatchResult,
  context?: RouterContext,
): RiskAssessment {
  let score = 0;
  const reasonCodes: string[] = [];
  const effectType: ToolEffectType =
    toolMatch.matchedTool?.executionPolicy.effectType ?? "read_only";

  if (normalized.flags.hasSideEffectVerb) {
    score += 0.15;
    reasonCodes.push("SIDE_EFFECT_VERB");
  }

  if (effectType === "read_only") {
    score += 0.02;
    reasonCodes.push("READ_ONLY_EFFECT");
  }

  if (effectType === "reversible") {
    score += 0.18;
    reasonCodes.push("REVERSIBLE_EFFECT");
  }

  if (effectType === "irreversible_write") {
    score += 0.42;
    reasonCodes.push("IRREVERSIBLE_WRITE_EFFECT");
  }

  if (effectType === "bulk_write") {
    score += 0.55;
    reasonCodes.push("BULK_WRITE_EFFECT");
  }

  if (effectType === "external_side_effect") {
    score += 0.5;
    reasonCodes.push("EXTERNAL_SIDE_EFFECT");
  }

  if (normalized.flags.hasExplicitAction && toolMatch.missingParams.length > 0) {
    score += 0.15;
    reasonCodes.push("ACTION_WITH_MISSING_PARAMS");
  }

  if (
    normalized.flags.hasNumericParams &&
    normalized.entities.numericParams.some((entity) => entity.value >= 10)
  ) {
    score += 0.1;
    reasonCodes.push("LARGE_NUMERIC_SCOPE");
  }

  if (context?.environment === "prod" && effectType !== "read_only") {
    score += 0.08;
    reasonCodes.push("PROD_MUTATION_GUARD");
  }

  score = clamp01(score);
  const level = toRiskLevel(score);
  const requiresBlock =
    effectType === "bulk_write" ||
    (effectType === "irreversible_write" && context?.environment === "prod");
  const requiresHumanConfirm =
    effectType === "external_side_effect" ||
    effectType === "irreversible_write" ||
    effectType === "reversible" ||
    toolMatch.matchedTool?.executionPolicy.requiresConfirmation === true ||
    (level !== "low" && effectType !== "read_only");

  return {
    score,
    level,
    requiresBlock,
    requiresHumanConfirm,
    effectType,
    policyDecision: requiresBlock
      ? "block"
      : requiresHumanConfirm
        ? "confirm"
        : "allow",
    reasonCodes,
  };
}

export function assessCost(
  normalized: NormalizedRequest,
  complexity: ComplexityAssessment,
  toolMatch: ToolMatchResult,
): CostAssessment {
  let estimatedLatencyMs = 120;
  let llmCostWeight = 0.1;
  const reasonCodes: string[] = [];

  if (toolMatch.matchedTool?.latencyClass === "fast") {
    estimatedLatencyMs += 80;
    reasonCodes.push("FAST_TOOL");
  }

  if (toolMatch.matchedTool?.latencyClass === "normal") {
    estimatedLatencyMs += 250;
    reasonCodes.push("NORMAL_TOOL");
  }

  if (toolMatch.matchedTool?.latencyClass === "slow") {
    estimatedLatencyMs += 900;
    reasonCodes.push("SLOW_TOOL");
  }

  if (complexity.level === "medium") {
    estimatedLatencyMs += 700;
    llmCostWeight += 0.25;
    reasonCodes.push("MEDIUM_COMPLEXITY_COST");
  }

  if (complexity.level === "high") {
    estimatedLatencyMs += 1800;
    llmCostWeight += 0.55;
    reasonCodes.push("HIGH_COMPLEXITY_COST");
  }

  if (normalized.raw.history && normalized.raw.history.length > 8) {
    llmCostWeight += 0.1;
    reasonCodes.push("LONG_HISTORY_COST");
  }

  llmCostWeight = clamp01(llmCostWeight);

  return {
    estimatedLatencyMs,
    llmCostWeight,
    reasonCodes,
  };
}
