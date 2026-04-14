# Hygiene & Documentation Update — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full hygiene and documentation pass — accurate docs, consistent source comments, correct project metadata, dedicated directives reference.

**Architecture:** Code hygiene first (package.json, .gitignore, build rename), then source comment normalization, then documentation updates (new directives.md, updated configuration.md, event-schema.md, README.md), then file a GitHub issue for the data-attribute gap.

**Tech Stack:** Vanilla JS, esbuild, Node.js test runner, GitHub CLI (`gh`)

**Spec:** `docs/superpowers/specs/2026-04-14-hygiene-docs-design.md`

---

### Task 1: Update .gitignore

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add .claude/ and CLAUDE.md to .gitignore**

Append two entries to the existing `.gitignore`:

```
.claude/
CLAUDE.md
```

The file currently contains:

```
node_modules/
.superpowers/
```

After the edit it should be:

```
node_modules/
.superpowers/
.claude/
CLAUDE.md
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: add .claude/ and CLAUDE.md to .gitignore"
```

---

### Task 2: Rename build.js to build.cjs

**Files:**
- Rename: `build.js` → `build.cjs`
- Modify: `package.json`

- [ ] **Step 1: Rename the file**

```bash
git mv build.js build.cjs
```

No content changes to the file — it stays CommonJS (`require()`).

- [ ] **Step 2: Update package.json scripts**

In `package.json`, change the `scripts` section from:

```json
"scripts": {
  "build": "node build.js",
  "dev": "node build.js --watch",
  "test": "node --test test/*.test.js test/views/*.test.js test/ui/*.test.js"
},
```

To:

```json
"scripts": {
  "build": "node build.cjs",
  "dev": "node build.cjs --watch",
  "test": "node --test test/*.test.js test/views/*.test.js test/ui/*.test.js"
},
```

- [ ] **Step 3: Add type: module and metadata to package.json**

Add `"type": "module"` after the `"description"` field. Add metadata fields after `"license"`. The full `package.json` should become:

```json
{
  "name": "already-cal",
  "version": "0.1.0",
  "description": "Open-source Google Calendar event display widget",
  "type": "module",
  "main": "dist/already-cal.js",
  "scripts": {
    "build": "node build.cjs",
    "dev": "node build.cjs --watch",
    "test": "node --test test/*.test.js test/views/*.test.js test/ui/*.test.js"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/stavxyz/already-cal.git"
  },
  "homepage": "https://github.com/stavxyz/already-cal",
  "bugs": {
    "url": "https://github.com/stavxyz/already-cal/issues"
  },
  "author": "stavxyz",
  "license": "AGPL-3.0-or-later",
  "keywords": [
    "google-calendar",
    "calendar",
    "widget",
    "events",
    "vanilla-js",
    "no-framework"
  ],
  "engines": {
    "node": ">=18"
  },
  "dependencies": {
    "marked": "^15.0.0"
  },
  "devDependencies": {
    "esbuild": "^0.25.0",
    "jsdom": "^29.0.2"
  }
}
```

- [ ] **Step 4: Verify build still works**

```bash
npm run build
```

Expected: `Build complete.` with no errors.

- [ ] **Step 5: Verify tests pass without the ES module warning**

```bash
npm test 2>&1 | grep -c "MODULE_TYPELESS_PACKAGE_JSON"
```

Expected: `0` (the warning is gone).

```bash
npm test 2>&1 | tail -5
```

Expected: 380 tests pass, 0 fail.

- [ ] **Step 6: Commit**

```bash
git add build.cjs package.json
git commit -m "chore: add type: module, rename build.cjs, add package metadata"
```

---

### Task 3: Source comment normalization — util modules

**Files:**
- Modify: `src/util/dates.js`
- Modify: `src/util/sanitize.js`
- Modify: `src/util/tokens.js`
- Modify: `src/util/description.js`
- Modify: `src/util/directives.js`
- Modify: `src/util/images.js`
- Modify: `src/util/links.js`
- Modify: `src/util/attachments.js`

Add a concise `/** */` JSDoc comment above each exported function. One-liner or short block — just what the function does. No `@param`/`@returns`. Keep existing inline `//` comments. Don't touch private functions.

- [ ] **Step 1: Add JSDoc comments to src/util/dates.js**

All 12 exported functions need comments. Add before each `export function`:

```js
/** Format an ISO date string as a full date (e.g. "Monday, April 14, 2026"). */
export function formatDate(isoString, timezone, locale) {

/** Format an ISO date string as a short date (e.g. "Apr 14"). */
export function formatDateShort(isoString, timezone, locale) {

/** Format an ISO date string as a time (e.g. "7:00 PM"). */
export function formatTime(isoString, timezone, locale) {

/** Format an ISO date string as full date + time (e.g. "Monday, April 14, 2026 · 7:00 PM"). */
export function formatDatetime(isoString, timezone, locale) {

/** Return the number of days in a given month (1-indexed result). */
export function getDaysInMonth(year, month) {

/** Return the column index (0-based) of the first day of a month, adjusted for week start day. */
export function getFirstDayOfMonth(year, month, weekStartDay) {

/** Check whether two Date objects fall on the same calendar day. */
export function isSameDay(d1, d2) {

/** Check whether a Date object is today. */
export function isToday(date) {

/** Check whether an ISO date string is in the past. */
export function isPast(isoString) {

/** Format a month and year as a localized string (e.g. "April 2026"). */
export function getMonthName(year, month, locale) {

/** Extract year, month (0-indexed), and day from an ISO string in a given timezone. */
export function getDatePartsInTz(isoString, timezone, locale) {

/** Return an array of 7 Date objects representing the week containing the given date. */
export function getWeekDates(date, weekStartDay) {

/** Return localized short day names (e.g. ["Sun", "Mon", ...]) starting from weekStartDay. */
export function getDayNames(locale, weekStartDay) {
```

- [ ] **Step 2: Add JSDoc comments to src/util/sanitize.js**

```js
/** Escape HTML special characters in a string. */
export function escapeHtml(str) {

/** Escape special regex characters in a string for use in new RegExp(). */
export function escapeRegex(str) {

/** Remove a URL from HTML, stripping both bare URLs and <a>-wrapped versions. */
export function stripUrl(html, url) {

/** Clean up HTML after URL extraction: collapse orphaned <br> runs and normalize whitespace. */
export function cleanupHtml(str) {
```

- [ ] **Step 3: Add JSDoc comments to src/util/tokens.js**

`normalizeUrl` at line 7 needs a comment. The `TokenSet` class at line 29 needs a class-level comment. Keep the existing `//` comment about tracking params.

```js
/** Normalize a URL: force HTTPS, strip www prefix, remove tracking parameters. */
export function normalizeUrl(url) {
```

Above the class definition:

```js
/** Deduplicated set of extraction tokens, keyed by canonical ID. */
export class TokenSet {
```

- [ ] **Step 4: Add JSDoc comments to src/util/description.js**

`detectFormat` (line 17), `sanitizeHtml` (line 24), and `renderDescription` (line 61) need comments.

```js
/** Auto-detect whether text is HTML, markdown, or plain text. */
export function detectFormat(text) {

/** Sanitize HTML by removing disallowed tags and attributes. */
export function sanitizeHtml(html, config) {

/** Render event description text as sanitized HTML based on auto-detected format. */
export function renderDescription(text, config) {
```

- [ ] **Step 5: Add JSDoc comments to src/util/directives.js**

`extractDirectives` at line 107 needs a comment.

```js
/** Extract #already: directives from description text, returning tokens and cleaned description. */
export function extractDirectives(description) {
```

- [ ] **Step 6: Update JSDoc comments in src/util/images.js**

Lines 30 and 44 already have `/** */` comments — verify they're accurate and consistent in style. Add comments to `extractImageTokens` (line 102) and `extractImage` (line 160).

The existing comment at line 44 (`normalizeImageUrl`) is multi-line and good — keep it.
The existing comment at line 30 (`getPathExtension`) is good — keep it.

Add:

```js
/** Extract image tokens from description text (by extension, Drive URLs, and Dropbox URLs). */
export function extractImageTokens(description, config) {

/** Extract images from description, returning image URLs and cleaned description. */
export function extractImage(description, config) {
```

- [ ] **Step 7: Update JSDoc comment in src/util/links.js**

Line 8 already has a `/** */` on `handleAt` — keep it. Add comments to `extractLinks` (line 231) and `extractLinkTokens` (line 238).

```js
/** Extract platform links from description, returning link objects and cleaned description. */
export function extractLinks(description, config) {

/** Extract platform link tokens from description for deduplication via TokenSet. */
export function extractLinkTokens(description, config) {
```

- [ ] **Step 8: Add JSDoc comments to src/util/attachments.js**

```js
/** Normalize an attachment URL: convert Drive/Dropbox URLs to direct-download links. */
export function normalizeAttachmentUrl(url) {

/** Extract file attachment tokens from description URLs. */
export function extractAttachmentTokens(description, config) {

/** Extract file attachments from description, returning attachment objects and cleaned description. */
export function extractAttachments(description, config) {

/** Derive a file type string from a MIME type (e.g. "application/pdf" → "pdf"). */
export function deriveTypeFromMimeType(mimeType) {

/** Return a human-readable download label for a file type (e.g. "pdf" → "Download PDF"). */
export function labelForType(type) {
```

- [ ] **Step 9: Verify tests still pass**

```bash
npm test 2>&1 | tail -5
```

Expected: 380 pass, 0 fail.

- [ ] **Step 10: Commit**

```bash
git add src/util/
git commit -m "docs: add JSDoc comments to all exported util functions"
```

---

### Task 4: Source comment normalization — UI, views, data, router

**Files:**
- Modify: `src/already-cal.js`
- Modify: `src/data.js`
- Modify: `src/router.js`
- Modify: `src/ui/header.js`
- Modify: `src/ui/view-selector.js`
- Modify: `src/ui/tag-filter.js`
- Modify: `src/ui/pagination.js`
- Modify: `src/ui/sticky.js`
- Modify: `src/ui/past-toggle.js`
- Modify: `src/ui/states.js`
- Modify: `src/views/helpers.js`
- Modify: `src/views/month.js`
- Modify: `src/views/week.js`
- Modify: `src/views/day.js`
- Modify: `src/views/grid.js`
- Modify: `src/views/list.js`
- Modify: `src/views/detail.js`
- Modify: `src/views/lightbox.js`

Same rules as Task 3: concise `/** */` above each exported function.

- [ ] **Step 1: Add JSDoc comments to src/already-cal.js**

Above `init` at line 86:

```js
/** Initialize an already-cal instance with the given configuration. */
export function init(userConfig) {
```

- [ ] **Step 2: Add JSDoc comments to src/data.js**

`loadData` (line 8 — not exported with `export` keyword, but is `export async`), `enrichEvent` (line 52), `transformGoogleEvents` (line 170):

```js
/** Load event data from the configured source (pre-loaded, fetch URL, or Google Calendar API). */
export async function loadData(config) {

/** Enrich a raw event: extract directives, images, links, attachments, and tags from description. */
export function enrichEvent(event, config) {

/** Transform raw Google Calendar API response into already-cal data format. */
export function transformGoogleEvents(googleData, config) {
```

- [ ] **Step 3: Add JSDoc comments to src/router.js**

```js
/** Parse the current URL hash or path into a view state object. */
export function parseHash() {

/** Determine the initial view from config, URL, or localStorage. */
export function getInitialView(defaultView, enabledViews, config) {

/** Navigate to a view by setting the URL hash and saving to localStorage. */
export function setView(view, config) {

/** Navigate to an event's detail view by setting the URL hash. */
export function setEventDetail(eventId) {

/** Register a callback for hash change events. */
export function onHashChange(callback) {
```

- [ ] **Step 4: Add JSDoc comments to src/ui/ modules**

`src/ui/header.js`:
```js
/** Render the calendar header: name, description, icon, and subscribe button. */
export function renderHeader(container, calendarData, config) {
```

`src/ui/view-selector.js`:
```js
/** Render the view selector tab bar with icons. */
export function renderViewSelector(container, views, activeView, isMobile, config) {
```

`src/ui/tag-filter.js`:
```js
/** Create a tag filter controller with render, getFilter, and getSelectedTags methods. */
export function createTagFilter(onFilterChange, config) {
```

`src/ui/pagination.js` — line 57 already has a `/** */` on `renderPaginationButtons`, keep it. Add to `paginateEvents` at line 4:
```js
/** Slice events into a paginated window, splitting past and future when showPast is true. */
export function paginateEvents(events, showPast, pageSize, paginationState) {
```

`src/ui/sticky.js`:
```js
/** Resolve a sticky config value (boolean or object) into a normalized { header, viewSelector, tagFilter } object. */
export function resolveSticky(value) {

/** Apply or remove the already-sticky CSS class on header, selector, and tag filter containers. */
export function applyStickyClasses(stickyConfig, headerContainer, selectorContainer, tagFilterContainer) {

/** Recalculate top offsets for sticky-positioned elements so they stack correctly. */
export function updateStickyOffsets(stickyConfig, headerContainer, selectorContainer, tagFilterContainer) {
```

`src/ui/past-toggle.js`:
```js
/** Render the show/hide past events toggle button. */
export function renderPastToggle(container, showingPast, onToggle, config) {
```

`src/ui/states.js`:
```js
/** Render the loading state (custom renderer or default pulse animation). */
export function renderLoading(container, config) {

/** Render the empty state when no events match (custom renderer or default). */
export function renderEmpty(container, hasPastEvents, onShowPast, config) {

/** Render the error state with retry button (custom renderer or default). */
export function renderError(container, message, onRetry, config) {
```

- [ ] **Step 5: Add JSDoc comments to src/views/ modules**

`src/views/helpers.js`:
```js
/** Create a DOM element with optional class name and attributes. */
export function createElement(tag, className, attrs) {

/** Bind click and keyboard handlers to navigate to an event's detail view. */
export function bindEventClick(el, event, viewName, config, { stopPropagation = false } = {}) {

/** Apply base class plus --past and --featured modifier classes to an event element. */
export function applyEventClasses(el, event, baseClass) {

/** Create a lazy-loaded image wrapper for an event thumbnail. */
export function createEventImage(event, className) {

/** Filter out events with the hidden flag. */
export function filterHidden(events) {

/** Sort events so featured events come first. */
export function sortFeatured(events) {

/** Sort events so featured events come first within each date group. */
export function sortFeaturedByDate(events, timezone, locale) {
```

`src/views/month.js`:
```js
/** Render the month calendar grid view. */
export function renderMonthView(container, events, timezone, currentDate, config) {
```

`src/views/week.js`:
```js
/** Render the 7-column week view. */
export function renderWeekView(container, events, timezone, currentDate, config) {
```

`src/views/day.js`:
```js
/** Render the single-day event list view. */
export function renderDayView(container, events, timezone, currentDate, config) {
```

`src/views/grid.js`:
```js
/** Render the card grid view with thumbnails. */
export function renderGridView(container, events, timezone, config) {
```

`src/views/list.js`:
```js
/** Render the compact chronological list view. */
export function renderListView(container, events, timezone, config) {
```

`src/views/detail.js`:
```js
/** Render the two-column event detail view with gallery, metadata, and action buttons. */
export function renderDetailView(container, event, timezone, onBack, config) {
```

`src/views/lightbox.js` — line 7 already has a `/** */` comment. Verify it's accurate and keep it. Add to `openLightbox` at line 13:
```js
/** Open a fullscreen image lightbox overlay with navigation controls. */
export function openLightbox(images, startIndex, altText) {
```

- [ ] **Step 6: Verify tests still pass**

```bash
npm test 2>&1 | tail -5
```

Expected: 380 pass, 0 fail.

- [ ] **Step 7: Commit**

```bash
git add src/already-cal.js src/data.js src/router.js src/ui/ src/views/
git commit -m "docs: add JSDoc comments to all exported UI, view, data, and router functions"
```

---

### Task 5: Create docs/directives.md

**Files:**
- Create: `docs/directives.md`

- [ ] **Step 1: Write docs/directives.md**

Create the file with this content:

```markdown
# Directives Reference

Directives let you control already-cal behavior directly from event descriptions using a hashtag syntax. This is useful when you don't have access to code — you can add platform links, images, and metadata tags right inside a Google Calendar event description.

## Syntax

```
#already:<type>:<value>
```

The `#already:` prefix is case-insensitive. Directives are stripped from the rendered description — visitors never see the raw directive text.

The directive regex matches `#already:` followed by non-whitespace, non-HTML characters (`[^\s<>]+`). This means directives are safe inside `<a>` tags that Google Calendar may wrap around them. HTML entities like `&amp;` are decoded before matching.

## Platform Link Directives

Add a platform button to an event without pasting the full URL. The directive value becomes the handle, ID, or slug used to construct the link.

| Directive | Alias for | Generated label | Constructed URL |
|-----------|-----------|----------------|-----------------|
| `#already:instagram:<handle>` | — | Follow @handle on Instagram | `https://instagram.com/<handle>` |
| `#already:facebook:<handle>` | — | handle on Facebook | `https://facebook.com/<handle>` |
| `#already:x:<handle>` | — | Follow @handle on X | `https://x.com/<handle>` |
| `#already:twitter:<handle>` | `x` | Follow @handle on X | `https://x.com/<handle>` |
| `#already:reddit:<subreddit>` | — | r/subreddit on Reddit | `https://reddit.com/r/<subreddit>` |
| `#already:youtube:<channel>` | — | Watch on YouTube | `https://youtube.com/<channel>` |
| `#already:tiktok:<handle>` | — | @handle on TikTok | `https://tiktok.com/@<handle>` |
| `#already:linkedin:<handle>` | — | View on LinkedIn | `https://linkedin.com/in/<handle>` |
| `#already:discord:<code>` | — | Join Discord | `https://discord.gg/<code>` |
| `#already:zoom:<meetingId>` | — | Join Zoom | `https://zoom.us/j/<meetingId>` |
| `#already:googlemeet:<code>` | — | Join Google Meet | `https://meet.google.com/<code>` |
| `#already:meet:<code>` | `googlemeet` | Join Google Meet | `https://meet.google.com/<code>` |
| `#already:eventbrite:<id>` | — | RSVP on Eventbrite | `https://eventbrite.com/e/<id>` |
| `#already:luma:<slug>` | — | RSVP on Luma | `https://lu.ma/<slug>` |
| `#already:mobilize:<path>` | — | RSVP on Mobilize | `https://mobilize.us/<path>` |
| `#already:actionnetwork:<path>` | — | Take Action | `https://actionnetwork.org/<path>` |
| `#already:gofundme:<slug>` | — | Donate on GoFundMe | `https://gofundme.com/f/<slug>` |
| `#already:partiful:<id>` | — | RSVP on Partiful | `https://partiful.com/e/<id>` |
| `#already:googleforms:<id>` | — | Fill Out Form | `https://docs.google.com/forms/d/e/<id>/viewform` |
| `#already:forms:<id>` | `googleforms` | Fill Out Form | `https://docs.google.com/forms/d/e/<id>/viewform` |
| `#already:googlemaps:<query>` | — | View on Map | `https://maps.google.com/?q=<query>` |
| `#already:maps:<query>` | `googlemaps` | View on Map | `https://maps.google.com/?q=<query>` |

**Aliases:** `twitter` produces the same result as `x`. `meet` is shorthand for `googlemeet`. `forms` is shorthand for `googleforms`. `maps` is shorthand for `googlemaps`.

### Examples

```
#already:instagram:savebigbend     → "Follow @savebigbend on Instagram"
#already:zoom:123456789            → "Join Zoom" (links to zoom.us/j/123456789)
#already:discord:AbCdEf            → "Join Discord" (links to discord.gg/AbCdEf)
#already:eventbrite:12345          → "RSVP on Eventbrite"
#already:twitter:savebigbend       → "Follow @savebigbend on X" (alias for x)
```

## Image Directives

Add images to an event's gallery without pasting the full URL into the description body.

### Direct URL

```
#already:image:https://example.com/flyer.png
```

The URL is added to the event's `images` array. Standard image normalization applies — Google Drive and Dropbox URLs are converted to direct-servable URLs.

### Google Drive shorthand

```
#already:image:drive:FILE_ID
```

Converted to `https://lh3.googleusercontent.com/d/FILE_ID`. The file must be publicly shared.

## Tag Directives

Tags are metadata labels attached to events. They appear as badge pills in the detail view and as filterable pills in the tag filter bar.

### Scalar tags

```
#already:tag:fundraiser
#already:tag:outdoor
```

Produces a tag with `key: "tag"` and `value: "fundraiser"`. Rendered as a simple badge pill.

### Key-value tags

Any directive type that isn't a recognized platform, `image`, `tag`, `featured`, or `hidden` is treated as a key-value tag:

```
#already:cost:$25              → badge pill "cost: $25"
#already:capacity:50           → badge pill "capacity: 50"
```

### URL-valued tags

When the value starts with `http`, the tag is rendered as a clickable link button alongside platform links instead of a badge pill:

```
#already:rsvp:https://forms.google.com/...  → link button labeled "Rsvp"
```

URL-valued tags are excluded from the tag filter bar.

## Featured and Hidden

These are flag directives — they have no value, just the keyword after `#already:`.

### Featured

```
#already:featured
```

- Pins the event to the top of its date group in all views
- Adds a `--featured` CSS modifier class for styling
- Sets `event.featured = true` on the event object

### Hidden

```
#already:hidden
```

- Removes the event from all views (grid, list, month, week, day)
- The event is still accessible via direct link (`#event/<id>` or `/event/<id>`)
- Sets `event.hidden = true` on the event object

## Deduplication

Directives and URL-extracted links use the same canonical ID system. If a directive and a URL in the same description resolve to the same canonical ID, only one entry is produced.

**Example:** An event description containing both `#already:instagram:savebigbend` and `https://instagram.com/savebigbend` produces a single Instagram button, not two.

Each directive type generates canonical IDs as follows:

| Type | Canonical ID format | Example |
|------|-------------------|---------|
| Platform link | `<canonicalPrefix>:<value>` | `instagram:savebigbend` |
| Image (URL) | `image:<hostname><path>` | `image:example.com/flyer.png` |
| Image (Drive) | `image:drive:<fileId>` | `image:drive:ABC123` |
| Scalar tag | `tag:<value>` | `tag:fundraiser` |
| Key-value tag | `tag:<key>:<value>` | `tag:cost:$25` |

Platform aliases share the same `canonicalPrefix` — `twitter` and `x` both use `x`, so `#already:twitter:foo` and `#already:x:foo` deduplicate.

URL-extracted links use platform-specific `canonicalize()` functions that produce IDs in the same format. For example, `https://instagram.com/savebigbend` canonicalizes to `instagram:savebigbend`, matching the directive `#already:instagram:savebigbend`.

## Extraction Order

Within `enrichEvent()`, the description is processed in this order:

1. **Directives** — `#already:` tokens extracted and removed
2. **Images** — Image URLs (by extension), Google Drive URLs, and Dropbox URLs extracted and removed
3. **Platform links** — URLs matching known platforms extracted and removed
4. **File attachments** — URLs ending in file extensions (`.pdf`, `.doc`, etc.) extracted and removed

All extractors decode `&amp;` to `&` before matching. Tokens from all stages are collected in a shared `TokenSet` that enforces deduplication by canonical ID.
```

- [ ] **Step 2: Commit**

```bash
git add docs/directives.md
git commit -m "docs: add comprehensive directives reference"
```

---

### Task 6: Update docs/configuration.md

**Files:**
- Modify: `docs/configuration.md`

- [ ] **Step 1: Add pageSize to View Options table**

After the `initialEvent` row (line 33), add a new row:

```markdown
| `pageSize` | `number` | `10` | Events per page in grid and list views (pagination) |
```

- [ ] **Step 2: Add Sticky Header section**

After the Responsive Options section (after line 106), add a new section:

```markdown
## Sticky Header

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sticky` | `boolean \| object` | `true` | Sticky positioning for header elements |

When `true`, all header elements (calendar header, view selector, tag filter) stick to the top of the viewport on scroll. When `false`, nothing is sticky.

For granular control, pass an object:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `header` | `boolean` | `true` | Stick the calendar header |
| `viewSelector` | `boolean` | `true` | Stick the view selector tabs |
| `tagFilter` | `boolean` | `true` | Stick the tag filter bar |

When using the object form, omitted keys default to `true`. Sticky elements stack vertically — each element's top offset is calculated from the combined height of sticky elements above it.

```js
// Everything sticky (default)
sticky: true

// Nothing sticky
sticky: false

// Only the view selector sticks
sticky: { header: false, viewSelector: true, tagFilter: false }
```
```

- [ ] **Step 3: Add missing i18n keys**

After the `clearFilter` row (line 98), add two rows:

```markdown
| `loadMore` | `'Load more'` | Pagination button (grid/list) |
| `showEarlier` | `'Show earlier'` | Pagination button (grid/list) |
```

- [ ] **Step 4: Fix data attributes accuracy**

Replace the current intro text of the Data Attributes section. The current text at line 262 says:

```markdown
All options can be set via HTML `data-` attributes for zero-JS setup.
```

Replace with:

```markdown
The most common options are available as HTML `data-` attributes for zero-JS setup. Options not listed here (callbacks, data hooks, custom renderers, `sticky`, `pageSize`, `initialEvent`, header options, sanitization, and `imageExtensions`) require JavaScript initialization.
```

- [ ] **Step 5: Clarify data hooks order**

The current text at line 206 says:

```markdown
Hooks run during data loading, after enrichment. Order: `enrichEvent` → `eventTransform` → `eventFilter`.
```

Replace with:

```markdown
Hooks run during data loading. The full pipeline order is: `enrichEvent()` (internal — extracts directives, images, links, attachments, tags) → `eventTransform()` (your hook) → `eventFilter()` (your hook). Both `eventTransform` and `eventFilter` receive fully enriched [event objects](event-schema.md).
```

- [ ] **Step 6: Verify the file is well-formed**

Read through the modified file to check for broken markdown tables or formatting issues.

- [ ] **Step 7: Commit**

```bash
git add docs/configuration.md
git commit -m "docs: add pageSize, sticky, missing i18n keys, fix data attributes accuracy"
```

---

### Task 7: Update docs/event-schema.md

**Files:**
- Modify: `docs/event-schema.md`

- [ ] **Step 1: Add &amp; decoding note to Enrichment Details**

In the Enrichment Details section, after the sentence at line 52 ("The `enrichEvent()` function processes each event's description in this order:"), add:

```markdown
All extraction stages decode `&amp;` to `&` before pattern matching, since HTML-rendered descriptions from Google Calendar may contain encoded ampersands.
```

- [ ] **Step 2: Add cross-link to directives.md**

In the Enrichment Details step 1 (line 54), change:

```markdown
1. **Directives** — `#already:` tokens are extracted and removed from the description. Platform directives become links, image directives become images, tag directives become tags, and `featured`/`hidden` flags are set.
```

To:

```markdown
1. **Directives** — `#already:` tokens are extracted and removed from the description. Platform directives become links, image directives become images, tag directives become tags, and `featured`/`hidden` flags are set. See the **[directives reference](directives.md)** for the full syntax and supported types.
```

- [ ] **Step 3: Add cross-link to configuration.md for sanitization**

In the Description Rendering section (line 66), after the table, add:

```markdown
Sanitization rules are configurable — see the [sanitization section](configuration.md#sanitization) in the configuration reference.
```

- [ ] **Step 4: Clarify pre-set value priority**

In the Enrichment Details section, after the extraction order list (after line 60), add:

```markdown
Pre-set values on events take priority over extraction. If an event already has a non-empty `images` array, image extraction from the description is skipped. The same applies to `links`. This allows pre-loaded data to override what would be extracted from descriptions.
```

- [ ] **Step 5: Commit**

```bash
git add docs/event-schema.md
git commit -m "docs: add cross-links, clarify enrichment priority and &amp; decoding"
```

---

### Task 8: Update README.md

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Trim the Directives section and add link**

Replace the current Directives section (lines 280–337, from `## Directives` through the end of the Tag Filtering section) with a condensed version:

```markdown
## Directives

Directives let you control already-cal behavior directly from event descriptions using a `#already:<type>:<value>` syntax. The `#already:` prefix is case-insensitive. Directives are stripped from the rendered description.

```
#already:instagram:savebigbend     → "Follow @savebigbend on Instagram"
#already:image:https://example.com/flyer.png  → adds image to gallery
#already:image:drive:FILE_ID       → Google Drive image by file ID
#already:tag:fundraiser            → filterable tag badge
#already:cost:$25                  → key-value tag badge "cost: $25"
#already:featured                  → pins event to top, adds star badge
#already:hidden                    → hides from views (still accessible via direct link)
```

All 18 built-in platforms are supported as directives, plus aliases (`twitter` → X, `meet` → Google Meet, `forms` → Google Forms, `maps` → Google Maps). Directives and URLs are deduplicated — `#already:instagram:foo` and `https://instagram.com/foo` produce one button, not two.

For the complete reference including all platforms, URL construction, tag types, and deduplication rules, see the **[directives reference](docs/directives.md)**.

## Tag Filtering

When events have tags (via `#already:tag:` directives or key-value directives), a filter bar appears above the view. Tags display as clickable pills ordered by frequency.

- Click a pill to filter events to those matching that tag
- Select multiple pills for union/OR filtering (events matching **any** selected tag)
- A "Clear" button appears when tags are selected
- URL-valued tags are excluded from the filter bar (they render as link buttons instead)

The clear button label is configurable via `i18n.clearFilter`.
```

- [ ] **Step 2: Fix the data attributes claim**

Find the line (around line 205) that says:

```markdown
All options also work as HTML `data-` attributes for zero-JS setup. See the [data attributes table](#data-attributes) below.
```

Replace with:

```markdown
The most common options are also available as HTML `data-` attributes for zero-JS setup. See the [data attributes table](#data-attributes) below. Some options (callbacks, custom renderers, sticky, pageSize, and others) require JavaScript initialization — see the [full data attributes reference](docs/configuration.md#data-attributes) for details.
```

- [ ] **Step 3: Add pageSize mention to Views table area**

After the paragraph below the Views table (around line 91, the line starting "Grid and list views are paginated"), update it to:

```markdown
Grid and list views are paginated (default: 10 events per page, configurable via `pageSize`) with "Load more" and "Show earlier" buttons. Month, week, and day views show all events for their date range.
```

- [ ] **Step 4: Add cross-link from Event Object section**

The Event Object section (around line 387) currently says:

```markdown
Events are enriched with extracted images, links, attachments, tags, and featured/hidden flags. For the full event schema and data pipeline details, see **[docs/event-schema.md](docs/event-schema.md)**.
```

No change needed — this link is already correct.

- [ ] **Step 5: Add sticky note to Configuration code block**

In the Configuration code block (around line 119), the `sticky` line currently says:

```js
  sticky: true,                        // true | false | { header, viewSelector, tagFilter }
```

This is already accurate. No change needed.

- [ ] **Step 6: Verify all docs/ files are linked from README**

Check that these links exist somewhere in the README:
- `docs/configuration.md` — should be linked from Configuration section
- `docs/event-schema.md` — should be linked from Event Object section
- `docs/directives.md` — should be linked from Directives section (added in Step 1)

- [ ] **Step 7: Commit**

```bash
git add README.md
git commit -m "docs: trim directives section, fix data-attribute claims, add cross-links"
```

---

### Task 9: Rebuild dist

**Files:**
- Modify: `dist/already-cal.js`
- Modify: `dist/already-cal.js.map`
- Modify: `dist/already-cal.min.js`

Since we added JSDoc comments to source files, the built output will differ. Rebuild to keep dist in sync.

- [ ] **Step 1: Rebuild**

```bash
npm run build
```

Expected: `Build complete.`

- [ ] **Step 2: Verify tests still pass**

```bash
npm test 2>&1 | tail -5
```

Expected: 380 pass, 0 fail.

- [ ] **Step 3: Commit**

```bash
git add dist/
git commit -m "build: rebuild dist with source comment updates"
```

---

### Task 10: File GitHub issue for missing data-attribute support

**Files:** None (GitHub only)

- [ ] **Step 1: Create the GitHub issue**

```bash
gh issue create \
  --title "data-attribute support incomplete — several config options are JS-only" \
  --body "$(cat <<'ISSUE_EOF'
## Summary

The README previously stated "All options also work as HTML data- attributes for zero-JS setup." This is inaccurate — `autoInit()` in `src/already-cal.js` only parses a subset of config options from `data-` attributes.

## Currently supported data attributes

These are parsed in `autoInit()` and work with zero-JS setup:

- `data-already-cal` (flag)
- `data-api-key`, `data-calendar-id`, `data-max-results` (google config)
- `data-fetch-url`
- `data-default-view`, `data-views`
- `data-locale`, `data-week-start-day`
- `data-show-past-events`
- `data-mobile-breakpoint`, `data-mobile-default-view`, `data-mobile-hidden-views`
- `data-max-events-per-day`, `data-location-link-template`, `data-storage-key-prefix`
- `data-theme-*`

## Missing — JS-only options with no data-attribute parsing

These config options are only available via `Already.init()`:

- `showHeader`, `headerTitle`, `headerDescription`, `headerIcon`, `subscribeUrl`
- `pageSize`
- `sticky`
- `initialEvent`
- `imageExtensions`
- `sanitization`
- `knownPlatforms`
- All callbacks: `onEventClick`, `onViewChange`, `onDataLoad`, `onError`
- All data hooks: `eventFilter`, `eventTransform`
- All custom renderers: `renderEmpty`, `renderLoading`, `renderError`

## What was done

The README and `docs/configuration.md` have been updated to accurately document which options are available as data attributes. The "all options" claim has been corrected.

## What remains

Consider whether to add data-attribute parsing for the simpler missing options (`data-page-size`, `data-sticky`, `data-show-header`, `data-header-title`, `data-header-description`, `data-header-icon`, `data-subscribe-url`, `data-initial-event`). Callbacks, hooks, and custom renderers inherently require JS and don't need data-attribute support.
ISSUE_EOF
)"
```

- [ ] **Step 2: Note the issue URL**

Record the returned issue URL for reference.
