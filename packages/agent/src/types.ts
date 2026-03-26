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

export interface CalendarEventRecord {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  meetingRoom?: string;
  description?: string;
  attendees: PersonCandidate[];
  reminderChannels: string[];
  urgent: boolean;
}

export interface CreateCalendarDraft {
  title: string;
  startDate: string;
  endDate: string;
  allDay?: boolean;
  meetingRoom?: string;
  description?: string;
  attachments?: string[];
  reminderChannels?: string[];
  urgent?: boolean;
  attendeeNameQuery?: string;
  selectedAttendeeIds?: string[];
  selectedAttendeeNames?: string[];
}

export interface AgentResultMetadata {
  personCandidates?: PersonCandidate[];
  draft?: CreateCalendarDraft;
  queriedEvents?: CalendarEventRecord[];
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
