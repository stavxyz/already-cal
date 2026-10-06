import { DATE_ONLY_RE, dayKeyInZone, startOrder } from "./util/dates.js";

/**
 * Composite events: an entry flagged `composite` is displayed as one event
 * together with the entries that start inside its hours. The relation is
 * computed here, from the flat list, each time data loads. Nothing in this
 * module touches the DOM, and nothing in it changes an entry: a composed
 * parent and its parts are copies.
 *
 * WHICH entries form a composite never depends on the viewer's zone, so two
 * viewers always see the same composites. Only the order the parts are listed
 * in is a display matter, and that comes from startOrder in util/dates.js.
 */

const NO_PARTS = Object.freeze([]);

function isDateOnly(value) {
  return typeof value === "string" && DATE_ONLY_RE.test(value);
}

const sourceOf = (entry) => entry._sourceKey ?? null;

/**
 * A start as a zone-free number, for the membership tie-break only. A
 * date-only value counts as its UTC midnight. Membership must come out the
 * same for every viewer, so nothing that decides it may use startOrder.
 */
const startInstant = (entry) => new Date(entry.start).getTime();

/**
 * A parent's half-open window, or null when it has none. A missing,
 * malformed, or backwards end takes no parts. An all-day window is a pair of
 * dates, with the end exclusive as Google Calendar reports it. A timed window
 * is a pair of instants.
 */
function windowOf(parent) {
  if (isDateOnly(parent.start)) {
    if (!isDateOnly(parent.end) || parent.end <= parent.start) return null;
    return {
      allDay: true,
      from: parent.start,
      to: parent.end,
      length: new Date(parent.end).getTime() - new Date(parent.start).getTime(),
    };
  }
  const from = new Date(parent.start).getTime();
  const to = new Date(parent.end).getTime();
  if (Number.isNaN(from) || Number.isNaN(to) || to <= from) return null;
  return { allDay: false, from, to, length: to - from };
}

/** Where an entry starts, worked out once per entry. */
function positionOf(entry) {
  if (isDateOnly(entry.start)) return { date: entry.start, at: Number.NaN };
  return { date: null, at: new Date(entry.start).getTime() };
}

/**
 * The calendar date of a timed entry in its OWN zone: `_sourceTimeZone` when
 * present, the calendar's zone otherwise. Never the viewer's zone, so two
 * viewers in different zones always see the same composites. The key has the
 * `YYYY-MM-DD` form of an all-day parent's dates, so the two compare as
 * strings.
 */
function dateInOwnZone(entry, calendarZone) {
  return dayKeyInZone(entry.start, entry._sourceTimeZone, calendarZone);
}

function startsInside(entry, position, win, calendarZone) {
  if (position.date !== null) {
    // An all-day entry is never inside a timed window.
    return win.allDay && position.date >= win.from && position.date < win.to;
  }
  if (Number.isNaN(position.at)) return false;
  if (!win.allDay) return position.at >= win.from && position.at < win.to;
  position.ownDate ??= dateInOwnZone(entry, calendarZone);
  return position.ownDate >= win.from && position.ownDate < win.to;
}

/** Whether candidate `a` beats candidate `b` for one part. */
function isCloser(a, b) {
  if (a.own !== b.own) return a.own;
  if (a.parent.win.length !== b.parent.win.length) {
    return a.parent.win.length < b.parent.win.length;
  }
  if (a.parent.start !== b.parent.start) return a.parent.start > b.parent.start;
  return a.parent.index < b.parent.index;
}

/** Visibility step: a hidden entry takes no part in composition. */
export function selectVisible(events) {
  return events.filter((e) => !e.hidden);
}

/**
 * Grouping step. Returns the top-level list: each parent that took parts,
 * with them attached, and every other visible entry, in the original order.
 * An entry that is not composed comes back as the same object.
 */
export function groupParts(visible, { timeZone } = {}) {
  const parents = [];
  for (const [index, entry] of visible.entries()) {
    if (entry.composite !== true) continue;
    const win = windowOf(entry);
    if (!win) continue;
    parents.push({
      entry,
      index,
      win,
      start: startInstant(entry),
      source: sourceOf(entry),
      taken: [],
    });
  }
  if (parents.length === 0) return visible;

  const partIndexes = new Set();
  for (const [index, entry] of visible.entries()) {
    // A flagged entry is never a part, and a standalone entry has opted out.
    if (entry.composite === true || entry.standalone === true) continue;
    const position = positionOf(entry);
    const source = sourceOf(entry);
    let best = null;
    for (const parent of parents) {
      const own = parent.source === source;
      if (!own && entry.partOf !== true) continue;
      if (!startsInside(entry, position, parent.win, timeZone)) continue;
      const candidate = { parent, own };
      if (best === null || isCloser(candidate, best)) best = candidate;
    }
    if (!best) continue;
    best.parent.taken.push({ entry, index });
    partIndexes.add(index);
  }

  const composed = new Map();
  for (const parent of parents) {
    if (parent.taken.length === 0) continue;
    parent.taken.sort(
      (a, b) => startOrder(a.entry) - startOrder(b.entry) || a.index - b.index,
    );
    composed.set(parent.index, {
      ...parent.entry,
      parts: parent.taken.map((t) => ({
        ...t.entry,
        parentId: parent.entry.id,
      })),
    });
  }

  const topLevel = [];
  for (const [index, entry] of visible.entries()) {
    if (partIndexes.has(index)) continue;
    topLevel.push(composed.get(index) ?? entry);
  }
  return topLevel;
}

/**
 * A composed parent's parts, or an empty list. Only what composition built
 * counts: a host's data may carry its own field named `parts`, and that is
 * not a composite.
 */
export function partsOf(event) {
  const parts = event?.parts;
  if (!Array.isArray(parts) || parts.length === 0) return NO_PARTS;
  return parts.every((p) => p && p.parentId === event.id) ? parts : NO_PARTS;
}

/**
 * Compose a flat list of enriched events. `events` in the result is the
 * top-level list. `lookup(id)` resolves any entry's id to its place in that
 * result: `{ event, part }`, where `part` is null unless the id names a part,
 * in which case it is that part object and `event` is its composed parent. A
 * hidden entry resolves to itself, so a direct link to it still works.
 */
export function composeEvents(events, options = {}) {
  const all = Array.isArray(events) ? events : [];
  const topLevel = groupParts(selectVisible(all), options);

  const index = new Map();
  const remember = (id, value) => {
    if (id != null && !index.has(id)) index.set(id, value);
  };
  for (const event of topLevel) {
    remember(event.id, { event, part: null });
    for (const part of partsOf(event)) {
      remember(part.id, { event, part });
    }
  }
  for (const entry of all) {
    if (entry.hidden) remember(entry.id, { event: entry, part: null });
  }

  return { events: topLevel, lookup: (id) => index.get(id) ?? null };
}
