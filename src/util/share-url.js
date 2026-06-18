/**
 * Build a shareable URL from a base URL and a share target.
 *
 * The base is normalized to origin + pathname (any existing query/hash is
 * dropped, trailing slash trimmed) so a messy current-page-URL fallback can't
 * produce a broken link. Then a suffix is appended per kind:
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
  try {
    const url = new URL(base);
    return `${url.origin}${url.pathname}`.replace(/\/$/, "");
  } catch {
    // Not an absolute URL — best-effort: strip query/hash + trailing slash.
    return base.split(/[?#]/)[0].replace(/\/$/, "");
  }
}
