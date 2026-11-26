// R2 / FX-012: scrub diagnosis/condition content out of outbound
// notification payloads (SMS / notification-center messages). Staff-composed
// free text like "Household contact of patient diagnosed with HIV" must
// never leave as readable text. Word-boundary, case-insensitive; clean
// messages pass through byte-identical.

const CONDITION_TERMS = [
  // Sensitive (consent-gated disclosure categories)
  'hiv', 'aids', 'sti', 'std', 'syphilis', 'gonorrh', 'chlamydia',
  'trichomoniasis', 'herpes', 'hpv', 'tuberculosis', '\\btb\\b',
  'hepatitis b', 'hepatitis c',
  // Other infectious (same propagation list as household-risk)
  'covid', 'meningitis', 'meningococcal', 'measles', 'typhoid', 'cholera',
  // Chronic / heritable (must not leak via household-adjacent messages either)
  'diabetes', 'hypertension', 'cancer', 'carcinoma', 'tumour', 'tumor',
  'sickle cell', 'haemophilia', 'hemophilia', 'epilepsy', 'asthma',
  'kidney disease', 'ckd', 'heart failure', 'stroke',
  'depression', 'anxiety disorder', 'bipolar', 'schizophrenia',
];

const PATTERNS = CONDITION_TERMS.map((t) => {
  const anchored = t.startsWith('\\b') || t.endsWith('\\b');
  const body = t.replace(/^\\b/, '').replace(/\\b$/, '');
  return new RegExp(anchored ? t : `\\b${body}\\b`, 'gi');
});

export const SCRUB_REPLACEMENT = '[health details removed — open the Umoya app to read this message]';

export function scrubConditionTerms(message: string): string {
  if (!message) return message;
  let out = message;
  for (const re of PATTERNS) {
    re.lastIndex = 0;
    if (re.test(out)) {
      re.lastIndex = 0;
      out = out.replace(re, SCRUB_REPLACEMENT);
    }
  }
  return out;
}
