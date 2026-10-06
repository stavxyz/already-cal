import { DATE_ONLY_RE, dayKeyInZone, startOrder } from "./util/dates.js";
import { tagLabel } from "./util/tags.js";

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

// An ISO date-time with no UTC offset, such as "2026-06-15T19:00:00".
const FLOATING_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;

const isFloating = (value) =>
  typeof value === "string" && FLOATING_RE.test(value);

// An ISO date-time that states its UTC offset, such as
// "2026-06-15T19:00:00-05:00" or "2026-06-15T19:00:00Z".
const OFFSET_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/;

/**
 * A start or end as a number that is the same for every viewer, or NaN.
 * Every comparison that decides membership goes through here, and it reads
 * three forms only. A date-only value is its UTC midnight. An ISO value with
 * a UTC offset is its instant. An ISO value with NO offset is a wall-clock
 * time, read as that clock reading in UTC. Anything else `new Date` could
 * parse would be read in the viewer's zone, so it is NaN: the entry takes no
 * part in composition and is shown on its own.
 */
function zoneFreeTime(value) {
  if (isDateOnly(value)) return new Date(value).getTime();
  if (isFloating(value)) return new Date(`${value}Z`).getTime();
  if (typeof value === "string" && OFFSET_RE.test(value)) {
    return new Date(value).getTime();
  }
  return Number.NaN;
}

const sourceOf = (entry) => entry._sourceKey ?? null;

/** A start as a zone-free number, for the membership tie-break only. */
const startInstant = (entry) => zoneFreeTime(entry.start);

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
      length: zoneFreeTime(parent.end) - zoneFreeTime(parent.start),
    };
  }
  const from = zoneFreeTime(parent.start);
  const to = zoneFreeTime(parent.end);
  if (Number.isNaN(from) || Number.isNaN(to) || to <= from) return null;
  return { allDay: false, from, to, length: to - from };
}

/** Where an entry starts, worked out once per entry. */
function positionOf(entry) {
  if (isDateOnly(entry.start)) return { date: entry.start, at: Number.NaN };
  return { date: null, at: zoneFreeTime(entry.start) };
}

/**
 * The calendar date of a timed entry in its OWN zone: `_sourceTimeZone` when
 * present, the calendar's zone otherwise. Never the viewer's zone, so two
 * viewers in different zones always see the same composites. The key has the
 * `YYYY-MM-DD` form of an all-day parent's dates, so the two compare as
 * strings.
 */
function dateInOwnZone(entry, calendarZone) {
  // A wall-clock value already names its date. Formatting it in a zone
  // would first read it in the viewer's.
  if (isFloating(entry.start)) return entry.start.slice(0, 10);
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
    // Parts point at their parent by id, so a parent needs one.
    if (!entry.composite || entry.id == null) continue;
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
    if (entry.composite || entry.standalone) continue;
    const position = positionOf(entry);
    const source = sourceOf(entry);
    let best = null;
    for (const parent of parents) {
      const own = parent.source === source;
      if (!own && !entry.partOf) continue;
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
 * not a composite. An event with no id is never a composite: its parts could
 * not point at it.
 */
export function partsOf(event) {
  const parts = event?.parts;
  if (event?.id == null) return NO_PARTS;
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

function titleKey(title) {
  return String(title ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/**
 * Whether a part is a second listing of its parent: the same occasion entered
 * twice, recognised by a title that is the same once case, punctuation,
 * accents, and emoji are set aside. It only decides how the part is labelled.
 * Membership never depends on it. Stateless, so it answers the same for a
 * copy of a part as for the original.
 */
export function isSecondListing(part, parent) {
  const key = titleKey(part?.title);
  return key !== "" && key === titleKey(parent?.title);
}

function ownImages(event) {
  if (Array.isArray(event.images) && event.images.length > 0) {
    return event.images;
  }
  return event.image ? [event.image] : [];
}

/**
 * The images a composite shows as one thing: the parent's own, then each
 * part's, without exact duplicates. An event's own `images` field is never
 * rewritten. Code that renders an event as a whole reads through these
 * accessors, and only the detail view's per-entry body reads the raw fields.
 */
export function compositeImages(event) {
  const parts = partsOf(event);
  const own = ownImages(event);
  if (parts.length === 0) return own;
  const seen = new Set();
  const out = [];
  for (const url of [...own, ...parts.flatMap(ownImages)]) {
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

/**
 * The image a composite leads with: the parent's own `image` when it has
 * one, otherwise the first of the combined images. An event without parts
 * leads with its own `image` or with nothing, exactly as before composites.
 */
export function compositeLeadImage(event) {
  const own = event.image || null;
  if (own || partsOf(event).length === 0) return own;
  return compositeImages(event)[0] || null;
}

/** A composite's tags: the parent's own, then its parts' tags with new labels. */
export function compositeTags(event) {
  const parts = partsOf(event);
  const own = event.tags || [];
  if (parts.length === 0) return own;
  const seen = new Set(own.map(tagLabel));
  const out = [...own];
  for (const part of parts) {
    for (const tag of part.tags || []) {
      const label = tagLabel(tag);
      if (seen.has(label)) continue;
      seen.add(label);
      out.push(tag);
    }
  }
  return out;
}
