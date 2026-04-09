# og-cal: Directives, View Refactor & Tag Filtering

**Date**: 2026-04-11
**Status**: Approved
**Repo**: ~/src/og-cal (primary), ~/src/showcal (embed worker integration)

## Overview

Sub-project 2 of ShowCal. Builds on the directive system and unified token pipeline from PR #8 to add `featured`/`hidden` directive behavior, refactor all 6 view renderers from innerHTML to DOM factories, add a tag filtering UI, and support event deep-linking with OG meta tags. Also brings view rendering test coverage from 0% to comprehensive.

## Decisions Log

| Question | Decision | Rationale |
|----------|----------|-----------|
| Where does `hidden` filtering happen? | og-cal (not embed worker) | Self-contained — any og-cal consumer gets it for free |
| How are `featured` events surfaced? | Sort to top within date group + CSS class + star pseudo-element | Keeps date context, composable styling |
| View refactoring depth? | Full DOM factory refactor (option C) | Pre-release, best time for churn. DOM factories are safer (textContent vs escapeHtml), more composable |
| Tag filtering logic? | Union/OR — events matching *any* selected tag shown | More forgiving, less empty states |
| Tag filtering in scope? | Yes | Natural extension of directive work |
| Event deep-linking? | Yes — og-cal manages meta tags, embed worker does server-side OG for crawlers | og-cal should handle this so all consumers benefit |

## 1. Directive Behavior: `featured` and `hidden`

### `hidden`

`extractDirectives()` recognizes `#ogcal:hidden` (and `#showcal:hidden`) as a special-cased scalar directive. Instead of producing a token, it sets a flag in the return value.

`enrichEvent()` reads this flag and sets `event.hidden = true`. The directive is consumed — it does not appear in `event.tags`.

All 6 view rendering functions skip events where `hidden === true`. The event remains in the data array (accessible via `eventTransform`, `onDataLoad` callback, etc.) but is never rendered.

### `featured`

Same pattern: `#ogcal:featured` → flag → `event.featured = true`. Consumed, not in `event.tags`.

**Sorting**: Featured events sort to the top *within their date group*. A featured event on April 15 does not jump ahead of April 14 events. In views that group by date (list, grid), featured events within the same date appear first. In month/week/day views, featured events within the same cell/slot appear first.

**Visual treatment**:
- CSS modifier class: `ogcal-{view}-{element}--featured` (e.g., `ogcal-grid-card--featured`)
- Left accent border using `var(--ogcal-primary)` color
- `::before` pseudo-element with a small star icon (CSS-only, no SVG injection)
- Fully themeable through existing CSS custom properties

### Implementation in `extractDirectives()`

`featured` and `hidden` are handled before the tag fallback in `parseDirective()`. They are scalar directives (no `:value` after the keyword). Return shape changes from `{ tokens, description }` to `{ tokens, description, featured, hidden }` — boolean flags, default `false`.

`enrichEvent()` in `data.js` reads these flags and sets them on the event object.

## 2. View Rendering Refactor: DOM Factory Pattern

### Shared Helpers — `src/views/helpers.js`

```
createElement(tag, className, attrs?)
  → creates element, sets className, applies optional attributes

bindEventClick(el, event, viewName, config)
  → click + keyboard (Enter/Space) listeners
  → onEventClick interception (return false to prevent navigation)
  → setEventDetail(event.id) navigation
  → sets tabindex="0", role="button"
  Currently copy-pasted ~15 lines across 5 views.

createEventImage(event)
  → img element with lazy loading, onerror hide, alt text
  Reused by grid and detail views.

applyEventClasses(el, event, baseClass)
  → conditionally adds --past and --featured modifiers
```

### Per-View Changes

Each view replaces `innerHTML = \`...\`` with `createElement()` + `.textContent` calls. Same CSS classes, same DOM hierarchy, same visual output.

**Key benefit**: `.textContent` is safe by default — no `escapeHtml()` needed for user-supplied data (event title, location, etc.). `innerHTML` remains only for:
- Description rendering (goes through existing sanitizer in `description.js`)
- Subscribe button SVG icon in `header.js`

### Hidden Event Filtering

Each view's render function filters `events.filter(e => !e.hidden)` at the top before rendering. This is applied in every view rather than in `og-cal.js` so that the full event set remains available to callbacks and the tag filter component.

### Featured Event Sorting

After hidden filtering, each view applies featured sorting within its date grouping logic. For flat views (grid, list): sort stable with featured first per date. For calendar views (month, week, day): sort within each cell/slot.

### What Doesn't Change

CSS class names, DOM structure, visual output, responsive behavior, router, data loading. This is a rendering-layer refactor.

## 3. Tag Filtering UI

### Component — `src/ui/tag-filter.js`

**Renders** a horizontal row of tag pills below the header, above the view content.

**Visibility**: Only appears when at least one visible (non-hidden) event has tags.

**Tag collection**: Gathers all unique tags from visible events. Scalar tags (`key: 'tag'`) display their value. Key-value text tags display `key: value`. URL-valued tags are excluded (they're links, not categories). Ordered by frequency (most common first).

**Interaction**:
- Each pill is a toggle button. Click to activate (filled), click again to deactivate (outline).
- Multiple tags selectable simultaneously.
- Union/OR logic: events matching *any* selected tag pass the filter.
- "Clear" button appears when any filter is active.

**Lifecycle**:
- Re-renders when event set changes (view switch, past toggle, data reload).
- Selected tags persist across view switches within the session (closure state).
- Not persisted to localStorage — resets on page reload.

### Integration

Tag filtering slots into the existing render pipeline in `og-cal.js`:
1. Past event filtering (existing)
2. Hidden event filtering (new)
3. Tag filtering (new) — applied before passing events to view renderer
4. Featured sorting (new) — applied last, within the filtered set

The tag filter bar is rendered by `og-cal.js` as part of the main render cycle, not by individual views.

## 4. Event Deep-Linking & OG Meta Tags

### og-cal Changes

**`initialEvent` config option**: When set to an event ID string, og-cal navigates directly to that event's detail view on init instead of the default view. If the event ID is not found in the data, falls back to the default view.

**Path-based route support**: The router recognizes `/event/{id}` in the URL path (in addition to existing `#event/{id}` hash routes). This allows servers to route based on the event ID before the page loads.

**Dynamic `<meta>` tag management**: When entering the detail view for an event, og-cal creates/updates meta tags in `document.head`:
- `og:title` → event title
- `og:description` → event date + location (plain text, not the full description)
- `og:image` → `event.image` (first image, if any)
- `og:url` → current page URL

When navigating away from detail view (back to any list view), og-cal restores the original meta tags that were present on page load (captured during init).

This handles the case where a user copies a URL with a hash fragment and another user opens it — og-cal sets the meta tags on load. For true crawler unfurling (Facebook, Twitter, iMessage link previews), server-side rendering is required — this is deferred to a future sub-project that will design the shareable URL strategy (per-customer subdomains, which worker handles unfurling, etc.).

## 5. Testing Strategy

### Test Environment

Add `jsdom` as a dev dependency. Create `test/setup-dom.js` that provides `document`, `window`, and `localStorage` globals for view tests.

### Test Files

| File | What | Approach |
|------|------|----------|
| `test/views/helpers.test.js` | `createElement`, `bindEventClick`, `applyEventClasses`, `createEventImage` | Unit tests with jsdom |
| `test/views/grid.test.js` | Grid rendering, featured class, hidden filtering, click handling | Render into container, assert DOM |
| `test/views/list.test.js` | List rendering, same patterns | Same |
| `test/views/month.test.js` | Month grid, navigation, day cells | Same |
| `test/views/week.test.js` | Week columns, time slots | Same |
| `test/views/day.test.js` | Day timeline | Same |
| `test/views/detail.test.js` | Gallery, tags, links, attachments, back button, meta tags | Same |
| `test/tag-filter.test.js` | Render, toggle, union filtering, clear, frequency order | DOM-based |
| `test/featured-hidden.test.js` | `enrichEvent` flag extraction, directive consumption, view filtering, date-group sorting | Pure function + DOM |

### Test Ordering

1. `featured-hidden.test.js` — data layer (no DOM needed for flag extraction)
2. `helpers.test.js` — shared view helpers
3. View tests one at a time, paired with each view's refactor
4. `tag-filter.test.js` last

### Existing Tests

The 201 existing tests are untouched. They serve as the regression safety net during the view refactor.

## 6. ShowCal Embed Worker Integration Summary

Thin integration layer:

1. Run `scripts/copy-ogcal.js` to update og-cal dist assets in `workers/embed/static/`
2. Pass `directives_config.prefix` through as `directivePrefix` in config (documentation concern — both prefixes already work)

Server-side OG tag injection, event deep-link routing (`/v/{slug}/event/{eventId}`), and shareable URL strategy (per-customer subdomains like `freco.showcal.events`, `showcal.events/cal/{slug}`, etc.) are deferred to a future sub-project.

## Out of Scope

- Server-side OG unfurling / crawler-friendly event URLs
- Per-customer subdomains (`*.showcal.events`)
- Custom domains / Cloudflare for SaaS
- Shareable URL strategy (which worker handles event links)
- Tag filter URL persistence / deep-linkable tag filters
- Intersection/AND tag filtering
- New views
- TypeScript migration
- Data loading changes
- `eventFilter`-based hidden override (users can already do this via config)
