import { EVENT_PATH_RE } from "./event-path.js";

/**
 * Build a shareable URL from a base URL and a share target.
 *
 * The base is normalized to origin + pathname (any existing query/hash is
 * dropped, trailing slash trimmed, and a trailing `/event/<id>` deep-link
 * segment stripped — collapsing the base back to whatever the deep-link hung
 * off of) so a messy current-page-URL or already-deep-linked fallback can't
 * produce a broken/doubled link. Then a suffix is appended per kind:
 *
 *   { kind: "event", eventId }   ->  `<base>/event/<eventId>`   (path form)
 *   { kind: "calendar", view }   ->  `<base>#<view>`            (hash form)
 *
 * Path form is used for events so a host that server-renders per-event
 * metadata can route on the path; the widget router also path-matches
 * `/event/<id>`. Calendar view state is widget-only restoration, so it rides
 * the hash, matching the router's existing `#<view>` / `#day/<date>` parsing.
 *
 * `target.date` is accepted for forward-compatibility (a future "share the
 * exact month/week window" feature) but is intentionally ignored today.
 */
export function buildShareUrl(base, target) {
  const normalized = normalizeBase(base);
  if (target.kind === "event") {
    return `${normalized}/event/${encodeURIComponent(target.eventId)}`;
  }
  return target.view ? `${normalized}#${target.view}` : normalized;
}

function normalizeBase(base) {
  let result;
  try {
    const url = new URL(base);
    result = `${url.origin}${url.pathname}`;
  } catch {
    // Not an absolute URL — best-effort: strip query/hash.
    result = base.split(/[?#]/)[0];
  }
  // Trim trailing slash(es), then strip a trailing `/event/<id>` (the same
  // EVENT_PATH_RE the router parses, so collapse + parse stay inverses). The
  // base is often a canonical *page* URL (or a window.location fallback) that
  // is itself an event deep-link; without this, appending the event suffix in
  // buildShareUrl would double it (`…/event/<id>/event/<id>`), a path the
  // router can't resolve.
  return result.replace(/\/+$/, "").replace(EVENT_PATH_RE, "");
}
