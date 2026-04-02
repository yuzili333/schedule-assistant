function hash(input: string): number {
  let value = 0;
  for (let index = 0; index < input.length; index += 1) {
    value = (value * 31 + input.charCodeAt(index)) % 1000;
  }
  return value;
}

export function resolveGrayVariant(key: string, ratio: number): "stable" | "gray" {
  if (ratio >= 1) {
    return "gray";
  }

  const normalized = Math.max(0, Math.min(ratio, 1));
  return hash(key) / 1000 < normalized ? "gray" : "stable";
}
