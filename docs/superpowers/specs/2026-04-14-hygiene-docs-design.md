# Hygiene & Documentation Update — Design Spec

## Goal

Full hygiene and documentation pass across already-cal: accurate, complete docs that match the current codebase, consistent source comments, correct project metadata, and a dedicated directives reference.

## Principles

- **No behavior changes.** Only comments, docs, metadata, and config files.
- **Single source of truth.** Each `docs/` file is authoritative for its topic. README links to them.
- **Document what exists.** If docs claim something the code doesn't support, fix the docs (and file an issue for the code gap).

---

## Section 1: Code Hygiene

### .gitignore

Add two entries:

```
.claude/
CLAUDE.md
```

### package.json

Add `"type": "module"` to eliminate the Node.js ES module reparsing warning in test output.

Add metadata fields:

| Field | Value |
|-------|-------|
| `type` | `"module"` |
| `repository` | `{ "type": "git", "url": "https://github.com/stavxyz/already-cal.git" }` |
| `homepage` | `"https://github.com/stavxyz/already-cal"` |
| `bugs` | `{ "url": "https://github.com/stavxyz/already-cal/issues" }` |
| `author` | `"stavxyz"` |
| `keywords` | `["google-calendar", "calendar", "widget", "events", "vanilla-js", "no-framework"]` |
| `engines` | `{ "node": ">=18" }` |

### build.cjs

Rename `build.js` to `build.cjs` (no content changes). Update the `"build"` and `"dev"` scripts in `package.json` to reference `build.cjs`.

---

## Section 2: Source Comment Normalization

Add concise JSDoc-style `/** */` comments to all exported functions across source files. One-liners or short blocks describing what the function does. No `@param`/`@returns` annotations.

**Scope:**

- `src/already-cal.js` — `init()`
- `src/data.js` — `loadData()`, `enrichEvent()`, `transformGoogleEvents()`
- `src/router.js` — `parseHash()`, `getInitialView()`, `setView()`, `setEventDetail()`, `onHashChange()`
- `src/util/directives.js` — `extractDirectives()`
- `src/util/tokens.js` — `normalizeUrl()`, `TokenSet` class and methods
- `src/util/images.js` — `normalizeImageUrl()`, `extractImageTokens()`, `extractImage()`
- `src/util/links.js` — `handleAt()`, `extractLinks()`, `extractLinkTokens()`
- `src/util/attachments.js` — `normalizeAttachmentUrl()`, `extractAttachmentTokens()`, `extractAttachments()`, `deriveTypeFromMimeType()`, `labelForType()`
- `src/util/sanitize.js` — `escapeHtml()`, `escapeRegex()`, `stripUrl()`, `cleanupHtml()`
- `src/util/description.js` — `detectFormat()`, `sanitizeHtml()`, `renderDescription()`
- `src/util/dates.js` — all exported functions
- `src/ui/header.js` — `renderHeader()`
- `src/ui/view-selector.js` — `renderViewSelector()`
- `src/ui/tag-filter.js` — `createTagFilter()`
- `src/ui/pagination.js` — `paginateEvents()`, `renderPaginationButtons()`
- `src/ui/sticky.js` — `resolveSticky()`, `applyStickyClasses()`, `updateStickyOffsets()`
- `src/ui/past-toggle.js` — `renderPastToggle()`
- `src/ui/states.js` — `renderLoading()`, `renderEmpty()`, `renderError()`
- `src/views/*.js` — all `render*View()` exports, `createElement()` helper

**Won't touch:**

- Inline `//` comments explaining specific logic (keep as-is unless wrong)
- Private/internal functions
- Test files

---

## Section 3: New `docs/directives.md`

Authoritative reference for the `#already:` directive system.

### Structure

1. **Overview** — What directives are, why they exist (control behavior from event descriptions without code access), how they're stripped from rendered output.

2. **Syntax** — `#already:<type>:<value>` pattern. `#already:` prefix is case-insensitive. Directives are stripped from the rendered description.

3. **Platform Link Directives** — Full table of all 18 platforms + 4 aliases:

   | Directive name | Alias for | Example | Generated label | Constructed URL |
   |---|---|---|---|---|
   | `instagram` | — | `#already:instagram:savebigbend` | Follow @savebigbend on Instagram | `https://instagram.com/savebigbend` |
   | `facebook` | — | `#already:facebook:savebigbend` | savebigbend on Facebook | `https://facebook.com/savebigbend` |
   | `x` | — | `#already:x:savebigbend` | Follow @savebigbend on X | `https://x.com/savebigbend` |
   | `twitter` | `x` | `#already:twitter:savebigbend` | Follow @savebigbend on X | `https://x.com/savebigbend` |
   | `reddit` | — | `#already:reddit:BigBend` | r/BigBend on Reddit | `https://reddit.com/r/BigBend` |
   | `youtube` | — | `#already:youtube:channel` | Watch on YouTube | `https://youtube.com/channel` |
   | `tiktok` | — | `#already:tiktok:savebigbend` | @savebigbend on TikTok | `https://tiktok.com/@savebigbend` |
   | `linkedin` | — | `#already:linkedin:handle` | View on LinkedIn | `https://linkedin.com/in/handle` |
   | `discord` | — | `#already:discord:AbCdEf` | Join Discord | `https://discord.gg/AbCdEf` |
   | `zoom` | — | `#already:zoom:123456789` | Join Zoom | `https://zoom.us/j/123456789` |
   | `googlemeet` | — | `#already:googlemeet:abc-defg-hij` | Join Google Meet | `https://meet.google.com/abc-defg-hij` |
   | `meet` | `googlemeet` | `#already:meet:abc-defg-hij` | Join Google Meet | `https://meet.google.com/abc-defg-hij` |
   | `eventbrite` | — | `#already:eventbrite:12345` | RSVP on Eventbrite | `https://eventbrite.com/e/12345` |
   | `luma` | — | `#already:luma:my-event` | RSVP on Luma | `https://lu.ma/my-event` |
   | `mobilize` | — | `#already:mobilize:org/event` | RSVP on Mobilize | `https://mobilize.us/org/event` |
   | `actionnetwork` | — | `#already:actionnetwork:petitions/123` | Take Action | `https://actionnetwork.org/petitions/123` |
   | `gofundme` | — | `#already:gofundme:my-campaign` | Donate on GoFundMe | `https://gofundme.com/f/my-campaign` |
   | `partiful` | — | `#already:partiful:abc123` | RSVP on Partiful | `https://partiful.com/e/abc123` |
   | `googleforms` | — | `#already:googleforms:formId` | Fill Out Form | `https://docs.google.com/forms/d/e/formId/viewform` |
   | `forms` | `googleforms` | `#already:forms:formId` | Fill Out Form | `https://docs.google.com/forms/d/e/formId/viewform` |
   | `googlemaps` | — | `#already:googlemaps:Austin+TX` | View on Map | `https://maps.google.com/?q=Austin+TX` |
   | `maps` | `googlemaps` | `#already:maps:Austin+TX` | View on Map | `https://maps.google.com/?q=Austin+TX` |

4. **Image Directives** — Direct URL syntax (`#already:image:https://...`), Google Drive shorthand (`#already:image:drive:FILE_ID`), normalization behavior (Drive URLs → `lh3.googleusercontent.com`, Dropbox → `?raw=1`).

5. **Tag Directives** — Scalar tags (`#already:tag:value`), key-value text tags (`#already:key:value`), URL-valued key-value tags rendered as link buttons. How tags appear in the tag filter bar vs. detail view.

6. **Featured and Hidden** — `#already:featured` pins event to top of date group and adds star badge. `#already:hidden` removes from all views but event is still accessible via direct link (`#event/<id>`). Both are boolean flags on the event object.

7. **Deduplication** — Each directive produces a canonical ID. URL-extracted links produce canonical IDs via platform-specific `canonicalize()` functions. If a directive and a URL resolve to the same canonical ID, only one entry is kept. Example: `#already:instagram:foo` and `https://instagram.com/foo` → one button.

8. **Parsing Details** — `&amp;` decoded before matching. Directives regex: `/#already:([^\s<>]+)/gi` — stops at whitespace, `<`, or `>` (safe inside `<a>` tags). Extraction order in `enrichEvent()`: directives → images → links → attachments.

---

## Section 4: `docs/configuration.md` Updates

### Add missing options

**View Options table** — add:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `pageSize` | `number` | `10` | Events per page in grid and list views |

**New section: Sticky Header** — add after Responsive Options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sticky` | `boolean \| object` | `true` | Sticky positioning for header elements. `true` = all sticky, `false` = none sticky |

Object form:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `header` | `boolean` | `true` | Stick the calendar header |
| `viewSelector` | `boolean` | `true` | Stick the view selector tabs |
| `tagFilter` | `boolean` | `true` | Stick the tag filter bar |

### Add missing i18n keys

Add to the i18n keys table:

| Key | Default | Used in |
|-----|---------|---------|
| `loadMore` | `'Load more'` | Pagination button (grid/list) |
| `showEarlier` | `'Show earlier'` | Pagination button (grid/list) |

### Fix data attributes accuracy

Audit which data attributes are actually parsed in `autoInit()` and mark the table accordingly. Current code handles:

- `data-already-cal`, `data-api-key`, `data-calendar-id`, `data-max-results`
- `data-fetch-url`, `data-default-view`, `data-views`
- `data-locale`, `data-week-start-day`, `data-show-past-events`
- `data-mobile-breakpoint`, `data-mobile-default-view`, `data-mobile-hidden-views`
- `data-max-events-per-day`, `data-location-link-template`, `data-storage-key-prefix`
- `data-theme-*`

**Not currently parsed** (JS-only): `showHeader`, `headerTitle`, `headerDescription`, `headerIcon`, `subscribeUrl`, `pageSize`, `sticky`, `initialEvent`, `imageExtensions`, `sanitization`, callbacks, data hooks, custom renderers.

Add a note to the Data Attributes section clarifying that data attributes cover the most common options but some are JS-only.

### Clarify data hooks order

Fix the slightly contradictory wording. The correct order documented in `data.js`:

```
enrichEvent() → eventTransform() → eventFilter()
```

Clarify that "after enrichment" means after `enrichEvent()` runs — i.e., `eventTransform` and `eventFilter` receive already-enriched events.

---

## Section 5: `docs/event-schema.md` Updates

- Note `&amp;` decoding in the Enrichment Details section
- Add cross-link to `docs/directives.md` from the directive extraction step
- Add cross-link to `docs/configuration.md` for sanitization config
- Clarify that pre-set values on events (e.g., `images: ['a.png']`) take priority — enrichment only fills empty arrays

---

## Section 6: `README.md` Overhaul

### Directives section

Trim to concise summary (~25-30 lines): syntax, one example per directive type, key dedup concept. End with link: "For the complete reference including all 18 platforms, aliases, URL construction, and deduplication rules, see **[docs/directives.md](docs/directives.md)**."

### Fix data attributes claim

Replace "All options also work as HTML data- attributes for zero-JS setup" with: "The most common options are available as HTML data- attributes for zero-JS setup. See the [data attributes table](docs/configuration.md#data-attributes) for supported attributes."

### Cross-links

Ensure all `docs/` files are linked:

- Configuration section → `docs/configuration.md` (already linked)
- Event Object section → `docs/event-schema.md` (already linked)
- Directives section → `docs/directives.md` (new)

### Minor additions

- Mention `pageSize` config in the pagination note under Views table
- Mention `sticky` accepts a granular object in the Configuration code block (already shown, just needs a comment)

---

## Section 7: GitHub Issue

File a GitHub issue titled something like: "data-attribute support incomplete — several config options are JS-only"

Body will catalog each option missing from `autoInit()` parsing and reference the README claim that was corrected.

---

## Out of Scope

- No new features (no adding data attribute parsing)
- No test changes (tests already pass, no behavior changes)
- No CSS changes
- Design specs and implementation plans in `docs/superpowers/` left as-is
- No changes to `dev.html`
