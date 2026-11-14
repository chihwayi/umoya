// S287 — shared Clinician Network frontend shapes + error helpers.
//
// Anonymity contract (enforced server-side, asserted here only for display):
// topic/reply payloads carry `isOwnPost` + pseudonymous `authorHandle` — never
// a real clinician_id. If a response ever leaks one, it must not be rendered.

export interface CnPanel {
  id: string;
  name: string;
  specialty: string;
  description: string | null;
  visibility: string;
  memberCount: number;
  topicCount: number;
  isJoined: boolean;
}

export interface CnTopic {
  id: string;
  panel_id: string;
  title: string;
  body_redacted: string;
  structured_fields: Record<string, unknown>;
  tags: string[];
  status: string;
  resolved_reply_id: string | null;
  created_at: string;
  authorHandle: string;
  replyCount: number;
  isOwnPost: boolean;
}

export interface CnReply {
  id: string;
  topic_id: string;
  parent_reply_id: string | null;
  body_redacted: string;
  created_at: string;
  authorHandle: string;
  isOwnPost: boolean;
}

export interface PhiFieldError {
  field: string | null;
  matchedSpan: string | null;
  message: string;
}

export const CN_AGE_BANDS = [
  '0-17',
  '18-29',
  '30-39',
  '40-49',
  '50-59',
  '60-69',
  '70-79',
  '80+',
] as const;

function asRecord(value: unknown): Record<string, any> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, any>) : null;
}

// Nest serializes `throw new BadRequestException({...})` either as the object
// itself or nested under `message` — handle both so field-level PHI errors
// always highlight the right composer field.
export function extractPhiError(error: any): PhiFieldError {
  const data = error?.response?.data;
  const nested = asRecord(data?.message) ?? asRecord(data);
  const field = typeof nested?.field === 'string' ? nested.field : null;
  const matchedSpan =
    typeof nested?.matchedSpan === 'string' && nested.matchedSpan.length > 0
      ? nested.matchedSpan
      : null;
  const message =
    typeof nested?.message === 'string'
      ? nested.message
      : typeof data?.message === 'string'
        ? data.message
        : error?.message || 'Request failed. Please try again.';
  return { field, matchedSpan, message };
}

export function cnErrorMessage(error: any, fallback: string): string {
  const data = error?.response?.data;
  const nested = asRecord(data?.message);
  if (nested && typeof nested.message === 'string') return nested.message;
  if (typeof data?.message === 'string') return data.message;
  return error?.message || fallback;
}
