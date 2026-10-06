import { EVENT_PATH_RE } from "./util/event-path.js";

const VALID_VIEWS = ["month", "week", "day", "grid", "list"];

function storageKey(config) {
  const prefix = config?.storageKeyPrefix || "already";
  return `${prefix}-view`;
}

/** Parse the current URL hash or path into a view state object. */
export function parseHash() {
  // Check path for /event/{id} (allows server-side routing). EVENT_PATH_RE is
  // shared with share-url.js's collapse so parse + collapse stay inverses.
  const pathMatch = window.location.pathname.match(EVENT_PATH_RE);
  if (pathMatch) {
    return { view: "detail", eventId: decodeURIComponent(pathMatch[1]) };
  }

  const hash = window.location.hash.slice(1); // remove #
  if (!hash) return null;

  // #event/abc123
  if (hash.startsWith("event/")) {
    return { view: "detail", eventId: hash.slice(6) };
  }

  // #day/2026-04-04
  if (hash.startsWith("day/")) {
    return { view: "day", date: hash.slice(4) };
  }

  // #month, #week, #grid, #list, #day
  if (VALID_VIEWS.includes(hash)) {
    return { view: hash };
  }

  return null;
}

/** Determine the initial view from config, URL, or localStorage. */
export function getInitialView(defaultView, enabledViews, config) {
  // Priority: initialEvent > hash/path > localStorage > config default
  if (config?.initialEvent) {
    return { view: "detail", eventId: config.initialEvent };
  }

  const fromHash = parseHash();
  if (fromHash) return fromHash;

  const key = storageKey(config);
  const saved = localStorage.getItem(key);
  if (saved && enabledViews.includes(saved)) {
    return { view: saved };
  }

  return { view: defaultView || "month" };
}

/** Navigate to a view by setting the URL hash and saving to localStorage. */
export function setView(view, config) {
  window.location.hash = view;
  const key = storageKey(config);
  localStorage.setItem(key, view);
}

/**
 * Navigate to the day view for a specific date.
 *
 * `dateStr` must be YYYY-MM-DD built from local calendar fields (see
 * toDateKey), matching the `#day/2026-04-04` shape parseHash reads back.
 * Persists "day" the way setView does, so a reload returns to the day view.
 */
export function setDayView(dateStr, config) {
  window.location.hash = `day/${dateStr}`;
  const key = storageKey(config);
  localStorage.setItem(key, "day");
}

/**
 * The href that opens an entry's detail view: the page's URL with the
 * fragment `#event/<id>`, the one writer of the event route that parseHash
 * reads. A part with no id of its own (or an empty one) links to its
 * parent, where it is shown. An entry with neither has no route, so this
 * returns null and the caller renders nothing activatable in place of a
 * link to nowhere. The id goes into the fragment as it is; the URL parser
 * percent-encodes the few characters a fragment cannot carry (a space, a
 * quote, angle brackets, non-ASCII), exactly as assigning location.hash
 * did before, and parseHash reads the hash as the browser holds it, so a
 * link and a click land on the same route.
 */
export function eventHref(entry) {
  const id = entry?.id || entry?.parentId;
  if (!id) return null;
  // Absolute, not `#event/<id>`: a relative fragment resolves against the
  // document's base URL, so on a host page with <base href> a middle click
  // or a new tab would open the wrong page. The page's own URL with the
  // fragment is what every browser gesture should open.
  return new URL(`#event/${id}`, window.location.href).href;
}

/** Register a callback for hash change events. Returns an unsubscribe function. */
export function onHashChange(callback) {
  const handler = () => {
    const parsed = parseHash();
    if (parsed) callback(parsed);
  };
  window.addEventListener("hashchange", handler);
  return () => window.removeEventListener("hashchange", handler);
}
