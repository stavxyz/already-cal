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
  1. Directives — #already: tokens extracted and removed
  2. Images — image URLs, Drive links, Dropbox links extracted and removed
  3. Links — platform URLs extracted and removed
  4. Attachments — file URLs (.pdf, .doc, etc.) extracted and removed
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
Stored as data.events
  │
  ▼
Per render (on view switch, filter change, pagination, etc.):
  1. isPast filter — past events toggle
  2. hidden filter — removes event.hidden === true
  3. tag filter — tag pill selection (union/OR)
  4. sort + paginate (grid/list only)
  │
  ▼
View renderer
```

Data loading is in `src/data.js`. Enrichment helpers are in `src/util/` (directives.js, images.js, links.js, attachments.js). The `TokenSet` deduplication container is in `src/util/tokens.js`.

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
   - Renders the sticky header (calendar name, description, subscribe button) via `renderHeader(headerContainer, ...)` after data loads
   - Determines initial view via `getInitialView()` (priority: `initialEvent` > URL hash/path > localStorage > `defaultView`). On mobile, `mobileDefaultView` overrides if no hash is present.
   - Calls `renderView()` with the initial view state
   - Registers a `hashchange` listener via `onHashChange()`
6. Registers event listeners: `resize` (sticky offset recalculation) and `message` (postMessage API)
7. Returns the instance object with `setConfig()` and `destroy()` methods

### View Rendering

`renderView(viewState)` updates the UI using the persistent container structure:

1. Applies past/hidden/tag filters to produce the visible event list
2. Renders tag filter pills into tagFilterContainer (or clears it for detail view) via `tagFilter.render()`
3. Renders view selector tabs into selectorContainer (skipped for detail view) via `src/ui/view-selector.js`
4. Updates sticky offsets for the header/selector/tag-filter stack
5. Delegates to the view-specific renderer (`src/views/month.js`, `week.js`, `day.js`, `grid.js`, `list.js`, or `detail.js`) into viewContainer
6. For grid/list: applies pagination via `src/ui/pagination.js` into paginationTopContainer and paginationBottomContainer
7. Renders the past events toggle into toggleContainer via `src/ui/past-toggle.js` (only when past events exist; skipped for detail view)
8. Renders an empty state if no events match the current filters

Grid and list views use `getLayout(theme.layout)` from `src/layouts/registry.js` to get the card renderer. Month, week, and day views have their own rendering logic.

### Hash Routing

`src/router.js` manages view state via URL hash:

- `parseHash()` — reads `#event/{id}`, `#day/{date}`, or view names from the hash. Also checks the URL path for `/event/{id}` (server-side routing support).
- `getInitialView(defaultView, enabledViews, config)` — determines the first view to show. Priority: `config.initialEvent` > hash/path > localStorage > `config.defaultView`.
- `setView(view, config)` — updates the hash and saves to localStorage with key `{storageKeyPrefix}-view`.
- `setEventDetail(eventId)` — navigates to `#event/{eventId}`.
- `onHashChange(callback)` — registers a hashchange listener. Returns an unsubscribe function for cleanup.

## Theme System

`src/theme.js` manages all visual configuration.

### Theme Resolution

`resolveTheme(themeInput)` accepts either a string (layout shorthand) or an object:

- **Fixed keys** (validated against allowed values):
  - `layout` — any registered layout name; built-in: `"clean"`, `"hero"`, `"badge"`, `"compact"` (default: `"clean"`)
  - `palette` — `"light"` | `"dark"` | `"warm"` | `"cool"` (default: `"light"`)
  - `orientation` — `"vertical"` | `"horizontal"` (default: `"vertical"`, forced to `"vertical"` for compact layout)
  - `imagePosition` — `"left"` | `"right"` | `"alternating"` (default: `"left"`, only used when orientation is `"horizontal"`)

- **Open-ended keys** — anything else is collected as CSS custom property overrides (e.g. `primary: '#ff0000'` → `--already-primary: #ff0000`)

### Theme Application

`applyTheme(el, themeInput, previousOverrideKeys)`:

1. Calls `resolveTheme()` to get the normalized theme config
2. Sets data attributes on the mount element: `data-layout`, `data-orientation`, `data-image-position`, `data-palette`
3. Clears previous CSS custom property overrides (tracked via `previousOverrideKeys` array)
4. Applies new overrides: converts camelCase keys to `--already-kebab-case` and sets them as inline styles
5. Returns the resolved theme object plus the new `overrideKeys` array for future cleanup

Palette CSS files (`src/palettes/*.css`) define styles via `.already[data-palette="name"]` attribute selectors. The `.already` class scopes palette styles to the mount element. Setting `data-palette` activates the corresponding palette — no JavaScript re-render needed.

## Registry System

`src/registry.js` provides a generic, type-agnostic registry used for layouts (and future extensible types like theme bundles). Containers use `Object.create(null)` to avoid prototype pollution. The API:

- `defineType(type, validator)` — creates a new registry type with a validation function
- `registerBuiltIn(type, name, impl)` — registers a built-in entry (protected from override and duplication)
- `register(type, name, impl)` — registers a custom entry (throws if name collides with a built-in)
- `get(type, name, fallback)` — retrieves an entry, or returns `fallback`. Intentionally lenient on undefined types for graceful rendering fallback.
- `has(type, name)` — checks if a name is registered. Same lenient behavior as `get()`.

### Layout Registry

`src/layouts/registry.js` initializes the `"layout"` registry type and registers the four built-in layouts. It exports `getLayout(name)` which returns `clean` as fallback for unknown names.

- Built-in layouts: `clean`, `hero`, `badge`, `compact` — each in `src/layouts/{name}/{name}.js`
- Each layout module exports a render function: `(event, options) => HTMLElement` where `options` includes `orientation`, `imagePosition`, `index`, `timezone`, `locale`, and `config`
- Custom layouts are registered via `Already.registerLayout(name, renderFn)` which delegates to `register("layout", name, renderFn)`
- Built-in names are protected — attempting to register a custom layout with a built-in name throws an error

### Error Handling

`safeRenderCard()` in `src/layouts/helpers.js` wraps every layout render call in a try/catch. If a layout function throws or returns a non-`HTMLElement` value, an error card is rendered in place of the event and the error is logged via `console.error`. `decorateCard()` in `src/views/helpers.js` applies modifier classes (`--past`, `--featured`), `data-event-id`, and click bindings — but skips error cards entirely. An unrecognized layout name in `resolveTheme()` triggers a `console.warn` before falling back to `"clean"`.

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

- **`already-cal.js`** imports: `registry.js`, `data.js`, `router.js`, `theme.js`, all `views/*`, all `ui/*`
- **`data.js`** imports: `util/directives.js`, `util/images.js`, `util/links.js`, `util/attachments.js`, `util/description.js`, `util/tokens.js`
- **`theme.js`** imports: `registry.js`, `layouts/registry.js` (side-effect import for type initialization)
- **`layouts/registry.js`** imports: `registry.js`, all `layouts/{name}/{name}.js`
- **`layouts/helpers.js`** imports: `views/helpers.js` (createElement), `util/dates.js`; exports `safeRenderCard`, `renderErrorCard`
- **`views/helpers.js`** imports: `router.js`, `util/dates.js`; exports `decorateCard`, `bindEventClick`, `createElement`, etc.
- **`views/grid.js`** and **`views/list.js`** import: `layouts/helpers.js` (safeRenderCard), `layouts/registry.js`, `views/helpers.js` (decorateCard)
- **`views/detail.js`** imports: `views/lightbox.js`
- **`util/directives.js`** imports: `util/images.js` (for `normalizeImageUrl`, `imageCanonicalId`), `util/sanitize.js` (for `cleanupHtml`, `stripUrl`)
- **`ui/*` modules** are leaf nodes — they don't import from each other
