export function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function toComplexityLevel(score: number): "low" | "medium" | "high" {
  if (score < 0.34) return "low";
  if (score < 0.67) return "medium";
  return "high";
}

export function toRiskLevel(score: number): "low" | "medium" | "high" {
  if (score < 0.34) return "low";
  if (score < 0.67) return "medium";
  return "high";
}

export function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

export function includesAny(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

export function countMatches(text: string, words: string[]): number {
  return words.reduce((count, word) => count + (text.includes(word) ? 1 : 0), 0);
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}@._-]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function fuzzyAliasScore(text: string, aliases: string[]): number {
  let score = 0;
  for (const alias of aliases) {
    const normalizedAlias = alias.toLowerCase().trim();
    if (!normalizedAlias) continue;
    if (text.includes(normalizedAlias)) {
      score = Math.max(score, 1);
      continue;
    }
    const aliasTokens = normalizedAlias.split(/\s+/);
    const hitCount = aliasTokens.filter((t) => text.includes(t)).length;
    if (aliasTokens.length > 0) {
      score = Math.max(score, hitCount / aliasTokens.length);
    }
  }
  return clamp01(score);
}

export function isScoreTooClose<T extends object>(
  scores: { [K in keyof T]: number },
  delta: number,
): boolean {
  const sorted = Object.values(scores) as number[];
  sorted.sort((a, b) => b - a);
  if (sorted.length < 2) return false;
  return sorted[0] - sorted[1] < delta;
}
