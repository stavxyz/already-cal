# Configuration Reference

Every option has a sensible default. Pass only what you need to `Already.init()`.

## Data Source Options

Provide exactly one data source.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `el` | `string \| HTMLElement` | *required* | CSS selector or DOM element to mount into |
| `data` | `object \| null` | `null` | Pre-loaded event data (already-cal schema or raw Google Calendar API JSON) |
| `fetchUrl` | `string \| null` | `null` | URL to fetch event data from |
| `google` | `object \| null` | `null` | Google Calendar API config (see below) |

### `google` object

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | *required* | Google Calendar API key |
| `calendarId` | `string` | *required* | Calendar ID (usually `...@group.calendar.google.com`) |
| `maxResults` | `number` | `50` | Maximum events to fetch from the API |

## View Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultView` | `string` | `'month'` | Initial view: `'month'`, `'week'`, `'day'`, `'grid'`, or `'list'` |
| `views` | `string[]` | `['month', 'week', 'day', 'grid', 'list']` | Enabled views shown in the selector |
| `showPastEvents` | `boolean` | `false` | Show past events by default (visitors can toggle) |
| `maxEventsPerDay` | `number` | `3` | Month view: event chips shown per day before "+N more" |
| `initialEvent` | `string \| null` | `null` | Event ID to open in detail view on load |
| `pageSize` | `number` | `10` | Events per page in grid and list views (pagination) |

## Header Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `showHeader` | `boolean` | `true` | Show the calendar name, description, and subscribe button |
| `headerTitle` | `string \| null` | `null` | Override calendar name (otherwise uses `calendar.name` from data) |
| `headerDescription` | `string \| null` | `null` | Override calendar description |
| `headerIcon` | `string \| null` | `null` | URL to icon/logo image displayed in the header |
| `subscribeUrl` | `string \| null` | `null` | Subscribe button URL. Auto-generated from `google.calendarId` if not set |

The subscribe button appears when a URL is available. If the calendar description contains the word "subscribe", it's auto-linked to the subscribe URL.

## Theming

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `theme` | `object` | `{}` | Custom theme values merged with defaults |

Theme properties are applied as CSS custom properties on the `.already` element. Defaults shown below are for the `light` palette — other palettes override these values.

| Theme Key | CSS Custom Property | Default (light) | Description |
|-----------|-------------------|---------|-------------|
| `primary` | `--already-primary` | `'#8b4513'` | Brand/accent color |
| `primaryText` | `--already-primary-text` | `'#ffffff'` | Text color on primary backgrounds |
| `background` | `--already-background` | `'#f5f0eb'` | Page/container background |
| `surface` | `--already-surface` | `'#ffffff'` | Card and surface background |
| `text` | `--already-text` | `'#1a1a1a'` | Primary text color |
| `textSecondary` | `--already-text-secondary` | `'#666'` | Secondary/meta text color |
| `border` | `--already-border` | `'rgba(0, 0, 0, 0.06)'` | Border color |
| `fontFamily` | `--already-font-family` | `'system-ui, sans-serif'` | Font stack |
| `fontWeightNormal` | `--already-font-weight-normal` | `'400'` | Normal font weight |
| `fontWeightBold` | `--already-font-weight-bold` | `'700'` | Bold font weight |
| `fontSizeSm` | `--already-font-size-sm` | `'0.75rem'` | Small text size |
| `fontSizeBase` | `--already-font-size-base` | `'0.875rem'` | Base text size |
| `fontSizeLg` | `--already-font-size-lg` | `'0.9375rem'` | Large text size |
| `radius` | `--already-radius` | `'8px'` | Border radius |
| `radiusSm` | `--already-radius-sm` | `'6px'` | Small border radius (tags, badges) |
| `shadow` | `--already-shadow` | `'0 1px 3px rgba(0, 0, 0, 0.1)'` | Card shadow |
| `shadowHover` | `--already-shadow-hover` | `'0 4px 12px rgba(0, 0, 0, 0.12)'` | Card hover shadow |
| `highlight` | `--already-highlight` | `'rgba(139, 69, 19, 0.06)'` | Subtle highlight for today cells, hover states |
| `spacing` | `--already-spacing` | `'1rem'` | Base spacing unit |

You can also override these directly in CSS:

```css
.already {
  --already-primary: #2563eb;
  --already-radius: 12px;
}
```

## Locale & Internationalization

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `locale` | `string` | `navigator.language \|\| 'en-US'` | Locale for `Intl.DateTimeFormat` |
| `weekStartDay` | `number` | `0` | Week start day (0=Sunday through 6=Saturday) |
| `i18n` | `object` | `{}` | UI string overrides (merged with defaults) |

### i18n keys

| Key | Default | Used in |
|-----|---------|---------|
| `viewLabels` | `{ month: 'Month', week: 'Week', day: 'Day', grid: 'Grid', list: 'List' }` | View selector tabs |
| `noUpcomingEvents` | `'No upcoming events.'` | Empty state |
| `showPastEvents` | `'Show past events'` | Past toggle button |
| `hidePastEvents` | `'Hide past events'` | Past toggle button |
| `couldNotLoad` | `'Could not load events.'` | Error state |
| `retry` | `'Retry'` | Error state button |
| `allDay` | `'All Day'` | Day and list views |
| `noEventsThisDay` | `'No events this day.'` | Day view empty state |
| `back` | `'← Back'` | Detail view back button |
| `moreEvents` | `'+{count} more'` | Month view overflow (`{count}` is replaced) |
| `subscribe` | `'Subscribe'` | Header subscribe button |
| `clearFilter` | `'Clear'` | Tag filter clear button |
| `loadMore` | `'Load more'` | Pagination button (grid/list) |
| `showEarlier` | `'Show earlier'` | Pagination button (grid/list) |

## Responsive Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mobileBreakpoint` | `number` | `768` | Width in pixels below which mobile behavior activates |
| `mobileDefaultView` | `string` | `'list'` | Default view on mobile (when no hash is set) |
| `mobileHiddenViews` | `string[]` | `['week']` | Views hidden from the selector on mobile |

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

## Behavior Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `locationLinkTemplate` | `string` | `'https://maps.google.com/?q={location}'` | URL template for location links. `{location}` is replaced with the encoded location |
| `storageKeyPrefix` | `string` | `'already'` | localStorage key prefix (set different values for multiple instances) |
| `imageExtensions` | `string[] \| null` | `null` | Image file extensions to detect in descriptions. `null` uses defaults: `['png', 'jpg', 'jpeg', 'gif', 'webp']` |

## Link Extraction

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `knownPlatforms` | `platform[]` | `DEFAULT_PLATFORMS` | Platform patterns for URL auto-detection |

Each platform object has:

```js
{
  pattern: /regex/i,                  // matches URLs
  label: 'Static Label',             // OR:
  labelFn: (url) => 'Dynamic Label', // generate label from URL
}
```

Extend the defaults:

```js
knownPlatforms: [
  ...Already.DEFAULTS.knownPlatforms,
  { pattern: /your-site\.com/i, label: 'Visit Our Site' },
],
```

### `Already.DEFAULTS`

The full default config object is exported as `Already.DEFAULTS`. The example above shows the typical usage pattern — spread the defaults into a new array to extend without replacing built-in entries.

`Already.DEFAULTS` should be treated as read-only. Mutating it directly (e.g. `Already.DEFAULTS.knownPlatforms.push(...)`) may affect future `init()` calls — always spread into a new array rather than modifying in place.

## Sanitization

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sanitization` | `object \| null` | `null` | Custom HTML sanitization rules. `null` uses defaults |

```js
sanitization: {
  allowedTags: ['p', 'a', 'strong', 'em', 'ul', 'ol', 'li', 'br', 'img',
                'blockquote', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
  allowedAttrs: { a: ['href', 'target'], img: ['src', 'alt'] },
}
```

## Callbacks

### `onEventClick(event, viewName)`

Called when an event is clicked in any view.

- `event` — the [event object](event-schema.md)
- `viewName` — `'month'`, `'week'`, `'day'`, `'grid'`, `'list'`, or `'detail'`
- **Return `false`** to prevent navigation to the detail view
- Return anything else (or nothing) to allow default navigation

```js
onEventClick: (event, view) => {
  console.log(`Clicked ${event.title} in ${view} view`);
  // return false; // would prevent navigation
},
```

### `onViewChange(newView, oldView)`

Called when the active view changes. Not called for detail view.

```js
onViewChange: (newView, oldView) => {
  analytics.track('view_change', { from: oldView, to: newView });
},
```

### `onDataLoad(data)`

Called after data loads successfully, before any views render.

- `data` — `{ events: [...], calendar: { name, description, timezone } }`

```js
onDataLoad: (data) => {
  console.log(`Loaded ${data.events.length} events`);
},
```

### `onError(error)`

Called when data loading fails.

```js
onError: (err) => {
  myErrorReporter.capture(err);
},
```

## Data Hooks

Hooks run during data loading. The full pipeline order is: `enrichEvent()` (internal — extracts directives, images, links, attachments, tags) → `eventTransform()` (your hook) → `eventFilter()` (your hook). Both `eventTransform` and `eventFilter` receive fully enriched [event objects](event-schema.md).

### `eventTransform(event) → event`

Mutate or replace each event before filtering. Receives the enriched [event object](event-schema.md).

```js
eventTransform: (event) => ({
  ...event,
  title: event.title.toUpperCase(),
}),
```

### `eventFilter(event) → boolean`

Return `true` to keep, `false` to exclude. Runs after `eventTransform`.

```js
eventFilter: (event) => !event.title.includes('[INTERNAL]'),
```

## Custom Themes

Theme bundles package a layout, palette/orientation defaults, constraints, and CSS custom property overrides into a single reusable unit that can be referenced by name anywhere a theme is accepted.

### `Already.registerTheme(name, bundle)`

Register a named theme bundle.

- **`name`** — non-empty string. Built-in names (`clean`, `hero`, `badge`, `compact`) cannot be overridden — throws.
- **`bundle`** — plain object with any combination of `layout`, `defaults`, `constraints`, and `overrides`. Unknown keys throw.

```js
Already.registerTheme("timeline", {
  layout: (event, options) => {
    const card = document.createElement("div");
    card.className = "already-card already-card--timeline";
    const title = document.createElement("div");
    title.className = "already-card__title";
    title.textContent = event.title;
    card.appendChild(title);
    const meta = document.createElement("div");
    meta.className = "already-card__meta";
    meta.textContent = new Date(event.start).toLocaleDateString(options.locale);
    card.appendChild(meta);
    return card;
  },
  defaults: { orientation: "vertical", imagePosition: "left", palette: "light" },
  constraints: { orientation: "vertical" },
  overrides: { primary: "#2563eb", fontSizeSm: "0.7rem" },
});

Already.init({ el: "#cal", theme: "timeline" });
```

### Bundle shape

| Key | Type | Description |
|-----|------|-------------|
| `layout` | function or string | Render function (auto-registered as a layout under the theme name), or name of an existing registered layout. Optional — if omitted, uses the user's layout choice or the default `"clean"`. |
| `defaults` | object | Default values for `orientation`, `imagePosition`, and/or `palette`. Applied when the user does not provide that dimension. |
| `constraints` | object | Enforced values for `orientation`, `imagePosition`, and/or `palette`. The user cannot override these — a conflict throws (from `init()`) or logs via `console.error` (from `setConfig()`). |
| `overrides` | object | CSS custom property values. Keys are camelCase and become `--already-{kebab-case}` inline styles on the mount element. |

Valid dimension values:
- `orientation`: `"vertical"`, `"horizontal"`
- `imagePosition`: `"left"`, `"right"`, `"alternating"`
- `palette`: `"light"`, `"dark"`, `"warm"`, `"cool"`

### String shorthand

When `theme` is a string (e.g., `theme: "timeline"`), the name is looked up in the bundle registry first. If a bundle exists, its layout, defaults, constraints, and overrides are applied. If no bundle is found, the name is treated as a layout name and looked up in the layout registry. If neither registry has it, the layout falls back to `"clean"` with a `console.warn`.

The same bundle lookup applies when `theme` is an object — if `theme.layout` names a registered bundle, that bundle's defaults, constraints, and overrides are applied (e.g., `theme: { layout: "timeline", palette: "dark" }`).

### Priority chain

Each dimension (`orientation`, `imagePosition`, `palette`) is resolved in this order:

```
constraint (enforced, throws/logs if user contradicts)
  > user-provided value
    > bundle default
      > THEME_DEFAULTS (vertical, left, light)
```

Note: `imagePosition`'s resolved value is forced to `"left"` in vertical orientation regardless of constraints or defaults. However, constraint violations are still enforced — passing a value that conflicts with an `imagePosition` constraint will still throw, even in vertical orientation.

### CSS overrides

User CSS overrides win over bundle overrides — they are merged, with user values taking precedence:

```js
// Bundle defines: overrides: { primary: "#2563eb" }
// User provides:  theme: { primary: "#e63946" }
// Result:         --already-primary: #e63946 (user wins)
```

### Error handling

- **`init()`** — renders a minimal error message in the container element (not the configurable `renderError` state) and also throws. Use a try/catch if you want to handle it programmatically.
- **`setConfig()`** — logs the full error (with stack trace) via `console.error` and leaves the current theme unchanged.

### `Already.THEMES`

A frozen snapshot of all registered theme bundles (built-in and custom). Updated each time `registerTheme()` is called. Returns copies, not live references.

```js
console.log(Already.THEMES);
// {
//   clean: { layout: "clean" },
//   hero: { layout: "hero" },
//   badge: { layout: "badge" },
//   compact: { layout: "compact", constraints: { orientation: "vertical" } },
//   timeline: { layout: "timeline", defaults: {...}, constraints: {...}, overrides: {...} },
// }
```

### Auto-registration of layout functions

When `bundle.layout` is a render function, it is automatically registered in the layout registry under the theme name. You do not need to call `Already.registerLayout()` separately:

```js
// These are equivalent:

// Option A: registerTheme with inline function (auto-registers layout)
Already.registerTheme("timeline", { layout: myRenderFn, ... });

// Option B: register layout first, then reference by name
Already.registerLayout("timeline", myRenderFn);
Already.registerTheme("timeline", { layout: "timeline", ... });
```

### Re-registration

Custom themes can be re-registered (replacing the previous bundle). Built-in theme names (`clean`, `hero`, `badge`, `compact`) cannot be re-registered — throws.

## Custom Layouts

Register custom card layouts via `Already.registerLayout(name, renderFn)`. The render function receives an event object and an options object, and must return an `HTMLElement`.

```js
Already.registerLayout('timeline', (event, options) => {
  const card = document.createElement('div');
  card.className = 'already-card already-card--timeline';

  const title = document.createElement('div');
  title.className = 'already-card__title';
  title.textContent = event.title;
  card.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'already-card__meta';
  meta.textContent = new Date(event.start).toLocaleDateString(options.locale);
  card.appendChild(meta);

  return card;
});

Already.init({
  el: '#cal',
  theme: { layout: 'timeline' },
  // ...
});
```

### Render function signature

```
(event, options) => HTMLElement
```

**`event`** — the enriched [event object](event-schema.md)

**`options`** object:

| Key | Type | Description |
|-----|------|-------------|
| `orientation` | `string` | `"vertical"` or `"horizontal"`. In list view, defaults to `"horizontal"` regardless of theme setting (except for compact layout). |
| `imagePosition` | `string` | `"left"`, `"right"`, or `"alternating"` |
| `index` | `number` | Zero-based index of this event in the current view |
| `timezone` | `string` | Calendar timezone (e.g. `"America/Chicago"`) |
| `locale` | `string` | Locale string (e.g. `"en-US"`) |
| `config` | `object` | Full config object |

### Rules

- **Name** must be a non-empty string. Built-in names (`clean`, `hero`, `badge`, `compact`) cannot be overridden — an error is thrown.
- **Return type** must be `HTMLElement`. If the function throws or returns something else, an error card is rendered in place of the event and the error is logged via `console.error`.
- **Registration timing** — call `registerLayout()` before or after `init()`. Layouts registered after `init()` take effect on the next view render (e.g. after `setConfig()` or view switch).
- **Re-registration** — registering the same custom name again replaces the previous function.

## Custom Renderers

Override the default loading, empty, and error states. Return an HTML string, `HTMLElement`, or `DocumentFragment`.

### `renderLoading()`

```js
renderLoading: () => '<div class="my-spinner">Loading...</div>',
```

### `renderEmpty({ hasPastEvents })`

- `hasPastEvents` — `true` if there are past events hidden by the toggle

```js
renderEmpty: ({ hasPastEvents }) => {
  const el = document.createElement('div');
  el.textContent = 'Nothing coming up.';
  if (hasPastEvents) {
    el.textContent += ' Check past events?';
  }
  return el;
},
```

### `renderError({ message })`

- `message` — the error message string

```js
renderError: ({ message }) => `<div class="my-error">${message}</div>`,
```

## Runtime Updates

### `instance.setConfig(config)`

Update config on a live instance without reinitializing. Accepts a partial config object — only provided keys are updated.

```js
const cal = Already.init({ el: '#cal', ... });
cal.setConfig({ theme: { palette: 'dark' } });
```

| Config key | Update behavior |
|-----------|----------------|
| `theme.palette` | Instant — updates the `data-palette` HTML attribute (CSS palette rules activate immediately) |
| `theme.layout` | Re-renders current view with new card layout |
| `theme.orientation` | Re-renders current view |
| `theme.imagePosition` | Re-renders current view |
| CSS overrides (e.g. `theme.primary`) | Instant — sets CSS custom property |
| `views` | Re-renders view selector. Must be a non-empty array. |
| `showPastEvents` | Re-renders with updated filter |
| `pageSize` | Re-renders with new pagination. Must be a positive finite number. |
| `defaultView` | Switches to the specified view and re-renders. Must be in the `views` array. |

Previous CSS overrides are automatically cleared when a new theme is applied. Invalid values are logged via `console.warn` and ignored.

### `Already.setConfig(config)`

Global convenience method — delegates to the last-created instance. Designed for single-instance use; in multi-instance setups, only the most recently created instance is affected. Logs a warning if no instance exists.

### Cross-origin updates via `postMessage`

When already-cal is embedded in an iframe, the parent page can update config via `postMessage`:

```js
iframe.contentWindow.postMessage({
  type: 'already:config',
  config: { theme: { palette: 'dark' } }
}, '*');
```

The `"already:config"` type prefix is required. Messages without it are silently ignored. The `config` object has the same shape as the `setConfig()` argument. The accepted config keys are purely presentational, so no origin check is performed.

### `instance.destroy()`

Removes all event listeners (`resize`, `postMessage`, `hashchange`), clears the mount element's innerHTML, removes the `already` CSS class, data attributes, and CSS custom property overrides. If the instance is the current `_instance`, it is set to `null`. Calling `setConfig()` after `destroy()` is a safe no-op.

```js
cal.destroy();
```

## Data Attributes

The most common options are available as HTML `data-` attributes for zero-JS setup. Options not listed here — including `showHeader`, `headerTitle`, `headerDescription`, `headerIcon`, `subscribeUrl`, `pageSize`, `sticky`, `initialEvent`, `imageExtensions`, `knownPlatforms`, `sanitization`, `i18n`, `data`, callbacks, data hooks, and custom renderers — require JavaScript initialization.

| Attribute | Maps to | Type |
|-----------|---------|------|
| `data-already-cal` | Enables auto-init | flag (required) |
| `data-api-key` | `google.apiKey` | string |
| `data-calendar-id` | `google.calendarId` | string |
| `data-max-results` | `google.maxResults` | integer |
| `data-fetch-url` | `fetchUrl` | string |
| `data-default-view` | `defaultView` | string |
| `data-views` | `views` | comma-separated |
| `data-locale` | `locale` | string |
| `data-week-start-day` | `weekStartDay` | integer |
| `data-show-past-events` | `showPastEvents` | `"true"` or `"false"` |
| `data-mobile-breakpoint` | `mobileBreakpoint` | integer |
| `data-mobile-default-view` | `mobileDefaultView` | string |
| `data-mobile-hidden-views` | `mobileHiddenViews` | comma-separated |
| `data-max-events-per-day` | `maxEventsPerDay` | integer |
| `data-location-link-template` | `locationLinkTemplate` | string |
| `data-storage-key-prefix` | `storageKeyPrefix` | string |
| `data-theme-*` | `theme.*` | string (e.g. `data-theme-primary="#333"`) |
