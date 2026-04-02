export interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

export interface PersonLookupCandidate {
  id: string;
  name: string;
  department: string;
  title: string;
  email: string;
  role: "attendee" | "cc";
  sourceName: string;
}

export interface CreateCalendarDraft {
  title: string;
  startDate: string;
  endDate: string;
  allDay?: boolean;
  meetingRoom?: string;
  videoMeetingCode?: string;
  description?: string;
  attachments?: string[];
  reminderChannels?: string[];
  urgent?: boolean;
  attendeeNameQueries?: string[];
  ccNameQueries?: string[];
  selectedAttendeeIds?: string[];
  selectedAttendeeNames?: string[];
  selectedCcIds?: string[];
  selectedCcNames?: string[];
  suggestionSource?: "recent_todo" | "recent_event" | "cache";
  suggestionSummary?: string;
}

export interface RecommendationField {
  fieldLabel: string;
  value: string;
  source: "recent_todo" | "recent_event" | "cache";
}

export interface ScheduleRecommendation {
  summary: string;
  sourceTodoTitle: string;
  sourceTodoSummary: string;
  recommendedFields: RecommendationField[];
  needsUserConfirm: boolean;
}

export interface RouteDecision {
  route: string;
  target?: string;
  confidence: number;
  risk: {
    requiresHumanConfirm: boolean;
  };
}

export interface AgentServiceResultMetadata {
  personCandidates?: PersonLookupCandidate[];
  draft?: CreateCalendarDraft;
  recommendation?: ScheduleRecommendation;
}

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
  resultMetadata?: AgentServiceResultMetadata;
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
