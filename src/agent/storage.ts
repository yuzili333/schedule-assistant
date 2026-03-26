import { ModelSettings } from "../types/chat";

interface ModelRegistryItem {
  provider: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

const FALLBACK_MODEL_REGISTRY: Record<string, ModelRegistryItem> = {
  GPT: {
    provider: "GPT",
    label: "GPT",
    baseUrl: "",
    apiKey: "",
    model: "gpt-4o-mini",
  },
  QWEN: {
    provider: "QWEN",
    label: "Qwen/Qwen3-32B",
    baseUrl: "",
    apiKey: "",
    model: "Qwen/Qwen3-32B",
  },
};

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
