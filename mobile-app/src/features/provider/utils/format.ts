export function formatRelative(iso?: string | null): string {
  if (!iso) return 'n/a';

  const when = new Date(iso).getTime();
  if (Number.isNaN(when)) return 'n/a';

  const diffMs = Date.now() - when;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function formatStatusLabel(value?: string | null): string {
  if (!value) return 'Unknown';
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}
