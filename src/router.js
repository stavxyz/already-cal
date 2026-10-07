import { EVENT_PATH_RE } from "./util/event-path.js";

const VALID_VIEWS = ["month", "week", "day", "grid", "list"];

function storageKey(config) {
  const prefix = config?.storageKeyPrefix || "already";
  return `${prefix}-view`;
}

/**
 * Parse the current URL hash or path into a view state object. The hash is
 * read first: on a page whose path is an event deep link (/event/<id>,
 * served by a host's routing and produced by the Share button), every route
 * the widget writes afterwards is a hash and the path never changes, so a
 * path read first kept such a page on its event for good. Back and the
 * links to other events changed the hash and the view stayed.
 */
export function parseHash() {
  const hash = window.location.hash.slice(1); // remove #

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

  // No route in the hash: the path may carry an event (server-side routing).
  // EVENT_PATH_RE is shared with share-url.js's collapse so parse + collapse
  // stay inverses.
  const pathMatch = window.location.pathname.match(EVENT_PATH_RE);
  if (pathMatch) {
    return { view: "detail", eventId: decodeURIComponent(pathMatch[1]) };
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
 * The href that opens an entry's detail view: the fragment `#event/<id>`,
 * or the page's URL with that fragment when the document has a base
 * element. It is the one writer of the event route that parseHash
 * reads. A part with no id of its own (or an empty one) links to its
 * parent, where it is shown. An entry with neither has no route, so this
 * returns null and the caller renders nothing activatable in place of a
 * link to nowhere. The id goes into the fragment as it is; the URL parser
 * percent-encodes the few characters a fragment cannot carry (a space, a
 * quote, angle brackets, non-ASCII), exactly as assigning location.hash
 * does, and parseHash reads the hash as the browser holds it, so a
 * link and a click land on the same route.
 */
export function eventHref(entry) {
  const id = entry?.id || entry?.parentId;
  if (!id) return null;
  const fragment = `#event/${id}`;
  // A relative fragment is the right href on almost every page: the browser
  // resolves it against the page's current URL each time it is used, so it
  // cannot go stale when a host changes the path or the query. A <base href>
  // breaks that, because the fragment then resolves against the base and a
  // middle click or a new tab opens another page. Only there is the href
  // made absolute, from the page's URL as it is at render time.
  if (document.querySelector("base[href]") === null) return fragment;
  return new URL(fragment, window.location.href).href;
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
