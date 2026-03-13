import { clearStoredSession } from './session-storage';

type InvalidationHandler = (reason: string) => void;

let handler: InvalidationHandler | null = null;
let busy = false;

export function setAuthInvalidationHandler(next: InvalidationHandler): () => void {
  handler = next;
  return () => {
    if (handler === next) {
      handler = null;
    }
  };
}

export async function triggerAuthInvalidation(reason = 'token_invalidated'): Promise<void> {
  if (busy) return;

  busy = true;
  try {
    await clearStoredSession();
    handler?.(reason);
  } finally {
    setTimeout(() => {
      busy = false;
    }, 250);
  }
}
