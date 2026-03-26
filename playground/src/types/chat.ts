import type { ModelSettings as AgentModelSettings } from "@schedule-assistant/agent";

export type SenderRole = "user" | "assistant" | "system";

export interface ChatCardMeta {
  route: string;
  target?: string;
  confidence: number;
  latencyMs: number;
  requiresConfirm: boolean;
}

export interface ChatItem {
  id: string;
  role: SenderRole;
  content: string;
  createdAt: string;
  meta?: ChatCardMeta;
  isStreaming?: boolean;
}

export type ModelSettings = AgentModelSettings;
