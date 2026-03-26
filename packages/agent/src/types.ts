export interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

export interface PersonCandidate {
  id: string;
  name: string;
  department: string;
  title: string;
  email: string;
}

export interface PersonLookupCandidate extends PersonCandidate {
  role: "attendee" | "cc";
  sourceName: string;
}

export interface CalendarEventRecord {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  meetingRoom?: string;
  videoMeetingCode?: string;
  description?: string;
  attendees: PersonCandidate[];
  ccRecipients?: PersonCandidate[];
  reminderChannels: string[];
  urgent: boolean;
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
  suggestionSource?: "recent_todo" | "recent_event";
  suggestionSummary?: string;
}

export interface RecommendationField {
  fieldLabel: string;
  value: string;
  source: "recent_todo" | "recent_event";
}

export interface ScheduleRecommendation {
  summary: string;
  sourceTodoTitle: string;
  sourceTodoSummary: string;
  recommendedFields: RecommendationField[];
  needsUserConfirm: boolean;
}

export interface AgentResultMetadata {
  personCandidates?: PersonLookupCandidate[];
  draft?: CreateCalendarDraft;
  queriedEvents?: CalendarEventRecord[];
  recommendation?: ScheduleRecommendation;
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
