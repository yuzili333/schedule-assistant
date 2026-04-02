export interface AuditEvent {
  id: string;
  requestId: string;
  userId?: string;
  sessionId?: string;
  route?: string;
  target?: string;
  latencyMs?: number;
  status: "started" | "completed" | "errored" | "rate_limited";
  timestamp: string;
  metadata?: Record<string, unknown>;
}

const MAX_AUDIT_EVENTS = 200;
const auditEvents: AuditEvent[] = [];

export function recordAuditEvent(event: AuditEvent): void {
  auditEvents.unshift(event);
  if (auditEvents.length > MAX_AUDIT_EVENTS) {
    auditEvents.length = MAX_AUDIT_EVENTS;
  }
}

export function listAuditEvents(): AuditEvent[] {
  return auditEvents;
}
