import {
  EntityKey,
  NormalizedRequest,
  SkillDefinition,
  SkillMatchResult,
  ToolDefinition,
  ToolMatchResult,
  SkillRegistry,
  ToolRegistry,
} from "./types";
import { clamp01, fuzzyAliasScore } from "./utils";

function missingFields(
  requiredFields: EntityKey[],
  entities: NormalizedRequest["entities"],
): string[] {
  return requiredFields.filter((field) => {
    const value = entities[field];
    return value === undefined || value === null || value === "";
  });
}

function entityCompletenessScore(
  requiredFields: EntityKey[],
  entities: NormalizedRequest["entities"],
): number {
  if (requiredFields.length === 0) return 1;
  const missing = missingFields(requiredFields, entities);
  return clamp01((requiredFields.length - missing.length) / requiredFields.length);
}

function intentOverlapScore(requestIntents: string[], supportedIntents: string[]): number {
  if (supportedIntents.length === 0) return 0;
  const overlap = requestIntents.filter((intent) => supportedIntents.includes(intent)).length;
  return clamp01(overlap / supportedIntents.length);
}

export function matchSkill(
  normalized: NormalizedRequest,
  registry: SkillRegistry,
): SkillMatchResult {
  const skills = registry.list();
  let bestSkill: SkillDefinition | undefined;
  let bestScore = 0;
  let bestReasonCodes: string[] = [];

  for (const skill of skills) {
    const aliasScore = fuzzyAliasScore(normalized.normalizedText, [
      skill.name,
      ...skill.aliases,
      skill.description,
    ]);
    const intentScore = intentOverlapScore(normalized.intents, skill.supportedIntents);
    const score = clamp01(0.65 * aliasScore + 0.35 * intentScore);

    if (score > bestScore) {
      bestScore = score;
      bestSkill = skill;
      bestReasonCodes = [
        aliasScore > 0.7 ? "SKILL_ALIAS_MATCH" : "SKILL_PARTIAL_ALIAS_MATCH",
        intentScore > 0 ? "SKILL_INTENT_MATCH" : "SKILL_INTENT_WEAK",
      ];
    }
  }

  return {
    score: bestScore,
    matchedSkill: bestSkill,
    reasonCodes: bestReasonCodes,
  };
}

function toolActionScore(text: string, tool: ToolDefinition): number {
  const aliases = [
    tool.actionType,
    tool.objectType,
    ...(tool.aliases ?? []),
    tool.description,
  ];
  return fuzzyAliasScore(text, aliases);
}

export function matchTool(
  normalized: NormalizedRequest,
  registry: ToolRegistry,
): ToolMatchResult {
  const tools = registry.list();
  let bestTool: ToolDefinition | undefined;
  let bestScore = 0;
  let bestReasonCodes: string[] = [];
  let bestMissingParams: string[] = [];

  for (const tool of tools) {
    const aliasScore = toolActionScore(normalized.normalizedText, tool);
    const completeness = entityCompletenessScore(
      tool.requiredParams as EntityKey[],
      normalized.entities,
    );
    const missing = missingFields(tool.requiredParams as EntityKey[], normalized.entities);

    const score = clamp01(0.65 * aliasScore + 0.35 * completeness);

    if (score > bestScore) {
      bestScore = score;
      bestTool = tool;
      bestMissingParams = missing;
      bestReasonCodes = [
        aliasScore > 0.7 ? "TOOL_ALIAS_MATCH" : "TOOL_PARTIAL_MATCH",
        completeness === 1 ? "TOOL_PARAMS_COMPLETE" : "TOOL_PARAMS_PARTIAL",
      ];
    }
  }

  return {
    score: bestScore,
    matchedTool: bestTool,
    reasonCodes: bestReasonCodes,
    missingParams: bestMissingParams,
  };
}
