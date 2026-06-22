/**
 * Canonical deep-link path tail: `/event/<id>` with an optional trailing slash,
 * the id captured in group 1.
 *
 * Two places must agree on this shape — the router (parses an incoming
 * `/event/<id>` URL into detail state) and the share-URL builder (strips a
 * stale `/event/<id>` off a base before appending a fresh one). Sharing one
 * definition keeps the parse and the collapse exact inverses; two independent
 * copies drifting apart is precisely what doubled the share path before v0.5.3.
 *
 * No `g`/`y` flag, so the same object is safe to reuse across `.match()` and
 * `.replace()` without `lastIndex` state leaking between calls.
 */
export const EVENT_PATH_RE = /\/event\/([^/]+)\/?$/;
