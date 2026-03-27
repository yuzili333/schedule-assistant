import { CachedCalendarSubmission, ModelSettings } from "../types";

interface ModelRegistryItem {
  provider: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
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

function parseModelRegistry(): Record<string, ModelRegistryItem> {
  const raw = import.meta.env.PUBLIC_MODEL_REGISTRY_JSON?.trim();
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
  const activeKey = import.meta.env.PUBLIC_MODEL_ACTIVE?.trim() || "GPT";
  const activeItem = registry[activeKey] ?? registry.GPT ?? Object.values(registry)[0];

  return {
    provider: activeItem.provider,
    label: activeItem.label,
    baseUrl: activeItem.baseUrl,
    apiKey: activeItem.apiKey,
    model: activeItem.model,
  };
}

export const defaultModelSettings: ModelSettings = {
  ...resolveProviderConfig(),
  enabled: import.meta.env.PUBLIC_MODEL_ENABLED === "true",
  systemPrompt:
    import.meta.env.PUBLIC_MODEL_SYSTEM_PROMPT?.trim() ||
    "你是企业日程 AI 助手。优先输出结构化、可执行、低风险的安排建议。",
};

export function loadModelSettings(): ModelSettings {
  return defaultModelSettings;
}

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readCalendarSubmissionCache(): CachedCalendarSubmission[] {
  if (!canUseLocalStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(CALENDAR_SUBMISSION_CACHE_KEY);
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
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(
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
