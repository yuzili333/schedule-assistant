import fs from "node:fs";
import path from "node:path";

import { CachedCalendarSubmission, ModelSettings } from "../types";

interface ModelRegistryItem {
  provider: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const FALLBACK_MODEL_REGISTRY: Record<string, ModelRegistryItem> = {
  QWEN: {
    provider: "QWEN",
    label: "Qwen/Qwen3-32B",
    baseUrl: "",
    apiKey: "",
    model: "Qwen/Qwen3-32B",
  },
};

const CALENDAR_SUBMISSION_CACHE_KEY = "schedule_assistant_calendar_submission_cache_v1";
const CALENDAR_SUBMISSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const memoryStorage = new Map<string, string>();
let envFileCache:
  | {
    filePath: string;
    mtimeMs: number;
    values: Record<string, string>;
  }
  | undefined;

function readProcessEnv(): Record<string, string | undefined> | undefined {
  return (
    globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env;
}

function resolveEnvFilePath(): string | undefined {
  const processEnv = readProcessEnv();
  const explicitPath = processEnv?.AGENT_SERVICE_ENV_FILE?.trim();
  const candidates = [
    explicitPath,
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), "services/agent-service/.env.local")
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function normalizeEnvValue(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function loadEnvFileValues(): Record<string, string> {
  const filePath = resolveEnvFilePath();
  if (!filePath) {
    envFileCache = undefined;
    return {};
  }

  try {
    const stats = fs.statSync(filePath);
    if (
      envFileCache &&
      envFileCache.filePath === filePath &&
      envFileCache.mtimeMs === stats.mtimeMs
    ) {
      return envFileCache.values;
    }

    const rawContent = fs.readFileSync(filePath, "utf8");
    const values: Record<string, string> = {};

    for (const line of rawContent.split(/\r?\n/u)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = normalizeEnvValue(trimmed.slice(separatorIndex + 1));
      if (key) {
        values[key] = value;
      }
    }

    envFileCache = {
      filePath,
      mtimeMs: stats.mtimeMs,
      values,
    };

    return values;
  } catch {
    envFileCache = undefined;
    return {};
  }
}

function readEnvValue(key: string): string | undefined {
  const processEnv = readProcessEnv();
  const processValue = processEnv?.[key];
  if (typeof processValue === "string" && processValue.trim().length > 0) {
    return processValue;
  }

  return loadEnvFileValues()[key];
}

function parseModelRegistry(): Record<string, ModelRegistryItem> {
  const raw = readEnvValue("PUBLIC_MODEL_REGISTRY_JSON")?.trim();
  if (!raw) {
    return FALLBACK_MODEL_REGISTRY;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<ModelRegistryItem>>;
    const entries = Object.entries(parsed).map(([key, value]) => [
      key,
      {
        provider: value.provider?.trim() || key,
        label: value.label?.trim() || key,
        baseUrl: value.baseUrl?.trim() || "",
        apiKey: value.apiKey?.trim() || "",
        model: value.model?.trim() || key,
      },
    ]);

    return entries.length > 0
      ? Object.fromEntries(entries)
      : FALLBACK_MODEL_REGISTRY;
  } catch {
    return FALLBACK_MODEL_REGISTRY;
  }
}

function resolveProviderConfig(): Pick<
  ModelSettings,
  "provider" | "label" | "baseUrl" | "apiKey" | "model"
> {
  const registry = parseModelRegistry();
  const activeKey = readEnvValue("PUBLIC_MODEL_ACTIVE")?.trim() || "GPT";
  const activeItem = registry[activeKey] ?? registry.GPT ?? Object.values(registry)[0];

  return {
    provider: activeItem.provider,
    label: activeItem.label,
    baseUrl: activeItem.baseUrl,
    apiKey: activeItem.apiKey,
    model: activeItem.model,
  };
}

export function loadModelSettings(): ModelSettings {
  return {
    ...resolveProviderConfig(),
    enabled: readEnvValue("PUBLIC_MODEL_ENABLED") === "true",
    systemPrompt:
      readEnvValue("PUBLIC_MODEL_SYSTEM_PROMPT")?.trim() ||
      "你是企业日程 AI 助手。优先输出结构化、可执行、低风险的安排建议。",
  };
}

function canUseLocalStorage(): boolean {
  const browserWindow = (
    globalThis as typeof globalThis & {
      window?: { localStorage?: StorageLike };
    }
  ).window;
  return typeof browserWindow !== "undefined" && typeof browserWindow.localStorage !== "undefined";
}

function resolveStorage(): StorageLike {
  const browserWindow = (
    globalThis as typeof globalThis & {
      window?: { localStorage?: StorageLike };
    }
  ).window;
  if (canUseLocalStorage()) {
    return browserWindow!.localStorage!;
  }

  return {
    getItem(key: string) {
      return memoryStorage.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      memoryStorage.set(key, value);
    },
  };
}

function readCalendarSubmissionCache(): CachedCalendarSubmission[] {
  try {
    const raw = resolveStorage().getItem(CALENDAR_SUBMISSION_CACHE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as CachedCalendarSubmission[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCalendarSubmissionCache(entries: CachedCalendarSubmission[]): void {
  resolveStorage().setItem(
    CALENDAR_SUBMISSION_CACHE_KEY,
    JSON.stringify(entries),
  );
}

export function loadValidCalendarSubmissionCache(
  now = Date.now(),
): CachedCalendarSubmission[] {
  const validEntries = readCalendarSubmissionCache()
    .filter((entry) => new Date(entry.expiresAt).getTime() > now)
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());

  writeCalendarSubmissionCache(validEntries);
  return validEntries;
}

export function getLatestValidCalendarSubmission(
  now = Date.now(),
): CachedCalendarSubmission | undefined {
  return loadValidCalendarSubmissionCache(now)[0];
}

export function cacheCalendarSubmission(params: {
  attendeeNames?: string[];
  attendeeIds?: string[];
  ccNames?: string[];
  ccIds?: string[];
  now?: number;
}): CachedCalendarSubmission | undefined {
  const attendeeNames = params.attendeeNames?.filter(Boolean) ?? [];
  const attendeeIds = params.attendeeIds?.filter(Boolean) ?? [];
  const ccNames = params.ccNames?.filter(Boolean) ?? [];
  const ccIds = params.ccIds?.filter(Boolean) ?? [];

  if (
    attendeeNames.length === 0 &&
    attendeeIds.length === 0 &&
    ccNames.length === 0 &&
    ccIds.length === 0
  ) {
    return undefined;
  }

  const now = params.now ?? Date.now();
  const entry: CachedCalendarSubmission = {
    id: `calendar-cache-${now}`,
    savedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + CALENDAR_SUBMISSION_TTL_MS).toISOString(),
    attendeeNames,
    attendeeIds,
    ccNames,
    ccIds,
  };

  const nextEntries = [entry, ...loadValidCalendarSubmissionCache(now)].slice(0, 20);
  writeCalendarSubmissionCache(nextEntries);
  return entry;
}
