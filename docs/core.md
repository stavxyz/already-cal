# Core (server-side entry)

`already-cal` ships a second, smaller bundle at `dist/already-cal-core.mjs`
for consumers that need the widget's event-enrichment pipeline without the
widget itself: a server generating an unfurl card, a Worker building an API
response, a build script pre-rendering event data. It never touches `document`
or `window`, so it runs anywhere JavaScript runs, including Cloudflare
Workers, Node, Deno, and other non-browser runtimes.

The widget's own entry (`src/already-cal.js`, built to `dist/already-cal.js`)
still depends on the DOM for rendering. Only `src/core.js` is DOM-free, and
only its three exports (`enrichGoogleEvent`, `plainTextDescription`, and
`CONTENT_DEFAULTS`) are public API for the core bundle. The widget's own
entry has its own public exports (`init`, `setConfig`, `DEFAULTS`, and
others); see the main [README](../README.md) for those.

## Installing

`already-cal` is not published to npm. Install it directly from a GitHub
release instead, using one of the following.

**Download the built file from a release**, then import it by its local
path:

```bash
curl -LO https://github.com/stavxyz/already-cal/releases/download/v0.11.0/already-cal-core.mjs
```

```js
import {
  enrichGoogleEvent,
  plainTextDescription,
  CONTENT_DEFAULTS,
} from "./already-cal-core.mjs";
```

**Or install straight from the git tag** with npm's `github:` specifier:

```bash
npm install github:stavxyz/already-cal#v0.11.0
```

`package.json` does not declare an `exports` map, so import the built file
by its path rather than a subpath such as `already-cal/core`:

```js
import {
  enrichGoogleEvent,
  plainTextDescription,
  CONTENT_DEFAULTS,
} from "already-cal/dist/already-cal-core.mjs";
```

## Exports

### `enrichGoogleEvent(item, config)`

Turns one raw Google Calendar API event into the event object the widget
renders: extracts `#already:` directives, images, links, attachments, and
tags from the description, and sets the `featured`/`hidden` flags. This is
the same function the widget itself calls, so a server-side consumer and the
widget interpret event content identically. See
[Event Schema](event-schema.md) for the full shape of the returned event and
[Directives Reference](directives.md) for the `#already:` syntax.

- `item`: a raw event object as returned by the Google Calendar API
  (`events.list`/`events.get`).
- `config`: optional. Accepts the same `imageExtensions` and `knownPlatforms`
  keys as the widget's config; pass `{}` to use the defaults. An omitted key
  falls back to `CONTENT_DEFAULTS`' value for that key.
- Returns the enriched event object.

### `plainTextDescription(event)`

Returns an enriched event's description as plain text: markup tags are
stripped, Markdown syntax is removed only when the description is detected
as Markdown (via `detectFormat`, the same auto-detection the widget uses to
decide how to render a description), and directives and URLs that enrichment
already consumed into `image`/`images`/`links`/`attachments` are gone.
Intended for places that cannot render markup, such as link-preview or
unfurl card text.

Only the first 500 characters of a Markdown description are parsed as
Markdown. The cut falls at the last line break before that point if it is
past character 250, or else at the last line break or space, whichever is
later. The rest is kept, with tags stripped and entities decoded, but its
Markdown syntax (such as `**` or `[text](url)`) stays in the text. The
Markdown parser is super-linear on some inputs, so this bounds the time a
hostile description can cost a server.

The return value is **unescaped plain text**, not HTML-safe text: decoded
HTML entities can leave literal `<` or `&` characters in the string (for
example, a description containing `&amp;lt;3` decodes to `<3`). A caller
embedding the result in an HTML document or an HTML attribute must escape it
itself.

- `event`: an event object as returned by `enrichGoogleEvent`, or any object
  with `description` and (optionally) `descriptionFormat` fields. A
  non-string `description` (missing, `null`, or any other type) returns
  `""` rather than throwing.
- Returns a string. Whitespace is collapsed to single spaces and trimmed.

### `CONTENT_DEFAULTS`

The frozen default config (`imageExtensions`, `knownPlatforms`) that
`enrichGoogleEvent` uses when `config` omits those keys. Shared with the
widget, so an empty or partial config means the same thing in both places.
Shallow-frozen only: `imageExtensions` is itself a frozen array, but
`knownPlatforms` is not: do not mutate `CONTENT_DEFAULTS.knownPlatforms` in
place; copy it first if you need to extend it.

## No-DOM guarantee

`dist/already-cal-core.mjs` is built with esbuild's `platform: "neutral"`
target and is meant to contain no reference to `document`, `window`, or
`DOMParser`. Two tests in `test/core.test.cjs` guard this: one imports the
built bundle and calls its exports in a process with no DOM globals defined
(proving the code paths actually exercised don't need one), and a second
statically greps the bundle text for `document`/`window`/`DOMParser` used as
a property access or call (e.g. `document.createElement`), which would also
catch a DOM reference on a code path the first test doesn't happen to reach.

## Semver

The three exports above are public API under semver: a minor release may add
exports but will not remove or change the signature or behavior contracts of
these three, and a patch release changes only their internals. Within that
guarantee, `plainTextDescription`'s exact whitespace and entity output may
still change between minor versions: only its contract (readable plain
text) is stable, not its byte-for-byte output. Everything else in
`src/data.js` and elsewhere in `src/` is internal and may change without
notice, even between patch releases.

## Example

```js
import {
  enrichGoogleEvent,
  plainTextDescription,
} from "already-cal/dist/already-cal-core.mjs";

const raw = await fetchFromGoogleCalendarApi(eventId);
const event = enrichGoogleEvent(raw, {});

console.log(event.image); // first image URL, or null
console.log(plainTextDescription(event)); // "Doors at 7, music at 8."
```
