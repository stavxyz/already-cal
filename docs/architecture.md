# Architecture

Technical overview of how already-cal works internally. For practical setup and commands, see the [Development Guide](development.md). For config options, see the [Configuration Reference](configuration.md).

## Data Pipeline

Events flow through a pipeline from raw input to rendered view:

```
Raw data (config.data / config.fetchUrl / config.google)
  │
  ▼
Format detection
  Accepts already-cal schema OR raw Google Calendar API JSON.
  Auto-detects by checking for an `items` array (Google API format)
  vs. an `events` array (already-cal format). Google API responses
  are transformed: items → events, summary → calendar.name, etc.
  │
  ▼
enrichEvent() — per event
  Processes the description in this order:
  0. Comments — // lines stripped (AFL comment syntax)
  1. Directives — #already: tokens extracted and removed
  2. Images — image URLs, Drive links, Dropbox links extracted and removed
  3. Links — platform URLs extracted and removed
  4. Attachments — file URLs (.pdf, .doc, etc.) extracted and removed
  5. Website: pre-set value, website directive, or first plain URL left
  All stages share a TokenSet for deduplication by canonical ID.
  Pre-set values (non-empty images/links arrays) skip extraction.
  │
  ▼
eventTransform() — user hook (optional)
  Mutate or replace each enriched event.
  │
  ▼
eventFilter() — user hook (optional)
  Return true to keep, false to exclude.
  │
  ▼
Passed to onDataLoad as data.events
  │
  ▼
composeEvents() (src/composite.js), once per load
  1. visibility: entries with a truthy event.hidden leave
  2. grouping: an entry flagged composite takes the entries that start
     inside its hours as its parts, and the parts leave the top level
  The widget keeps the composed result and the calendar's metadata as its
  render-time state. It does not keep the flat list.
  │
  ▼
Per render (on view switch, filter change, pagination, etc.):
  1. isPast filter: past events toggle
  2. tag filter: tag pill selection (union/OR)
  3. sort + paginate (grid/list), or day placement (month/week/day)
  │
  ▼
View renderer
```

Data loading is in `src/data.js`. Enrichment helpers are in `src/util/` (comments.js, directives.js, images.js, links.js, attachments.js). The `TokenSet` deduplication container is in `src/util/tokens.js`.

Composition is in `src/composite.js`: the grouping, the lookup from an id to its place in the composed result, and the accessors that combine a composite's images and tags. The day placement that the month, week, and day views receive is in `src/views/placement.js`.

## Rendering Flow

### Initialization

`init(userConfig)` in `src/already-cal.js`:

1. Merges `userConfig` with `DEFAULTS` and `I18N_DEFAULTS`
2. Resolves `el` — accepts a CSS selector string or DOM element
3. Calls `applyTheme(el, config.theme, [])` — sets data attributes and CSS custom properties on the mount element
4. Builds a persistent DOM structure inside the mount element: headerContainer, selectorContainer, tagFilterContainer, paginationTopContainer, viewContainer, paginationBottomContainer, toggleContainer
5. Calls `start()` which:
   - Renders a loading state in viewContainer
   - Loads data via `loadData(config)` (async)
   - Guards against `destroyed` flag after await (in case `destroy()` was called during load)
   - Calls `onDataLoad` with the flat data, then composes the events once via `composeEvents()` and keeps the composed result
   - Renders the sticky header (calendar name, description, subscribe button) via `renderHeader(headerContainer, ...)` after data loads
   - Determines initial view via `getInitialView()` (priority: `initialEvent` > URL hash/path > localStorage > `defaultView`). On mobile, `mobileDefaultView` overrides when neither the hash nor the path names a route.
   - Calls `renderView()` with the initial view state
   - Registers a `hashchange` listener via `onHashChange()`
6. Registers event listeners: `resize` (sticky offset recalculation) and `message` (postMessage API)
7. Returns the instance object with `setConfig()` and `destroy()` methods

### View Rendering

`renderView(viewState)` updates the UI using the persistent container structure:

1. Applies the past and tag filters to the composed top-level list. Hidden entries and the parts of a composite were set aside when the data loaded
2. Renders tag filter pills into tagFilterContainer (or clears it for detail view) via `tagFilter.render()`
3. Renders view selector tabs into selectorContainer (skipped for detail view) via `src/ui/view-selector.js`
4. Updates sticky offsets for the header/selector/tag-filter stack
5. Delegates to the view-specific renderer (`src/views/month.js`, `week.js`, `day.js`, `grid.js`, `list.js`, or `detail.js`) into viewContainer
6. For grid/list: applies pagination via `src/ui/pagination.js` into paginationTopContainer and paginationBottomContainer
7. Renders the past events toggle into toggleContainer via `src/ui/past-toggle.js` (only when past events exist; skipped for detail view)
8. Renders an empty state if no events match the current filters

Grid and list views use `getLayout(theme.layout)` from `src/layouts/registry.js` to get the card renderer, and pass every card through `decorateEventCard()` in `src/views/card-decoration.js` (which makes the title the event's link, adds a composite's parts, and mounts the RSVP control), as the month and week popover does. That one step also applies the state classes and the click binding. Month, week, and day views have their own rendering logic and receive a day placement from `placeByDay()` in `src/views/placement.js`. The detail view resolves its event through the composed result's `lookup(id)`, so a link to a part opens its parent.

### Hash Routing

`src/router.js` manages view state via URL hash:

- `parseHash()`: reads `#event/{id}`, `#day/{date}`, or view names from the hash, and when the hash names none of them, `/event/{id}` from the URL path (server-side routing support). The hash is read first so that a page served at an event path can still navigate away from that event. The event id is percent-decoded in both forms; a malformed escape in the hash is kept as written, and one in the path is no route. A hash built by hand is decoded the same way, so an id that itself holds a valid escape such as `%41` has to be encoded as `%2541`.
- `getInitialView(defaultView, enabledViews, config)` — determines the first view to show. Priority: `config.initialEvent` > hash/path > localStorage > `config.defaultView`.
- `setView(view, config)` — updates the hash and saves to localStorage with key `{storageKeyPrefix}-view`.
- `eventHref(entry)`: the `#event/{id}` link that opens an entry, with the id percent-encoded so a space or a non-ASCII character survives the fragment, written once here so every card, row, chip, and block agrees with `parseHash`; on a page with a `<base href>` it is the page's absolute URL with that fragment, because a relative one would resolve against the base. There, `keepEventHrefsCurrent` (`ui/event-link.js`) rewrites the widget's own link under the pointer or focus (or a host's fragment-only `#event/` link, which the base misdirects too) from the current URL just before a hover, a pointer press, focus, or a context menu reaches it, so a host's `pushState` cannot leave the status bar, a middle click, or "Copy link address" on the URL the page had at render time. A part with no id links to its parent; an entry with neither has no link.
- `onHashChange(callback)` — registers a hashchange listener. Returns an unsubscribe function for cleanup. A change that lands back on the URL the visitor arrived on (the browser's Back through the entries the widget wrote) is read like the first load, path and all; any other change is read from the hash alone, so a hash that names no route, including the bare `#` a host's `href="#"` leaves, cannot pull the visitor back into the path's event.

## Theme System

`src/theme.js` manages all visual configuration. Theme bundles are registered in `src/themes/registry.js`.

### Theme Bundles

A theme bundle packages a layout, dimension defaults, constraints, and CSS custom property overrides into a named unit. The four built-in themes (`clean`, `hero`, `badge`, `compact`) are registered as bundles during module initialization. Custom bundles are registered via `Already.registerTheme(name, bundle)`.

Built-in bundles:

| Theme | Layout | Constraints |
|-------|--------|------------|
| `clean` | `"clean"` | none |
| `hero` | `"hero"` | none |
| `badge` | `"badge"` | none |
| `compact` | `"compact"` | `{ orientation: "vertical" }` |

### Theme Resolution

`resolveTheme(themeInput)` accepts either a string (layout shorthand) or an object. It first checks the theme bundle registry — if the layout names a registered bundle, the bundle's defaults, constraints, and overrides are applied.

- **Fixed keys** (validated against allowed values):
  - `layout` — any registered layout name; built-in: `"clean"`, `"hero"`, `"badge"`, `"compact"` (default: `"clean"`)
  - `palette` — `"light"` | `"dark"` | `"warm"` | `"cool"` (default: `"light"`)
  - `orientation` — `"vertical"` | `"horizontal"` (default: `"vertical"`)
  - `imagePosition` — `"left"` | `"right"` | `"alternating"` (default: `"left"`, only used when orientation is `"horizontal"`)

- **Open-ended keys** — anything else is collected as CSS custom property overrides (e.g. `primary: '#ff0000'` → `--already-primary: #ff0000`)

**Priority chain per dimension** (orientation, imagePosition, palette):

```
constraint (enforced, throws if user contradicts)
  > user-provided value
    > bundle default
      > THEME_DEFAULTS
```

Invalid user values trigger a `console.warn` and fall through to the next level. Constraint violations throw an `Error` — see Error Handling below.

### Theme Application

`applyTheme(el, themeInput, previousOverrideKeys)`:

1. Calls `resolveTheme()` to get the normalized theme config
2. Sets data attributes on the mount element: `data-layout`, `data-orientation`, `data-image-position`, `data-palette`
3. Clears previous CSS custom property overrides (tracked via `previousOverrideKeys` array)
4. Applies new overrides: converts camelCase keys to `--already-kebab-case` and sets them as inline styles
5. Returns the resolved theme object plus the new `overrideKeys` array for future cleanup

Palette CSS files (`src/palettes/*.css`) define styles via `.already[data-palette="name"]` attribute selectors. The `.already` class scopes palette styles to the mount element. Setting `data-palette` activates the corresponding palette — no JavaScript re-render needed.

### Theme Error Handling

Constraint violations (e.g., passing `orientation: "horizontal"` to a theme that constrains `orientation: "vertical"`) are handled differently by call site:

- **`init()`** — renders a minimal error message in the container (`.already-error` div) and re-throws. Known constraint errors display the error message; unexpected errors show a generic fallback message.
- **`setConfig()`** — logs the full error via `console.error` (preserving the stack trace) and leaves the current theme unchanged.

### THEMES Snapshot

`Already.THEMES` is a deeply frozen snapshot of all registered theme bundles (built-in and custom). It is rebuilt each time `registerTheme()` is called. In the IIFE bundle, esbuild's getter ensures each access returns the latest snapshot.

## Registry System

`src/registry.js` provides a generic, type-agnostic registry used for layouts and theme bundles. Containers use `Object.create(null)` to avoid prototype pollution. The API:

- `defineType(type, validator)` — creates a new registry type with a validation function
- `registerBuiltIn(type, name, impl)` — registers a built-in entry (protected from override and duplication)
- `register(type, name, impl)` — registers a custom entry (throws if name collides with a built-in)
- `get(type, name, fallback)` — retrieves an entry, or returns `fallback`. Intentionally lenient on undefined types for graceful rendering fallback.
- `has(type, name)` — checks if a name is registered. Same lenient behavior as `get()`.

### Layout Registry

`src/layouts/registry.js` initializes the `"layout"` registry type and registers the four built-in layouts. It exports `getLayout(name)` which returns `clean` as fallback for unknown names.

- Built-in layouts: `clean`, `hero`, `badge`, `compact` — each in `src/layouts/{name}/{name}.js`
- Each layout module exports a render function: `(event, options) => HTMLElement` where `options` includes `orientation`, `imagePosition`, `index`, `timezone`, `locale`, and `config`. `options.timezone` is the calendar/source-zone fallback (`data.calendar.timezone`) — built-in layouts render event times in the viewer's local zone (with a source-zone suffix when it differs) via `formatEventWhen`, not `options.timezone` directly.
- Custom layouts are registered via `Already.registerLayout(name, renderFn)` which delegates to `register("layout", name, renderFn)`
- Built-in names are protected — attempting to register a custom layout with a built-in name throws an error

### Theme Registry

`src/themes/registry.js` initializes the `"theme"` registry type and registers the four built-in theme bundles. It exports `getTheme(name)`, `getThemeNames()`, `addThemeName(name)`, and validation sets (`VALID_PALETTES`, `VALID_ORIENTATIONS`, `VALID_IMAGE_POSITIONS`).

- The validator (`validateBundle`) checks bundle type, allowed keys, layout type/reference, dimension key/value validity, and overrides type
- Custom themes are registered via `Already.registerTheme(name, bundle)` which validates, optionally auto-registers a layout function, and updates the `THEMES` snapshot
- Built-in names are protected — attempting to override a built-in theme throws an error
- Custom themes can be re-registered (replacing the previous bundle)

### Error Handling

`safeRenderCard()` in `src/layouts/helpers.js` wraps every layout render call in a try/catch. If a layout function throws or returns a non-`HTMLElement` value, an error card is rendered in place of the event and the error is logged via `console.error`. `decorateEventCard()` in `src/views/card-decoration.js` applies every decoration a card gets after its layout renders it, and skips error cards entirely. An unrecognized layout name in `resolveTheme()` triggers a `console.warn` before falling back to `"clean"`.

## Extraction Pipeline

All extraction happens in `enrichEvent()` (`src/data.js`) using utilities from `src/util/`:

### TokenSet

`src/util/tokens.js` — deduplication container keyed by canonical ID:

- `add(token)` — adds a token, returns `true` if new (canonical ID not yet seen)
- `addAll(tokens)` — adds multiple tokens at once
- `has(canonicalId)` — checks for existence
- `ofType(type)` — filters tokens by type (e.g. `"image"`, `"link"`, `"attachment"`)

`normalizeUrl(url)` is a standalone exported function (not a method on `TokenSet`) that strips `www.`, forces HTTPS, and removes tracking params (`utm_*`, `fbclid`, `si`).

### Canonical IDs

Each extracted token gets a canonical ID for deduplication:

| Token type | ID format | Example |
|-----------|-----------|---------|
| Platform link | `<platform>:<handle>` | `instagram:savebigbend` |
| Image (URL) | `image:<host><path>` | `image:example.com/pic.png` |
| Image (Drive) | `image:drive:<fileId>` | `image:drive:ABC123` |
| Scalar tag | `tag:<value>` | `tag:fundraiser` |
| Key-value tag | `tag:<key>:<value>` | `tag:cost:$25` |

This means `#already:instagram:foo` (directive) and `https://instagram.com/foo` (URL in description) produce a single link entry.

### Extraction Order

1. **Directives** (`src/util/directives.js`) — `#already:` tokens
2. **Images** (`src/util/images.js`) — image URLs, Drive links, Dropbox links
3. **Links** (`src/util/links.js`) — platform URLs with label generation
4. **Attachments** (`src/util/attachments.js`) — file URLs (`.pdf`, `.doc`, etc.)
5. **Website** (`src/data.js`): a pre-set value, the `website` directive, or the first plain URL left in the description

All extractors decode `&amp;` → `&` before matching (Google Calendar HTML-encodes ampersands).

## Lifecycle

### Runtime Updates

`instance.setConfig(newConfig)`:

- Guards against `destroyed` flag — silently returns if destroyed
- Validates input — must be a non-null plain object
- **CSS-only updates** (no DOM rebuild): `palette` changes (sets `data-palette`), CSS custom property overrides
- **Re-render triggers**: `layout`, `orientation`, `imagePosition` changes, `views`, `showPastEvents`, `pageSize`, `defaultView`
- Pagination state resets on re-render
- Invalid values are logged via `console.warn` and ignored

`Already.setConfig(config)` — global convenience that delegates to `_instance` (last-created instance). Warns if no instance exists.

### PostMessage API

`window.addEventListener("message", handler)` listens for `{ type: "already:config", config: {...} }` messages. Delegates to `instance.setConfig()`. Messages without the `"already:config"` type, or with non-object config, are silently ignored. The origin is not checked — accepted config keys are purely presentational.

### Destroy

`instance.destroy()`:

1. Sets `destroyed = true` (guards against double-destroy and setConfig-after-destroy)
2. Removes event listeners: `resize`, `message`, `hashchange` (via cleanup function returned by `onHashChange()`)
3. Clears `el.innerHTML`
4. Removes CSS class (`already`) and data attributes (`layout`, `orientation`, `imagePosition`, `palette`)
5. Removes CSS custom property overrides (tracked via `themeResult.overrideKeys`)
6. Nulls `_instance` if this is the current global instance

The `destroyed` flag also guards the async gap in `start()` — if `destroy()` is called while `loadData()` is in flight, `start()` bails after the await.

## Module Dependencies

Key import relationships (simplified):

- **`already-cal.js`** imports: `registry.js`, `composite.js`, `data.js`, `router.js`, `theme.js`, all `views/*`, all `ui/*`
- **`data.js`** imports: `util/directives.js`, `util/images.js`, `util/links.js`, `util/attachments.js`, `util/description.js`, `util/tokens.js`
- **`theme.js`** imports: `registry.js`, `themes/registry.js` (which transitively initializes the layout registry)
- **`themes/registry.js`** imports: `registry.js`, `layouts/registry.js` (side-effect import for layout type initialization)
- **`layouts/registry.js`** imports: `registry.js`, all `layouts/{name}/{name}.js`
- **`layouts/helpers.js`** imports: `composite.js`, `views/helpers.js` (createElement), `util/dates.js`; exports `safeRenderCard`, `renderErrorCard`
- **`composite.js`** imports: `util/dates.js`, `util/tags.js`. It imports nothing that touches the DOM
- **`views/helpers.js`** imports: `composite.js`, `util/dates.js`, `util/tags.js`; exports `bindEventClick`, `createElement`, `createTagPills`, `eventLinkText`, etc.
- **`views/card-decoration.js`** imports: `router.js` (eventHref), `views/helpers.js` (bindEventClick, eventLinkText), `ui/card-parts.js`, `ui/event-link.js`, `ui/rsvp-form.js`, `ui/rsvp-state.js`, `util/dates.js`; exports `decorateEventCard`, the one way to decorate a card
- **`ui/event-link.js`** imports: `views/helpers.js` (createElement); exports `linkTitle` (moves a title's text into the event link and marks the host), `eventAnchor` (an element that is the link itself), and `fillEventAnchor` (gives that element its text, with a hidden name when the title is blank)
- **`views/placement.js`** imports: `composite.js`, `util/dates.js`
- **`views/grid.js`** and **`views/list.js`** import: `layouts/helpers.js` (safeRenderCard), `layouts/registry.js`, `views/card-decoration.js`
- **`views/detail.js`** imports: `composite.js`, `views/detail-entry.js`, `views/detail-parts.js`, `views/lightbox.js`
- **`util/directives.js`** imports: `util/images.js` (for `normalizeImageUrl`, `imageCanonicalId`), `util/sanitize.js` (for `cleanupHtml`, `stripMatches`)
- Most **`ui/*` modules** import `createElement` from `views/helpers.js`, the `util/*` modules they need, and in two cases a sibling: `header.js` mounts `share-button.js` and `subscribe-menu.js`, and `rsvp-form.js` reads `rsvp-state.js`. `ui/event-popover.js` is the only one that renders a card, through `layouts/registry.js` and `views/card-decoration.js`. A few also import a top-level module: `card-parts.js` and `tag-filter.js` import `composite.js`, `view-selector.js` imports `router.js`, and `event-popover.js` imports `theme.js` and `layouts/helpers.js`.
