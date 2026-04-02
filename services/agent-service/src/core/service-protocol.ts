import { AgentMessage, AgentResultMetadata } from "./types";
import { RouteDecision } from "./router";

export interface AgentServiceRequest {
  sessionId?: string;
  userId?: string;
  messages: AgentMessage[];
  metadata?: Record<string, unknown>;
}

export interface AgentServiceResponse {
  content: string;
  decision: RouteDecision;
  latencyMs: number;
  resultMetadata?: AgentResultMetadata;
  requestId: string;
}

export interface AgentChunkEvent {
  type: "chunk";
  chunk: string;
}

export interface AgentMetaEvent {
  type: "meta";
  payload: AgentServiceResponse;
}

export interface AgentErrorEvent {
  type: "error";
  message: string;
  requestId?: string;
}

export interface AgentDoneEvent {
  type: "done";
  requestId: string;
}

export type AgentServiceStreamEvent =
  | AgentChunkEvent
  | AgentMetaEvent
  | AgentErrorEvent
  | AgentDoneEvent;
