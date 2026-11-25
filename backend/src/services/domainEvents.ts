/**
 * Minimal internal domain-event bus. It deliberately does NOT claim delivery:
 * no SMS/email/WebSocket is invoked. Future SSE/WebSocket adapters can
 * subscribe here; recent events also support an internal notification feed.
 */
import crypto from 'crypto';

export type CivicDomainEventType =
  | 'PUBLIC_REPORT_CREATED'
  | 'AI_ANALYSIS_COMPLETED'
  | 'AI_ANALYSIS_UNAVAILABLE'
  | 'REPORT_GROUPED'
  | 'OFFICIAL_LOGIN'
  | 'OFFICIAL_LOGIN_FAILED'
  | 'OFFICIAL_LOGOUT'
  | 'REPORT_ACTION'
  | 'SETTINGS_UPDATED';

export interface CivicDomainEvent {
  id: string;
  type: CivicDomainEventType;
  createdAt: Date;
  payload: Record<string, unknown>;
}

type Listener = (event: CivicDomainEvent) => void;

const listeners = new Set<Listener>();
const recent: CivicDomainEvent[] = [];

export function publishDomainEvent(
  type: CivicDomainEventType,
  payload: Record<string, unknown> = {},
): CivicDomainEvent {
  const event: CivicDomainEvent = {
    id: crypto.randomUUID(),
    type,
    createdAt: new Date(),
    // Payloads are intentionally IDs/counts only — never image bytes or secrets.
    payload,
  };
  recent.unshift(event);
  if (recent.length > 200) recent.pop();
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // A future transport must not break the request that emitted the event.
    }
  }
  return event;
}

export function subscribeDomainEvents(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function recentDomainEvents(limit = 50): CivicDomainEvent[] {
  return recent.slice(0, Math.min(Math.max(limit, 1), 200));
}
