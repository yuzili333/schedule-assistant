import { loadModelSettings } from "./core/index.js";

export interface AgentExecutionContext {
  requestId: string;
  userId?: string;
  sessionId?: string;
  grayVariant: "stable" | "gray";
}

export function resolveModelSettingsForRequest(): ReturnType<typeof loadModelSettings> {
  return loadModelSettings();
}
