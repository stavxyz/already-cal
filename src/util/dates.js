/** A bare calendar date with no time component, e.g. an all-day event's
 *  `start.date` ("2026-08-19"). `new Date("YYYY-MM-DD")` parses as UTC
 *  midnight, so these absolute dates must be formatted in UTC to render on the
 *  entered day regardless of the viewer/calendar timezone — without this they
 *  shift back a day in negative-offset zones (Aug 19 → Aug 18 in the Americas). */
export const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Format zone for `isoString`: UTC for all-day (date-only) values so they
 *  don't cross a timezone boundary; the given `timezone` for timed values. */
function zoneFor(isoString, timezone) {
  return DATE_ONLY_RE.test(isoString) ? "UTC" : timezone;
}

/**
 * Parse an event's `start`/`end` value into a Date for TEMPORAL logic ("which
 * day is it", "is it past"). The two-axis rule for date-only (all-day) values:
 * DISPLAY/placement is absolute — formatted in UTC (see `zoneFor`) so a date
 * renders on the entered day in every zone — whereas TEMPORAL logic is
 * viewer-local: an all-day value is parsed as LOCAL midnight so the event
 * belongs to, and stays current through, the viewer's calendar day. Do NOT make
 * the date-only branch UTC, or all-day events flip to past in the evening of
 * their last day in negative-offset (US) zones. Timed values parse to their
 * instant. Shared by `isPast` and the day view.
 */
export function parseEventDate(value) {
  return DATE_ONLY_RE.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
}

/** Format an ISO date string as a full date (e.g. "Monday, April 14, 2026"). */
export function formatDate(isoString, timezone, locale) {
  locale = locale || "en-US";
  return new Intl.DateTimeFormat(locale, {
    timeZone: zoneFor(isoString, timezone),
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(isoString));
}

/** Format an ISO date string as a short date (e.g. "Apr 14"). */
export function formatDateShort(isoString, timezone, locale) {
  locale = locale || "en-US";
  return new Intl.DateTimeFormat(locale, {
    timeZone: zoneFor(isoString, timezone),
    month: "short",
    day: "numeric",
  }).format(new Date(isoString));
}

/**
 * Format an event's start→end span as one localized string via
 * `Intl.DateTimeFormat.prototype.formatRange` (smart collapse). The four
 * shapes below are a stable public contract — keep them consistent if the
 * formatter changes.
 *
 * Shapes: timed same-day "Jul 3, 3:00 – 5:00 PM"; timed multi-day
 * "Jul 3, 3:00 PM – Jul 5, 1:00 PM"; all-day single "Jul 3"; all-day multi-day
 * "Jul 3 – 5".
 *
 * @param {string} start ISO start ("2026-07-03T20:00:00Z" or all-day "2026-07-03")
 * @param {string} [end] ISO end; an all-day `end` is Google's EXCLUSIVE end.date
 * @param {object} [opts]
 * @param {boolean} [opts.allDay=false] date-only event (no times; exclusive end −1)
 * @param {string} [opts.timeZone] IANA zone for TIMED values (all-day is UTC)
 * @param {string} [opts.locale="en-US"]
 * @param {boolean} [opts.withTime=true] include the time for timed events
 * @param {"short"|"full"|"time"} [opts.dateStyle="short"] date presentation;
 *   "time" = time range only (day-view cell)
 * @returns {string}
 */
export function formatDateRange(start, end, opts = {}) {
  const {
    allDay = false,
    timeZone,
    locale = "en-US",
    withTime = true,
    dateStyle = "short",
  } = opts;
  if (!start) return "";

  // All-day values are absolute — format in UTC (see zoneFor / DATE_ONLY_RE) so
  // they don't cross a timezone boundary; timed values use the given zone.
  const zone = zoneFor(start, timeZone);
  const showTime = withTime && !allDay;

  const dateOpts =
    dateStyle === "time"
      ? {}
      : dateStyle === "full"
        ? { weekday: "long", month: "long", day: "numeric", year: "numeric" }
        : { month: "short", day: "numeric" };
  const timeOpts =
    showTime || dateStyle === "time"
      ? { hour: "numeric", minute: "2-digit" }
      : {};

  const fmt = new Intl.DateTimeFormat(locale || "en-US", {
    timeZone: zone,
    ...dateOpts,
    ...timeOpts,
  });

  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return ""; // malformed start → degrade, don't throw
  let endDate = end ? new Date(end) : null;
  // Google's all-day end.date is EXCLUSIVE; render the inclusive last day.
  if (endDate && allDay) endDate = new Date(endDate.getTime() - 86_400_000);

  // Missing / invalid / backwards end → single instant (formatRange(d,d) also
  // collapses, but format(d) is unambiguous).
  const raw =
    !endDate || Number.isNaN(endDate.getTime()) || endDate <= startDate
      ? fmt.format(startDate)
      : fmt.formatRange(startDate, endDate);
  // ICU inserts typographic spaces — a thin space (U+2009) around range
  // dashes and a narrow no-break space (U+202F) before AM/PM — and which
  // character it uses varies by ICU/CLDR (Node) version. Collapse every
  // whitespace run to a plain space so the output is deterministic across the
  // Node matrix and renders predictably.
  return raw.replace(/\s+/g, " ");
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
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/** Check whether a Date object is today. */
export function isToday(date) {
  return isSameDay(date, new Date());
}

/** Check whether an ISO date string is in the past. */
export function isPast(isoString) {
  // Date-only (all-day) values compare by viewer-local day; timed values by
  // instant — see parseEventDate for the two-axis (display=UTC / temporal=local)
  // rationale. Using UTC here would flip all-day events to past in the evening
  // of their last day in negative-offset zones.
  return parseEventDate(isoString) < new Date();
}

/** Format a month and year as a localized string (e.g. "April 2026"). */
export function getMonthName(year, month, locale) {
  locale = locale || "en-US";
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month));
}

/** Extract year, month (0-indexed), and day from an ISO string in a given timezone. */
export function getDatePartsInTz(isoString, timezone, locale) {
  locale = locale || "en-US";
  const d = new Date(isoString);
  const fmt = new Intl.DateTimeFormat(locale, {
    timeZone: zoneFor(isoString, timezone),
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = {};
  for (const { type, value } of fmt.formatToParts(d)) {
    if (type === "year") parts.year = parseInt(value, 10);
    if (type === "month") parts.month = parseInt(value, 10) - 1;
    if (type === "day") parts.day = parseInt(value, 10);
  }
  return parts;
}

export const MONTH_NAMES_SHORT = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

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
  locale = locale || "en-US";
  weekStartDay = weekStartDay || 0;
  const names = [];
  // Use a known Sunday (Jan 4, 2026 is a Sunday)
  const base = new Date(2026, 0, 4);
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + ((weekStartDay + i) % 7));
    names.push(new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d));
  }
  return names;
}
