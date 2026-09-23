# Core (server-side entry)

`already-cal` ships a second, smaller bundle at `dist/already-cal-core.mjs`
for consumers that need the widget's event-enrichment pipeline without the
widget itself: a server generating an unfurl card, a Worker building an API
response, a build script pre-rendering event data. It never touches `document`
or `window`, so it runs anywhere JavaScript runs, including Cloudflare
Workers, Node, Deno, and other non-browser runtimes.

The widget's own entry (`src/already-cal.js`, built to `dist/already-cal.js`)
still depends on the DOM for rendering. Only `src/core.js` is DOM-free, and
only its three exports are public API.

## Installing

```bash
npm install already-cal
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

- `item` — a raw event object as returned by the Google Calendar API
  (`events.list`/`events.get`).
- `config` — optional. Accepts the same `imageExtensions` and `knownPlatforms`
  keys as the widget's config; pass `{}` to use the defaults.
- Returns the enriched event object.

### `plainTextDescription(event)`

Returns an enriched event's description as plain text: no Markdown syntax,
no HTML tags, no directives, and no URLs that enrichment already consumed
into `image`/`images`/`links`/`attachments`. Intended for places that cannot
render markup, such as link-preview or unfurl card text.

- `event` — an event object as returned by `enrichGoogleEvent`, or any object
  with `description` and (optionally) `descriptionFormat` fields.
- Returns a string. Whitespace is collapsed to single spaces and trimmed.

### `CONTENT_DEFAULTS`

The frozen default config (`imageExtensions`, `knownPlatforms`) that
`enrichGoogleEvent` uses when `config` omits those keys. Shared with the
widget, so an empty or partial config means the same thing in both places.

## No-DOM guarantee

`dist/already-cal-core.mjs` is built with esbuild's `platform: "neutral"`
target and contains no reference to `document`, `window`, or `DOMParser`.
`test/core.test.cjs` imports the built bundle in a process with no DOM
globals and asserts against it directly, so a DOM dependency creeping into
the core entry's dependency graph fails the test suite.

## Semver

The three exports above are public API under semver: a minor release may add
exports but will not remove or change the signature of these three, and a
patch release changes only their internals. Everything else in `src/data.js`
and elsewhere in `src/` is internal and may change without notice, even
between patch releases.

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
