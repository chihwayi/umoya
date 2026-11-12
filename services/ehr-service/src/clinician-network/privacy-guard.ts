// S286 — TypeScript port of services/cdss-service/privacy_guard.py.
//
// Faithful, behavior-equivalent port: same patterns in the same order, same
// replacement tokens, same matching semantics (Python \b / \s translate directly
// to JS RegExp; the one case-sensitive pattern — the 8-20 char alnum ID — stays
// case-sensitive here too). Deliberately scoped to flat free-text strings:
// the Python dict-walking redact_value() is NOT ported because Clinician Network
// free-text fields are flat strings, not nested payloads.
//
// NOTE on the enable flag: the ported isPHIRedactionEnabled()/redactText() keep
// the Python gating behavior, but the Clinician Network createTopic()/createReply()
// path MUST NOT consult the flag — PHI enforcement there is mandatory and
// unconditional (see docs/CLINICIAN-NETWORK-ARCHITECTURE.md §PHI safety pipeline).
// The service layer calls containsPHI()/findPhiMatch() directly for this reason.

export type PhiMatchKind = 'email' | 'phone' | 'ssn' | 'id' | 'mrn' | 'dob' | 'name';

export interface PhiMatch {
  kind: PhiMatchKind;
  match: string;
}

interface PhiPattern {
  kind: PhiMatchKind;
  pattern: RegExp;
  replacement: string;
}

const PHI_PATTERNS: PhiPattern[] = [
  // Emails
  {
    kind: 'email',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    replacement: '[REDACTED_EMAIL]',
  },
  // Phone numbers (international and local-ish forms)
  {
    kind: 'phone',
    pattern: /\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)\d{3,4}[-.\s]?\d{3,4}\b/g,
    replacement: '[REDACTED_PHONE]',
  },
  // SSN style
  {
    kind: 'ssn',
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: '[REDACTED_ID]',
  },
  // National/passport-like long alnum IDs (case-sensitive, as in Python)
  {
    kind: 'id',
    pattern: /\b[A-Z0-9]{8,20}\b/g,
    replacement: '[REDACTED_ID]',
  },
  // MRN labels
  {
    kind: 'mrn',
    pattern: /\b(MRN|Patient\s*ID|PID)\s*[:#]?\s*[A-Za-z0-9\-_/]+\b/gi,
    replacement: '[REDACTED_MRN]',
  },
  // DOB labels + date-like values
  {
    kind: 'dob',
    pattern: /\b(DOB|Date\s*of\s*Birth)\s*[:#]?\s*[0-9]{1,4}[/-][0-9]{1,2}[/-][0-9]{1,4}\b/gi,
    replacement: '[REDACTED_DOB]',
  },
  // Explicit "patient name" labels
  {
    kind: 'name',
    pattern: /\b(?:patient\s*)?name\s*[:#]?\s*[A-Za-z][A-Za-z'\-]+(?:\s+[A-Za-z][A-Za-z'\-]+){1,3}\b/gi,
    replacement: '[REDACTED_NAME]',
  },
];

// ---------------------------------------------------------------------------
// CLINICIAN-NETWORK-ONLY ADDITION — NOT part of the Python port above.
//
// Bare calendar dates (no "DOB:"/"Date of Birth:" label) are not caught by the
// ported patterns, which require the label. In a case-discussion narrative an
// exact date is never legitimate content here (age is an enum band; recency is
// "3 days ago") and is almost always a DOB or visit date — both patient
// identifiers. So this additive check flags them as dob-kind matches. The
// ported containsPHI()/redactText() above are deliberately left untouched.
// ---------------------------------------------------------------------------
const BARE_DATE_PATTERNS: RegExp[] = [
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/,
  /\b\d{1,2}-\d{1,2}-\d{2,4}\b/,
  /\b\d{4}-\d{1,2}-\d{1,2}\b/,
];

export function findBareDateMatch(text: string): PhiMatch | null {
  if (!text) {
    return null;
  }
  for (const pattern of BARE_DATE_PATTERNS) {
    pattern.lastIndex = 0;
    const found = pattern.exec(text);
    if (found) {
      return { kind: 'dob', match: found[0] };
    }
  }
  return null;
}

export function isPHIRedactionEnabled(): boolean {
  return (process.env.CDSS_PHI_REDACTION_ENABLED ?? 'true').toLowerCase() === 'true';
}

export function redactText(text: string): string {
  if (!text) {
    return text;
  }
  if (!isPHIRedactionEnabled()) {
    return text;
  }
  let out = text;
  for (const { pattern, replacement } of PHI_PATTERNS) {
    pattern.lastIndex = 0;
    out = out.replace(pattern, replacement);
  }
  return out;
}

export function containsPHI(text: string): boolean {
  if (!text) {
    return false;
  }
  return findPhiMatch(text) !== null;
}

// Additive helper (no Python equivalent needed — contains_phi returns bool only):
// returns the first matching pattern's kind and exact matched span so the
// composer can highlight precisely what to fix (fix-and-resubmit flow).
export function findPhiMatch(text: string): PhiMatch | null {
  if (!text) {
    return null;
  }
  for (const { kind, pattern } of PHI_PATTERNS) {
    pattern.lastIndex = 0;
    const found = pattern.exec(text);
    if (found) {
      return { kind, match: found[0] };
    }
  }
  return null;
}
