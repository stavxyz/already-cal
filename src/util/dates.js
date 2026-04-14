/** Format an ISO date string as a full date (e.g. "Monday, April 14, 2026"). */
export function formatDate(isoString, timezone, locale) {
  locale = locale || 'en-US';
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(isoString));
}

/** Format an ISO date string as a short date (e.g. "Apr 14"). */
export function formatDateShort(isoString, timezone, locale) {
  locale = locale || 'en-US';
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    month: 'short',
    day: 'numeric',
  }).format(new Date(isoString));
}

/** Format an ISO date string as a time (e.g. "7:00 PM"). */
export function formatTime(isoString, timezone, locale) {
  locale = locale || 'en-US';
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(isoString));
}

/** Format an ISO date string as full date + time (e.g. "Monday, April 14, 2026 · 7:00 PM"). */
export function formatDatetime(isoString, timezone, locale) {
  return `${formatDate(isoString, timezone, locale)} · ${formatTime(isoString, timezone, locale)}`;
}

/** Return the number of days in a given month (1-indexed result). */
export function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/** Return the column index (0-based) of the first day of a month, adjusted for week start day. */
export function getFirstDayOfMonth(year, month, weekStartDay) {
  weekStartDay = weekStartDay || 0;
  const raw = new Date(year, month, 1).getDay();
  return (raw - weekStartDay + 7) % 7;
}

/** Check whether two Date objects fall on the same calendar day. */
export function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

/** Check whether a Date object is today. */
export function isToday(date) {
  return isSameDay(date, new Date());
}

/** Check whether an ISO date string is in the past. */
export function isPast(isoString) {
  return new Date(isoString) < new Date();
}

/** Format a month and year as a localized string (e.g. "April 2026"). */
export function getMonthName(year, month, locale) {
  locale = locale || 'en-US';
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' })
    .format(new Date(year, month));
}

/** Extract year, month (0-indexed), and day from an ISO string in a given timezone. */
export function getDatePartsInTz(isoString, timezone, locale) {
  locale = locale || 'en-US';
  const d = new Date(isoString);
  const fmt = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    year: 'numeric', month: 'numeric', day: 'numeric',
  });
  const parts = {};
  for (const { type, value } of fmt.formatToParts(d)) {
    if (type === 'year') parts.year = parseInt(value);
    if (type === 'month') parts.month = parseInt(value) - 1;
    if (type === 'day') parts.day = parseInt(value);
  }
  return parts;
}

/** Return an array of 7 Date objects representing the week containing the given date. */
export function getWeekDates(date, weekStartDay) {
  weekStartDay = weekStartDay || 0;
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day - weekStartDay + 7) % 7;
  const start = new Date(d);
  start.setDate(d.getDate() - diff);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const current = new Date(start);
    current.setDate(start.getDate() + i);
    dates.push(current);
  }
  return dates;
}

/** Return localized short day names (e.g. ["Sun", "Mon", ...]) starting from weekStartDay. */
export function getDayNames(locale, weekStartDay) {
  locale = locale || 'en-US';
  weekStartDay = weekStartDay || 0;
  const names = [];
  // Use a known Sunday (Jan 4, 2026 is a Sunday)
  const base = new Date(2026, 0, 4);
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + ((weekStartDay + i) % 7));
    names.push(new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(d));
  }
  return names;
}
