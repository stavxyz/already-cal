# Configuration Reference

Every option has a sensible default. Pass only what you need to `OgCal.init()`.

## Data Source Options

Provide exactly one data source.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `el` | `string \| HTMLElement` | *required* | CSS selector or DOM element to mount into |
| `data` | `object \| null` | `null` | Pre-loaded event data (og-cal schema or raw Google Calendar API JSON) |
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

Theme properties are applied as CSS custom properties on the `.ogcal` element:

| Theme Key | CSS Custom Property | Default | Description |
|-----------|-------------------|---------|-------------|
| `primary` | `--ogcal-primary` | `'#8B4513'` | Brand/accent color |
| `primaryText` | `--ogcal-primary-text` | `'#ffffff'` | Text color on primary backgrounds |
| `background` | `--ogcal-background` | `'#f5f0eb'` | Page/container background |
| `surface` | `--ogcal-surface` | `'#ffffff'` | Card and surface background |
| `text` | `--ogcal-text` | `'#1a1a1a'` | Primary text color |
| `textSecondary` | `--ogcal-text-secondary` | `'#666'` | Secondary/meta text color |
| `radius` | `--ogcal-radius` | `'8px'` | Border radius for all elements |
| `fontFamily` | `--ogcal-font-family` | `'system-ui, sans-serif'` | Font stack |

You can also override these directly in CSS:

```css
.ogcal {
  --ogcal-primary: #2563eb;
  --ogcal-radius: 12px;
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

## Responsive Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mobileBreakpoint` | `number` | `768` | Width in pixels below which mobile behavior activates |
| `mobileDefaultView` | `string` | `'list'` | Default view on mobile (when no hash is set) |
| `mobileHiddenViews` | `string[]` | `['week']` | Views hidden from the selector on mobile |

## Behavior Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `locationLinkTemplate` | `string` | `'https://maps.google.com/?q={location}'` | URL template for location links. `{location}` is replaced with the encoded location |
| `storageKeyPrefix` | `string` | `'ogcal'` | localStorage key prefix (set different values for multiple instances) |
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
  ...OgCal.DEFAULTS.knownPlatforms,
  { pattern: /your-site\.com/i, label: 'Visit Our Site' },
],
```

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

Hooks run during data loading, after enrichment. Order: `enrichEvent` → `eventTransform` → `eventFilter`.

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

## Data Attributes

All options can be set via HTML `data-` attributes for zero-JS setup.

| Attribute | Maps to | Type |
|-----------|---------|------|
| `data-og-cal` | Enables auto-init | flag (required) |
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
