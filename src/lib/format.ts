const LOCALE = 'en-IN';

/** Returns a Date only if `value` parses to a real date. */
function parse(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** "12 Mar 2026" — falls back to the raw string if it isn't a date. */
export function formatDate(value?: string | null, fallback = '—') {
  const d = parse(value);
  if (!d) return value || fallback;
  return d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "12 Mar, 4:30 pm" — used in the lending logs. */
export function formatDateTime(value?: string | null, fallback = '—') {
  const d = parse(value);
  if (!d) return value || fallback;
  const date = d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time}`;
}

/** "just now" / "3 days ago" — for at-a-glance recency. */
export function formatRelative(value?: string | null) {
  const d = parse(value);
  if (!d) return '';
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return formatDate(value);
}

export function getYear(value?: string | null): number | null {
  const d = parse(value);
  return d ? d.getFullYear() : null;
}

/** Turns an email into a readable handle when no display name is known. */
export function nameFromEmail(email: string) {
  return email.split('@')[0];
}
