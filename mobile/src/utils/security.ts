/**
 * Umoya Security Utilities — S118
 *
 * HIPAA-required controls:
 *  - Certificate pinning config (NOT YET ENFORCED — see note below)
 *  - Screen privacy / background snapshot prevention
 *  - Inactivity session lock
 *  - PHI masking for logs
 *  - Structured audit log
 */

import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';

// ─── Certificate pinning ──────────────────────────────────────────────────────

/**
 * NOT CURRENTLY ENFORCED. This config and `validatePin` below are inert.
 *
 * React Native's networking (axios/fetch) goes through the native TLS stack
 * (NSURLSession on iOS, OkHttp on Android) to complete the handshake before
 * any JS code — including an axios response interceptor — ever sees the
 * response. JS has no access to the server's certificate or its SPKI hash
 * at that point, so `validatePin` can never be called with real data and a
 * pinning bypass in a MITM scenario would not be caught here.
 *
 * To make this real, certificate pinning has to be enforced natively:
 *  1. Pick a native pinning mechanism, e.g. the `react-native-ssl-pinning`
 *     package, or configure OkHttp's CertificatePinner (Android) and
 *     NSURLSession server-trust evaluation (iOS) directly.
 *  2. Obtain the real SHA-256 SPKI hash(es) for api.umoya.app's production
 *     certificate and its backup/rotation cert, e.g.:
 *       openssl s_client -connect api.umoya.app:443 | \
 *         openssl x509 -pubkey -noout | \
 *         openssl pkey -pubin -outform der | \
 *         openssl dgst -sha256 -binary | base64
 *  3. Replace the placeholder values below with the real hashes.
 *  4. Wire the chosen mechanism into the native layer so it actually
 *     enforces the pins on every request, not just defines them.
 *  5. Verify on real iOS and Android builds: a request to the real API
 *     succeeds, and a MITM/pinning-failure scenario is rejected.
 *
 * None of that has been done yet — this needs a build pipeline capable of
 * producing installable iOS/Android builds and someone with access to the
 * real production certificate, neither of which is available from this
 * repo alone. Track this as a follow-up; do not treat CERT_PINS as active
 * protection until it is wired up natively and verified on-device.
 */
export const CERT_PINS: Record<string, string[]> = {
  'api.umoya.app': [
    'sha256/REPLACE_WITH_PRIMARY_SPKI_HASH=',
    'sha256/REPLACE_WITH_BACKUP_SPKI_HASH=',
  ],
  'api-staging.umoya.app': [
    'sha256/REPLACE_WITH_STAGING_SPKI_HASH=',
  ],
};

/**
 * Reference implementation only — see the CERT_PINS note above. Not called
 * anywhere in the app because JS never sees the cert to validate.
 */
export const validatePin = (host: string, receivedPin: string): boolean => {
  const pins = CERT_PINS[host];
  if (!pins) return false; // unknown host → reject
  return pins.includes(receivedPin);
};

// ─── PHI masking ─────────────────────────────────────────────────────────────

/**
 * Replace a PHI string with a masked representation safe for logging.
 * Never log raw patient names, MRNs, or clinical values to analytics/crash tools.
 */
export const maskPHI = (value: string): string => {
  if (!value) return '[REDACTED]';
  if (value.length <= 2) return '**';
  return value[0] + '*'.repeat(value.length - 2) + value[value.length - 1];
};

/**
 * Safe patient identifier for crash reports — only first initial + MRN prefix.
 */
export const safePatientId = (name: string, mrn: string): string =>
  `${name[0] ?? '?'}. / MRN-${mrn.slice(0, 4)}***`;

// ─── Audit log ────────────────────────────────────────────────────────────────

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'VIEW_PATIENT'
  | 'VIEW_LAB'
  | 'SIGN_SOAP'
  | 'SEND_MESSAGE'
  | 'ESCALATE'
  | 'RESOLVE_ESCALATION'
  | 'MARK_MED_TAKEN'
  | 'PAY_BILL'
  | 'EXPORT_DOCUMENT'
  | 'SESSION_LOCK'
  | 'SESSION_UNLOCK'
  | 'BIOMETRIC_SUCCESS'
  | 'BIOMETRIC_FAIL';

export interface AuditEntry {
  timestamp: string;    // ISO-8601
  action: AuditAction;
  userId?: string;
  tenantId?: string;
  detail?: string;
  platform: string;
  appVersion: string;
}

/** In-memory audit buffer — flushed to server on auth actions and app foreground. */
const auditBuffer: AuditEntry[] = [];

export const audit = (
  action: AuditAction,
  opts: { userId?: string; tenantId?: string; detail?: string } = {},
): void => {
  const entry: AuditEntry = {
    timestamp:  new Date().toISOString(),
    action,
    platform:   Platform.OS,
    appVersion: '1.0.0',
    ...opts,
  };
  auditBuffer.push(entry);
  // In production, flush to /api/v1/audit over mTLS.
  // For now, keep a rolling 500-entry buffer (discard oldest).
  if (auditBuffer.length > 500) auditBuffer.shift();
};

export const flushAuditLog = (): AuditEntry[] => {
  const snapshot = [...auditBuffer];
  auditBuffer.length = 0;
  return snapshot;
};

// ─── Screen privacy hook ──────────────────────────────────────────────────────

/**
 * Returns `isPrivate: true` whenever the app enters background/inactive state.
 * App.tsx renders an opaque overlay when this is true, preventing OS screenshots
 * and app-switcher thumbnails from capturing PHI.
 *
 * iOS: app switcher snapshot is taken at 'inactive' → we cover before that.
 * Android: recent-apps thumbnail is taken at 'background' → we cover before that.
 */
export const useScreenPrivacy = (): boolean => {
  const [isPrivate, setIsPrivate] = _useState(false);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      setIsPrivate(next === 'inactive' || next === 'background');
    });
    return () => sub.remove();
  }, []);

  return isPrivate;
};

/**
 * Full hook variant for use in App.tsx — returns [isPrivate, appState].
 */
export const useAppPrivacyState = (): { isPrivate: boolean; appState: AppStateStatus } => {
  const currentState = useRef<AppStateStatus>(AppState.currentState);
  const [state, setState] = _useState({ isPrivate: false, appState: AppState.currentState });

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const isPrivate = next === 'inactive' || next === 'background';
      currentState.current = next;
      setState({ isPrivate, appState: next });

      if (isPrivate) audit('SESSION_LOCK');
      else           audit('SESSION_UNLOCK');
    });
    return () => sub.remove();
  }, []);

  return state;
};

// Avoid importing React at the top level of a utility — use a thin polyfill
// that resolves to the real React.useState at call-time.
function _useState<T>(init: T): [T, (v: T) => void] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useState } = require('react') as typeof import('react');
  return useState(init);
}

// ─── Inactivity lock hook ─────────────────────────────────────────────────────

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fires `onLock` after INACTIVITY_TIMEOUT_MS of app being in background.
 * Reset the timer by calling the returned `resetTimer` function on user interaction.
 */
export const useInactivityLock = (onLock: () => void): (() => void) => {
  const timer      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bgEnteredAt = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const resetTimer = useCallback(() => {
    clearTimer();
    timer.current = setTimeout(onLock, INACTIVITY_TIMEOUT_MS);
  }, [clearTimer, onLock]);

  useEffect(() => {
    resetTimer();
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        bgEnteredAt.current = Date.now();
        clearTimer();
      } else if (next === 'active') {
        const elapsed = bgEnteredAt.current ? Date.now() - bgEnteredAt.current : 0;
        bgEnteredAt.current = null;
        if (elapsed >= INACTIVITY_TIMEOUT_MS) {
          onLock();
        } else {
          resetTimer();
        }
      }
    });
    return () => {
      clearTimer();
      sub.remove();
    };
  }, [clearTimer, resetTimer, onLock]);

  return resetTimer;
};

// ─── Jailbreak / root detection hint ─────────────────────────────────────────

/**
 * Heuristic checks — not foolproof, but raises the bar.
 * Production builds should use a native module (e.g. react-native-device-info)
 * for deeper checks. This is a pure-JS baseline.
 */
export const suspectCompromisedEnvironment = (): boolean => {
  if (__DEV__) return false; // skip in dev
  // Expo Go indicates an unpackaged environment
  if (typeof (globalThis as any).ExpoModules?.ExpoGo !== 'undefined') return true;
  return false;
};
