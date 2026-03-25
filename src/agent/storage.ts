import { ModelSettings } from "../types/chat";

export const defaultModelSettings: ModelSettings = {
  baseUrl: import.meta.env.PUBLIC_MODEL_BASE_URL?.trim() ?? "",
  apiKey: import.meta.env.PUBLIC_MODEL_API_KEY?.trim() ?? "",
  model: import.meta.env.PUBLIC_MODEL_NAME?.trim() || "gpt-4o-mini",
  enabled: import.meta.env.PUBLIC_MODEL_ENABLED === "true",
  systemPrompt:
    import.meta.env.PUBLIC_MODEL_SYSTEM_PROMPT?.trim() ||
    "你是企业日程 AI 助手。优先输出结构化、可执行、低风险的安排建议。",
};

export function loadModelSettings(): ModelSettings {
  return defaultModelSettings;
}
