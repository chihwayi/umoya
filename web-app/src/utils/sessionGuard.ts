/**
 * Client-side session guard for the super-admin panel.
 *
 * The backend issues a stateless JWT with a fixed expiry. Without this guard,
 * an idle admin sitting on a page would only discover their session died on the
 * next API call (a 401). This proactively:
 *   1. Redirects to the login page the moment the token expires.
 *   2. Auto-logs-out after a window of inactivity (idle timeout).
 *   3. Logs out every tab when one tab logs out (cross-tab via storage events).
 *
 * It is deliberately self-contained (no React deps) so it can run from App boot.
 */

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user';
const IDLE_LOGOUT_MS = 30 * 60 * 1000; // 30 minutes of inactivity
const EXPIRY_SKEW_MS = 5 * 1000;       // log out 5s before actual exp to avoid a failed call

type Reason = 'expired' | 'idle';

let expiryTimer: ReturnType<typeof setTimeout> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

function decodeExpMs(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload?.exp) return payload.exp * 1000;
  } catch {
    /* malformed token */
  }
  return null;
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function redirectToLogin(reason: Reason) {
  clearSession();
  // Preserve a flag so the login page can show why the session ended.
  const url = `/?session=${reason}`;
  if (!window.location.search.includes(`session=${reason}`)) {
    window.location.href = url;
  }
}

function clearTimers() {
  if (expiryTimer) { clearTimeout(expiryTimer); expiryTimer = null; }
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
}

function scheduleExpiry() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;
  const expMs = decodeExpMs(token);
  if (!expMs) return;
  const fireIn = expMs - Date.now() - EXPIRY_SKEW_MS;
  if (expiryTimer) clearTimeout(expiryTimer);
  if (fireIn <= 0) {
    redirectToLogin('expired');
    return;
  }
  // setTimeout caps at ~24.8 days; our tokens are far shorter, so this is safe.
  expiryTimer = setTimeout(() => redirectToLogin('expired'), fireIn);
}

function resetIdle() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => redirectToLogin('idle'), IDLE_LOGOUT_MS);
}

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

function onVisibilityChange() {
  // When a backgrounded tab is refocused, re-verify the token immediately —
  // it may have expired while the tab was hidden (timers can be throttled).
  if (document.visibilityState === 'visible') {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { redirectToLogin('expired'); return; }
    const expMs = decodeExpMs(token);
    if (expMs && expMs - Date.now() <= EXPIRY_SKEW_MS) {
      redirectToLogin('expired');
    } else {
      scheduleExpiry();
    }
  }
}

function onStorage(e: StorageEvent) {
  // Another tab logged out / token removed → log this tab out too.
  if (e.key === TOKEN_KEY && !e.newValue) {
    redirectToLogin('expired');
  }
}

/** Start the guard. Call once, after a successful login / on an authenticated boot. */
export function startSessionGuard() {
  if (started) return;
  started = true;
  scheduleExpiry();
  resetIdle();
  ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, resetIdle, { passive: true }));
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('storage', onStorage);
}

/** Stop the guard and remove listeners (call on explicit logout). */
export function stopSessionGuard() {
  started = false;
  clearTimers();
  ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, resetIdle));
  document.removeEventListener('visibilitychange', onVisibilityChange);
  window.removeEventListener('storage', onStorage);
}

/** Human-readable reason from the URL, for the login page banner. */
export function readSessionEndReason(): Reason | null {
  const params = new URLSearchParams(window.location.search);
  const r = params.get('session');
  return r === 'expired' || r === 'idle' ? r : null;
}
