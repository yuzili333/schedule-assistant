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

export interface ModelSettings {
  provider: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  enabled: boolean;
  systemPrompt: string;
}
