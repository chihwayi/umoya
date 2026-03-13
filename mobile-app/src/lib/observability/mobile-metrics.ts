type MobileMetricEvent = {
  name: string;
  at: string;
  payload?: Record<string, unknown>;
};

const MAX_EVENTS = 200;
const events: MobileMetricEvent[] = [];

export function trackMobileEvent(name: string, payload?: Record<string, unknown>): void {
  const event: MobileMetricEvent = {
    name,
    at: new Date().toISOString(),
    payload
  };

  events.unshift(event);
  if (events.length > MAX_EVENTS) {
    events.length = MAX_EVENTS;
  }

  // Keep local observability visible during release hardening.
  console.info(`[mobile-metric] ${name}`, payload || {});
}

export function getMobileEventBuffer(): MobileMetricEvent[] {
  return [...events];
}
