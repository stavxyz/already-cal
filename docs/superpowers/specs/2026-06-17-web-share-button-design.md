---
type: spec
issue: 49
status: design
validated:
  sha: 9284f2a2de955eb6f7ab76cfaa1140b2d93d82b4
  date: 2026-06-18T01:15:18Z
  reviewers: [fact-check, solid-hygiene]
  findings:
    critical: 0
    important: 0
    medium: 1
    low: 2
    nitpick: 0
  net_negative_remaining: 0
---

# Web Share button — design

Implements #49. Adds a share affordance to the widget so a viewer can share
**a specific event** or **the whole calendar** via the native share sheet
(`navigator.share`), falling back to copy-to-clipboard where unsupported. A new
`shareUrl` config supplies the canonical host-page URL to share; the widget
appends the right suffix per target.

## Goals

- Share a specific event from its detail view → a URL that reopens that event.
- Share the calendar from the main view → a URL that opens the calendar in the
  current **view type** (month/week/day/grid/list).
- Use `navigator.share` where available; degrade to clipboard copy with inline
  "Copied!" feedback; never throw or leave a dead button.
- **Forward-compatible:** the URL scheme + helpers are shaped today to carry a
  navigated **date** later, so the future "share the exact month/week window"
  feature is additive, not a rewrite (see Deferred).

## Non-goals (deferred)

- Reproducing the navigated **date/range/window** for month/week/grid/list. Today
  those reset to the current date on load and the navigated date is not captured
  in the URL or any top-level state. Full date fidelity needs deep-linkable
  view+date state (lift the navigated date into top-level state, encode
  `view+date` in the URL, restore on load). This design leaves a clean seam for
  it but does not build it. Tracked as a follow-up.
- Runtime updates of `shareUrl` via the cross-origin `setConfig`/postMessage path
  (the message handler only whitelists presentational keys). `shareUrl` is an
  init-time config only.

## Architecture

Two pure, standalone helpers do all the work; the widget injects a live
state accessor where the buttons live.

```
src/util/share-url.js     buildShareUrl(base, target) -> string   (pure)
src/util/share.js         shareOrCopy({ title, url }) -> Promise<"shared"|"copied"|"failed">
src/ui/header.js          calendar-share button (next to Subscribe)
src/views/detail.js       event-share button (top row, next to Back)
src/already-cal.js        sets config.shareBase + config.getShareState in init
```

### `buildShareUrl(base, target)` — `src/util/share-url.js`

Pure function. `target` is a tagged shape:

- `{ kind: "event", eventId }` → `<base>/event/<eventId>` (**path** form). Path
  form is used for events so a host that server-renders per-event metadata
  (unfurl/OG tags) can route on it; the widget's own router also path-matches
  `/event/<id>` (`parseHash`, `src/router.js:11`).
- `{ kind: "calendar", view, date }` → `<base>#<view>` **today**. `date` is part
  of the shape but **intentionally unused now**; when the deferred feature lands
  the same function emits `<base>#<view>/<date>` (one added branch). `#<view>`
  is hash form because calendar view state is widget-only restoration (no host
  server route), matching the router's existing `#<view>` / `#day/<date>`
  parsing (`src/router.js:25-32`).

`base` normalization (so a messy `location.href` fallback can't produce a broken
URL): reduce `base` to `origin + pathname` (drop any existing `?query` and
`#fragment`), trim a trailing `/`, then append — `/event/<eventId>` (path) or
`#<view>` (fragment). `eventId` is `encodeURIComponent`'d. Unit-tested in
isolation (`test/util/share-url.test.cjs`).

### `shareOrCopy({ title, url })` — `src/util/share.js`

1. If `navigator.share` exists (secure context), `await navigator.share({ title, url })`
   → resolve `"shared"`. A user-cancel (AbortError) resolves quietly (no error,
   no copy).
2. Else, or if `navigator.share` rejects for a non-abort reason (e.g.
   Permissions-Policy `web-share` not delegated to the iframe),
   `await navigator.clipboard.writeText(url)` → resolve `"copied"`.
3. If clipboard also fails/absent → resolve `"failed"` (caller leaves the URL
   visible/selectable; no throw).

Returns the outcome so the button can render the right feedback. Pure of DOM;
the button owns the "Copied!" presentation.

> **Design note (2026-06-17):** `shareOrCopy` deliberately bundles share-attempt
> + clipboard-fallback + outcome classification — appropriately scoped for the
> single decision tree both buttons need, and pure of DOM so it stays testable.
> The boundary is a known trade-off: if a future surface needs copy *only* (no
> native sheet), split the `clipboard.writeText` into its own helper that
> `shareOrCopy` composes, rather than duplicating the write. The current shape
> already supports that refactor without rework.

### `getShareState()` — owned by `src/already-cal.js`

The widget already tracks the current view in `lastView` / `lastViewState`
(`already-cal.js:266,374,416`). It exposes a small accessor:

```js
// today:
getShareState() => { view: lastView }          // for the calendar target
// future (deferred feature): => { view: lastView, date: currentDate }
```

This accessor is the single seam: when date-lifting lands, it starts returning
`date` and nothing else changes — `buildShareUrl` already accepts it. The widget
assigns `config.getShareState` and a resolved `config.shareBase` **once during
config assembly** in `init`; `renderHeader` and `renderDetailView` read them off
`config` — the same channel that already carries the `onBack` / `onViewChange` /
`onDataLoad` callbacks. Neither renderer's positional signature changes. The
detail view already has the `event` in scope, so its event-share target needs no
accessor (it reads `config.shareBase` for the URL).

> **Design note (2026-06-17):** the share seam rides on the existing `config`
> channel (`config.shareBase`, `config.getShareState`) rather than new positional
> parameters on `renderHeader`/`renderDetailView`. This matches the established
> "widget state + callbacks ride on `config`" convention, keeps both renderer
> contracts uniform, and confines the blast radius of future share changes to
> config assembly.

### Base resolution

`config.shareBase = config.shareUrl ?? <current page URL>`, resolved **once** in
`init` and read by both buttons (so the location fallback is computed in one
place, not per click). When `shareUrl` is unset the fallback is the current
location (per #49). In an iframe embed the current location is the *embed's* URL,
not the host page — which is exactly why `shareUrl` exists; without it, shared
links point at the embed. The builder normalizes whatever base it's given.

## Config

New key in `DEFAULTS` (`src/already-cal.js`), mirroring `subscribeUrl`:

```js
shareUrl: null,   // string | null — canonical host-page URL to share
```

- Documented in `docs/configuration.md` (camelCase, `string | null`, default
  `null`, with the iframe `allow="web-share"` note below).
- Auto-init: `if (dataset.shareUrl) config.shareUrl = dataset.shareUrl;` in
  `autoInit` (matching the existing `data-*` pattern).
- No validation needed (optional string flows through `{ ...DEFAULTS, ...userConfig }`).

## Components / placement

- **Event-share button** — in `renderDetailView` (`src/views/detail.js`), in the
  top row next to the Back button. Subtle icon+label "Share" button styled like
  `.already-detail-back`. Target: `{ kind:"event", eventId: event.id }`. Payload
  title: `event.title`. Preserve the existing last-focus-to-Back a11y intent
  (insert without breaking tab order).
- **Calendar-share button** — in `renderHeader` (`src/ui/header.js`), next to the
  Subscribe button, styled like `.already-header-subscribe` (icon+label).
  Target: `{ kind:"calendar", ...config.getShareState() }`. Payload title: the
  **same precedence the header itself uses** — `config.headerTitle ?? calendarData.name`
  — falling back to `document.title` then a generic label, so the shared title
  matches the displayed header.
- **Share icon** — inline SVG string (`currentColor`, 16×16, `aria-hidden="true"`),
  following the only existing icon precedent (`src/ui/header.js` subscribe icon).
  No icon module is introduced.

> **Design note (2026-06-17):** this seeds the 2nd/3rd inline-SVG icon instances
> (one share glyph reused across the two buttons). That's a deliberate YAGNI call
> at this count — but the threshold is explicit: the moment a share icon is needed
> in a **third file** (e.g. the deferred card-sharing in "Out of scope"), extract a
> tiny shared icon helper rather than copy the SVG string a fourth time.

Only render each button when there is something to share: the event button always
has `event.id`; the calendar button always has a `config.shareBase`. **Note the
header early-return:** `renderHeader` currently emits nothing when the calendar
has neither name nor description (`header.js:14-17`), which would also suppress
the calendar-share button. Since a calendar is shareable regardless of whether it
has a display title, the implementation must keep the header's action row
(subscribe + share) rendering in that case — i.e. relax the early-return so the
actions still emit when there's a share/subscribe action to show, rather than
gating share behind name/description. (If a future option needs to hide share
entirely, that's a config gate — out of scope now.)

## Data flow (event example)

1. Viewer opens an event → detail view renders the "Share" button.
2. Click → `target = { kind:"event", eventId: event.id }`;
   `url = buildShareUrl(base, target)`; `shareOrCopy({ title: event.title, url })`.
3. `navigator.share` opens the native sheet → "shared". Or clipboard copy →
   button shows inline "Copied!" for ~2s (aria-live polite announcement), then
   reverts.
4. Recipient opens the URL → host page loads the widget at `/event/<id>` →
   `parseHash` resolves it → `getInitialView` opens that event's detail
   (existing behavior; no new restore code).

Calendar flow is identical with `{ kind:"calendar", view }` and `#<view>`; the
recipient lands in that view type (existing `parseHash` `#<view>` handling).

## Error handling / graceful degradation

- `navigator.share` absent (most desktop) or blocked by Permissions-Policy
  (cross-origin iframe without `allow="web-share"`) → clipboard fallback.
- `navigator.clipboard.writeText` absent/blocked (insecure context, or a
  cross-origin iframe without `clipboard-write` delegated) → `"failed"`: the
  button does not falsely claim success; no throw. (A last-resort selectable URL
  is a possible enhancement, not required.)
- **Docs (`docs/configuration.md`):** iframe embedders should set
  `allow="web-share"` for the native sheet, and — since the copy fallback uses
  the async Clipboard API — `clipboard-write` too for the fallback to work
  cross-origin, i.e. `allow="web-share; clipboard-write"`. Without either, the
  widget degrades quietly to `"failed"` rather than erroring.
- User dismisses the native sheet (AbortError) → treated as success-ish: no
  error, no fallback copy, button reverts.

## Testing

`node:test` + jsdom (jsdom implements neither `navigator.share` nor
`navigator.clipboard`, so both are stubbed on the global `navigator`).

- `test/util/share-url.test.cjs` — `buildShareUrl`: event path form +
  `encodeURIComponent`; calendar hash form per view; trailing-slash + existing-
  fragment normalization; (a placeholder asserting `date` is *ignored today* so
  the forward-compat contract is pinned).
- `test/util/share.test.cjs` — `shareOrCopy`: share-present → calls share;
  share-absent → clipboard; share-rejects-non-abort → clipboard; AbortError →
  no copy; clipboard-absent → `"failed"`.
- `test/views/detail.test.cjs` — event-share button renders, builds the right
  URL, calls the share helper; keeps Back focusable.
- `test/ui/header.test.cjs` — calendar-share button renders next to Subscribe,
  reads `getShareState().view`, builds `#<view>`.

Coverage thresholds are CI-enforced (functions 72 / lines 86) — the extracted
pure helpers carry most of the new coverage.

## Deferred: the date-window extension (how it stays additive)

When "share the exact month/week window" is built later:

1. **State:** lift the navigated date (today trapped in each view's prev/next
   closure, `src/views/month.js`/`week.js`) into top-level state in
   `already-cal.js`; `getShareState()` returns `{ view, date }`.
2. **Encode:** `buildShareUrl` calendar branch emits `<base>#<view>/<date>` when
   `date` is present — one added line; call sites unchanged.
3. **Decode:** extend `parseHash` to read a date for `month`/`week`/`grid`/`list`
   exactly as it already does for `#day/<date>` (`src/router.js:25-32`), and
   restore it in the render dispatch.

No part of *this* design is thrown away — `buildShareUrl`, `shareOrCopy`, the
buttons, and `getShareState` all carry forward; the future work only fills in
`date` and the symmetric encode/decode.

## Out of scope

- Sharing from event **cards** in the list/grid (only the detail view + the
  calendar header get buttons).
- A general toast/notification system (inline "Copied!" only).
- `shareUrl` runtime updates over postMessage.
- Per-event unfurl/metadata rendering on the host (host concern, not the widget).
