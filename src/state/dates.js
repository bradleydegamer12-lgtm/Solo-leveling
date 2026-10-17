// Date helpers — all keys are local-time "YYYY-MM-DD" strings.

export function dateKey(input = new Date()) {
  const d = input instanceof Date ? input : new Date(input);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, amount) {
  const d = parseKey(key);
  d.setDate(d.getDate() + amount);
  return dateKey(d);
}

/** Positive when `a` is after `b`. */
export function diffDays(a, b) {
  const ms = parseKey(a).getTime() - parseKey(b).getTime();
  return Math.round(ms / 86400000);
}

/** Weekday 0 (Sunday) .. 6 (Saturday) for a date key. */
export function weekdayOf(key) {
  return parseKey(key).getDay();
}

/** Monday-based start-of-week key. */
export function startOfWeek(key) {
  const d = parseKey(key);
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return dateKey(d);
}

/** Stable week identifier, e.g. "2026-W42" (Monday start). */
export function weekKey(key) {
  const start = startOfWeek(key);
  const d = parseKey(start);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.floor((d - jan1) / 604800000) + 1;
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];
const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export function labelFor(key, { withYear = false } = {}) {
  const d = parseKey(key);
  const base = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return withYear ? `${base}, ${d.getFullYear()}` : base;
}

export function weekdayLabel(key) {
  return DAYS[weekdayOf(key)];
}

/** Last `count` date keys ending at `key`. */
export function lastDays(key, count) {
  const out = [];
  for (let i = count - 1; i >= 0; i--) out.push(addDays(key, -i));
  return out;
}

/** First `count` date keys of the week containing `key` (Monday start). */
export function weekDays(key) {
  const start = startOfWeek(key);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function relativeDayLabel(key, todayKey) {
  const delta = diffDays(todayKey, key);
  if (delta === 0) return "Today";
  if (delta === 1) return "Yesterday";
  if (delta > 1 && delta < 7) return `${delta} days ago`;
  return labelFor(key, { withYear: true });
}
