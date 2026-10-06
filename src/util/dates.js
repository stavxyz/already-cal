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

/** The runtime viewer's IANA zone, or "UTC" if unresolvable. */
export function viewerTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Resolve an IANA zone that `Intl` will actually accept, trying `timeZone`
 * then `fallback` and ending at "UTC".
 *
 * Every `Intl.DateTimeFormat` constructor throws a RangeError on an unknown
 * zone, so a single malformed `_sourceTimeZone` in the upstream payload (a
 * typo, a Windows zone id, a stale alias) would take down an entire render:
 * the grid/list views isolate each card via `safeRenderCard`, but the day
 * view, the detail view and `setEventMeta` have no such net. Normalising at
 * the point of consumption keeps a bad zone a cosmetic problem — the event
 * still renders, just anchored to the fallback.
 *
 * @param {string} [timeZone] preferred zone (e.g. `event._sourceTimeZone`)
 * @param {string} [fallback] zone to use when `timeZone` is missing/invalid
 * @returns {string} a zone `Intl` accepts
 */
export function resolveTimeZone(timeZone, fallback) {
  for (const candidate of [timeZone, fallback]) {
    if (!candidate) continue;
    try {
      new Intl.DateTimeFormat(undefined, { timeZone: candidate });
      return candidate;
    } catch {
      // Not a zone this runtime's ICU knows — try the next candidate.
    }
  }
  return "UTC";
}

/** Short zone name (e.g. "EDT", "UTC") for an instant in a zone. */
export function zoneAbbrev(isoString, timeZone, locale) {
  const parts = new Intl.DateTimeFormat(locale || "en-US", {
    timeZone,
    hour: "numeric",
    timeZoneName: "short",
  }).formatToParts(new Date(isoString));
  const part = parts.find((p) => p.type === "timeZoneName");
  return part ? part.value : "";
}

/** True when `isoString` shows a different hour:minute in the two zones. */
export function wallClockDiffers(isoString, zoneA, zoneB, locale) {
  const opts = { hour: "numeric", minute: "2-digit" };
  const date = new Date(isoString);
  const a = new Intl.DateTimeFormat(locale || "en-US", {
    ...opts,
    timeZone: zoneA,
  }).format(date);
  const b = new Intl.DateTimeFormat(locale || "en-US", {
    ...opts,
    timeZone: zoneB,
  }).format(date);
  return a !== b;
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

/** Format an ISO date string as a full date (e.g. "Monday, April 14, 2026").
 *  `timezone` is run through `resolveTimeZone` so a malformed calendar-level
 *  zone (e.g. `data.calendar.timezone`) degrades to UTC instead of throwing a
 *  RangeError out of nav/title renders (see day.js). */
export function formatDate(isoString, timezone, locale) {
  locale = locale || "en-US";
  return new Intl.DateTimeFormat(locale, {
    timeZone: zoneFor(isoString, resolveTimeZone(timezone)),
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(isoString));
}

/** Format an ISO date string as a short date (e.g. "Apr 14"). Zone is
 *  validated via `resolveTimeZone` — see `formatDate`. */
export function formatDateShort(isoString, timezone, locale) {
  locale = locale || "en-US";
  return new Intl.DateTimeFormat(locale, {
    timeZone: zoneFor(isoString, resolveTimeZone(timezone)),
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

/**
 * WIDGET event "when" label: primary time in the VIEWER's zone, with the event's
 * SOURCE-calendar zone appended (" · 3:00 PM EDT") when the two differ. All-day
 * events render in UTC with no suffix (absolute). Source zone = event._sourceTimeZone
 * ?? opts.sourceZoneFallback ?? UTC, each candidate validated by `resolveTimeZone`
 * so a malformed zone degrades instead of throwing. Keeps mixed-tz composite views correct: each
 * event carries its own zone. Do NOT use for share/meta surfaces — those stay
 * source-anchored (see already-cal.js setEventMeta).
 *
 * @param {object} event `{ start, end, allDay, _sourceTimeZone }`
 * @param {object} [opts] `{ sourceZoneFallback, locale, dateStyle }`
 * @returns {string}
 */
export function formatEventWhen(event, opts = {}) {
  const { sourceZoneFallback, locale = "en-US", dateStyle = "short" } = opts;
  const start = event.start;
  const end = event.end;
  if (!start) return "";

  if (event.allDay || DATE_ONLY_RE.test(start)) {
    return formatDateRange(start, end, { allDay: true, locale, dateStyle });
  }

  const viewer = viewerTimeZone();
  // Normalise before ANY Intl call: an unknown zone would otherwise throw a
  // RangeError out of this function and blank the whole view (see resolveTimeZone).
  const source = resolveTimeZone(event._sourceTimeZone, sourceZoneFallback);
  const primary = formatDateRange(start, end, {
    timeZone: viewer,
    locale,
    dateStyle,
  });

  if (source === viewer || !wallClockDiffers(start, source, viewer, locale)) {
    return primary;
  }
  // START ONLY — deliberately no `end`. The suffix is an at-a-glance "and that
  // is N o'clock where the event actually is", not a second full range. Passing
  // a multi-day `end` with dateStyle:"time" makes formatRange inject numeric
  // M/D/YYYY dates to disambiguate the endpoints ("7/15/2026, 3:00 PM –
  // 7/16/2026, …"), which clashes with the widget's house style and overflows
  // narrow columns — the same trap day.js sidesteps by reshaping `end`.
  const sourceTime = formatDateRange(start, undefined, {
    timeZone: source,
    locale,
    dateStyle: "time",
  });
  const abbrev = zoneAbbrev(start, source, locale);
  return `${primary} · ${sourceTime}${abbrev ? ` ${abbrev}` : ""}`;
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
export function getDatePartsInTz(isoString, timezone) {
  const d = new Date(isoString);
  // A fixed locale, on purpose. The parts are parsed back into numbers, and
  // a display locale may write digits in another script or count years in
  // another calendar, which would parse to NaN or to the wrong year.
  const fmt = new Intl.DateTimeFormat("en-US", {
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

/**
 * Date parts for EVENT PLACEMENT — which month cell / week column / date group
 * an event files under, and which day its card badge shows.
 *
 * Timed events bucket by the VIEWER's zone so the day an event lands on agrees
 * with the viewer-local time `formatEventWhen` prints on it; before this, a
 * merged multi-calendar feed placed events by the FIRST calendar's zone while
 * labelling them viewer-local, so a late-evening event could sit in one day's
 * cell showing the next day's time. (The day view already bucketed viewer-local
 * via `isSameDay(parseEventDate(...))`; this brings the rest in line.)
 *
 * All-day (date-only) values stay ABSOLUTE — `getDatePartsInTz` routes them
 * through `zoneFor` → UTC — so they never shift a day. Passing the viewer zone
 * here does not change that.
 *
 * @param {string} isoString event start ("2026-07-15T20:00:00Z" or "2026-07-15")
 */
export function getEventDateParts(isoString) {
  return getDatePartsInTz(isoString, viewerTimeZone());
}

/**
 * The one encoding of a day: `YYYY-MM-DD`, the form toDateKey gives a local
 * Date and the router puts in `#day/2026-04-04`. `zone` must be one Intl
 * accepts. A missing or malformed value has the empty key, which matches no
 * day. It must not throw: one bad `start` would otherwise blank a whole view.
 */
function dayKey(isoString, zone) {
  if (!isoString || Number.isNaN(new Date(isoString).getTime())) return "";
  const p = getDatePartsInTz(isoString, zone);
  const two = (n) => String(n).padStart(2, "0");
  return `${p.year}-${two(p.month + 1)}-${two(p.day)}`;
}

/**
 * The calendar day a value falls on in a named zone. An all-day (date-only)
 * value is absolute and keys to its own date in every zone. A zone Intl
 * cannot use gives way to `fallback`, and then to UTC (see resolveTimeZone).
 */
export function dayKeyInZone(isoString, timeZone, fallback) {
  return dayKey(isoString, resolveTimeZone(timeZone, fallback));
}

/**
 * Day key for EVENT PLACEMENT: the viewer's calendar day of an event value
 * (all-day values stay absolute). Every display question of the form "is
 * this the same day" compares these keys, with each other or with toDateKey
 * of a local Date, so a month cell, a week column, the day view, a date
 * group, and a composite's folded parts cannot disagree.
 */
export function eventDayKey(isoString) {
  return dayKey(isoString, viewerTimeZone());
}

/**
 * The time label of one row in a per-day schedule: a row of the day view, or
 * a part of a composite in the detail view. One owner, so the two cannot
 * drift apart.
 *
 * An all-day event shows `allDayLabel`. A timed event that ends on the day it
 * starts shows its range ("3:00 – 5:00 PM"). One that runs into another day
 * shows only its start: passing that end would make formatRange inject
 * numeric M/D/YYYY dates to tell the two days apart, which clashes with the
 * widget's house style and overflows a narrow column. "The same day" is the
 * viewer's day, by the shared day key.
 *
 * @param {object} event `{ start, end, allDay, _sourceTimeZone }`
 * @param {object} [opts] `{ sourceZoneFallback, locale, allDayLabel }`
 * @returns {string}
 */
export function formatScheduleTime(event, opts = {}) {
  const { sourceZoneFallback, locale, allDayLabel = "All Day" } = opts;
  if (event.allDay) return allDayLabel;
  const startDay = eventDayKey(event.start);
  const oneDay = startDay !== "" && startDay === eventDayKey(event.end);
  return formatEventWhen(
    { ...event, end: oneDay ? event.end : undefined },
    { sourceZoneFallback, locale, dateStyle: "time" },
  );
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

/**
 * Format a Date as YYYY-MM-DD using its LOCAL calendar fields.
 *
 * Not `toISOString().slice(0, 10)`: that reads the UTC day, which differs from
 * the local day for most of the clock in any non-UTC zone. A month cell built
 * from `new Date(year, month, d)` is local midnight, so in UTC+14 the UTC day
 * is already the previous date and the viewer would land on the wrong day.
 */
export function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Parse a YYYY-MM-DD key back into a Date at LOCAL midnight.
 *
 * The inverse of toDateKey, and the reason both exist. `new Date("2026-04-04")`
 * parses the date-only ISO form as UTC midnight, so in America/Chicago it
 * yields 19:00 on April 3. Every consumer of a day key compares it with local
 * getters (isSameDay), so the key has to come back as the same local day it
 * went out as.
 */
export function parseDateKey(key) {
  const [year, month, day] = String(key).split("-").map(Number);
  return new Date(year, month - 1, day);
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
