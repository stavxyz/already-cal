# og-cal

Open-source Google Calendar event display. Drop it on any website.

Six views — month, week, day, grid, list, and event detail — with hash routing, responsive design, and full theming. Zero framework dependencies.

## Quick Start

### Zero JavaScript (data attributes)

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/stavxyz/og-cal@main/dist/og-cal.min.css">
<script src="https://cdn.jsdelivr.net/gh/stavxyz/og-cal@main/dist/og-cal.min.js"></script>

<div data-og-cal
     data-api-key="YOUR_GOOGLE_API_KEY"
     data-calendar-id="YOUR_CALENDAR_ID@group.calendar.google.com"
     data-default-view="month"
     data-theme-primary="#8B4513"
     data-theme-font-family="'Georgia', serif">
</div>
```

That's it. No `<script>` init call needed. og-cal auto-detects elements with `data-og-cal` and initializes them.

### JavaScript

```html
<div id="cal"></div>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/stavxyz/og-cal@main/dist/og-cal.min.css">
<script src="https://cdn.jsdelivr.net/gh/stavxyz/og-cal@main/dist/og-cal.min.js"></script>
<script>
OgCal.init({
  el: '#cal',
  google: {
    apiKey: 'YOUR_GOOGLE_API_KEY',
    calendarId: 'YOUR_CALENDAR_ID@group.calendar.google.com',
  },
});
</script>
```

## Data Modes

### 1. Pre-loaded data (recommended for production)

Embed event data as JSON server-side. The API key stays on your server.

```js
OgCal.init({
  el: '#cal',
  data: {
    events: [/* og-cal schema */],
    calendar: { name: 'My Calendar', timezone: 'America/Chicago' },
    generated: new Date().toISOString(),
  },
});
```

### 2. Fetch URL

Point og-cal at your own API endpoint that returns og-cal schema JSON.

```js
OgCal.init({
  el: '#cal',
  fetchUrl: 'https://your-api.com/events',
});
```

### 3. Direct Google Calendar API

og-cal fetches from Google Calendar API v3 client-side. The API key is visible in page source — restrict it to the Calendar API and lock it to your domain in the Google Cloud Console.

```js
OgCal.init({
  el: '#cal',
  google: {
    apiKey: 'YOUR_API_KEY',
    calendarId: 'YOUR_CALENDAR_ID',
    maxResults: 50,           // default 50
  },
});
```

## Views

| View | Hash Route | Description |
|------|-----------|-------------|
| Month | `#month` | Calendar grid with event chips |
| Week | `#week` | 7-column layout |
| Day | `#day` or `#day/2026-04-04` | Single day events |
| Grid | `#grid` | Card layout with flyer images |
| List | `#list` | Compact chronological list |
| Detail | `#event/<id>` | Full event page |

The view selector bar lets visitors switch between views. Selection is saved in localStorage.

## Configuration

Every option has a sensible default. Pass only what you want to customize.

```js
OgCal.init({
  // --- Required ---
  el: '#cal',                          // CSS selector or DOM element

  // --- Data (pick one) ---
  data: { /* og-cal schema */ },       // pre-loaded
  fetchUrl: 'https://...',             // fetch from URL
  google: { apiKey, calendarId },      // Google Calendar API

  // --- Views ---
  defaultView: 'month',               // initial view
  views: ['month', 'week', 'day', 'grid', 'list'],
  showPastEvents: false,               // toggle-able by visitors

  // --- Locale & i18n ---
  locale: 'en-US',                     // default: navigator.language
  weekStartDay: 0,                     // 0=Sunday, 1=Monday, ...6=Saturday
  i18n: {
    viewLabels: { month: 'Month', week: 'Week', day: 'Day', grid: 'Grid', list: 'List' },
    noUpcomingEvents: 'No upcoming events.',
    showPastEvents: 'Show past events',
    hidePastEvents: 'Hide past events',
    couldNotLoad: 'Could not load events.',
    retry: 'Retry',
    allDay: 'All Day',
    noEventsThisDay: 'No events this day.',
    back: '← Back',
    moreEvents: '+{count} more',       // {count} is replaced with the number
  },

  // --- Theming ---
  theme: {
    primary: '#8B4513',
    primaryText: '#ffffff',
    background: '#f5f0eb',
    surface: '#ffffff',
    text: '#1a1a1a',
    textSecondary: '#666',
    radius: '8px',
    fontFamily: 'system-ui, sans-serif',
  },

  // --- Responsive ---
  mobileBreakpoint: 768,              // px
  mobileDefaultView: 'list',          // view on small screens
  mobileHiddenViews: ['week'],        // views hidden on mobile

  // --- Behavior ---
  maxEventsPerDay: 3,                  // month view chips before "+N more"
  locationLinkTemplate: 'https://maps.google.com/?q={location}',
  storageKeyPrefix: 'ogcal',          // localStorage key prefix (for multiple instances)
  imageExtensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'],

  // --- Link extraction ---
  knownPlatforms: [
    { pattern: /eventbrite\.com/i, label: 'RSVP on Eventbrite' },
    { pattern: /docs\.google\.com\/forms/i, label: 'Fill Out Form' },
    { pattern: /goo\.gl\/maps|maps\.app\.goo\.gl|google\.com\/maps/i, label: 'View on Map' },
    { pattern: /zoom\.us/i, label: 'Join Zoom' },
    { pattern: /meet\.google\.com/i, label: 'Join Google Meet' },
    // Add your own:
    // { pattern: /lu\.ma/i, label: 'RSVP on Luma' },
  ],

  // --- Sanitization ---
  sanitization: {
    allowedTags: ['p','a','strong','em','ul','ol','li','br','img','blockquote','code','pre','h1','h2','h3','h4','h5','h6'],
    allowedAttrs: { a: ['href','target'], img: ['src','alt'] },
  },

  // --- Callbacks ---
  onEventClick: (event, view) => {},   // return false to prevent navigation
  onViewChange: (newView, oldView) => {},
  onDataLoad: (data) => {},
  onError: (error) => {},

  // --- Data hooks ---
  eventFilter: (event) => true,        // filter events before display
  eventTransform: (event) => event,    // transform events after loading

  // --- Custom renderers ---
  renderEmpty: null,     // (hasPastEvents) => '<div>...</div>' or DOM element
  renderLoading: null,   // () => '<div>...</div>' or DOM element
  renderError: null,     // (error) => '<div>...</div>' or DOM element
});
```

### Data attributes

All config options can be set via HTML `data-` attributes for zero-JS setup:

| Attribute | Maps to |
|-----------|---------|
| `data-og-cal` | Enables auto-init (required) |
| `data-api-key` | `google.apiKey` |
| `data-calendar-id` | `google.calendarId` |
| `data-fetch-url` | `fetchUrl` |
| `data-default-view` | `defaultView` |
| `data-views` | `views` (comma-separated: `"month,week,list"`) |
| `data-locale` | `locale` |
| `data-week-start-day` | `weekStartDay` |
| `data-show-past-events` | `showPastEvents` (`"true"`) |
| `data-mobile-breakpoint` | `mobileBreakpoint` |
| `data-mobile-default-view` | `mobileDefaultView` |
| `data-max-events-per-day` | `maxEventsPerDay` |
| `data-storage-key-prefix` | `storageKeyPrefix` |
| `data-theme-primary` | `theme.primary` |
| `data-theme-primary-text` | `theme.primaryText` |
| `data-theme-background` | `theme.background` |
| `data-theme-surface` | `theme.surface` |
| `data-theme-text` | `theme.text` |
| `data-theme-text-secondary` | `theme.textSecondary` |
| `data-theme-radius` | `theme.radius` |
| `data-theme-font-family` | `theme.fontFamily` |

## Event Schema

og-cal consumes this JSON format from any source:

```json
{
  "events": [
    {
      "id": "abc123",
      "title": "Community Rally",
      "description": "<p>Join us!</p>",
      "descriptionFormat": "html",
      "location": "City Hall, Austin, TX",
      "start": "2026-04-04T16:00:00-05:00",
      "end": "2026-04-04T19:00:00-05:00",
      "allDay": false,
      "image": "https://example.com/flyer.png",
      "links": [
        { "label": "RSVP on Eventbrite", "url": "https://eventbrite.com/..." }
      ],
      "attachments": []
    }
  ],
  "calendar": {
    "name": "My Calendar",
    "timezone": "America/Chicago"
  },
  "generated": "2026-03-18T20:00:00Z"
}
```

### Smart description rendering

Descriptions are auto-detected and rendered:
- **HTML** — sanitized with configurable allowlist and rendered
- **Markdown** — parsed with [marked](https://github.com/markedjs/marked) and sanitized
- **Plain text** — escaped with line breaks preserved

### Event images

og-cal looks for a thumbnail image in this order:

1. **Image URL in description** — the first URL ending in `.png`, `.jpg`, `.gif`, `.webp` (or configured `imageExtensions`) is extracted from the description and used as the thumbnail. The URL is removed from the rendered description to avoid duplication.

2. **Google Calendar attachment** — if no image URL is found in the description, og-cal checks the event's `attachments` for the first `image/*` MIME type and uses its `fileUrl`. Attachments can be added via the Google Calendar API:

   ```python
   service.events().update(
     calendarId=CALENDAR_ID,
     eventId=event_id,
     body={**event, 'attachments': [{
       'fileUrl': 'https://example.com/poster.png',
       'title': 'Event Poster',
       'mimeType': 'image/png',
     }]},
     supportsAttachments=True,
   ).execute()
   ```

   Note: attachments can reference any public URL — they don't have to be Google Drive files.

3. **No image** — grid view shows a placeholder; detail view shows no image header.

Images display with `object-fit: contain` in detail view (full image visible) and `object-fit: cover` in grid view (cropped to 16:9 cards).

### Link extraction

URLs matching `knownPlatforms` patterns are extracted from descriptions and rendered as action buttons. Add your own platforms:

```js
OgCal.init({
  knownPlatforms: [
    ...OgCal.DEFAULTS?.knownPlatforms || [],
    { pattern: /lu\.ma/i, label: 'RSVP on Luma' },
    { pattern: /discord\.gg/i, label: 'Join Discord' },
  ],
});
```

## Callbacks

```js
OgCal.init({
  el: '#cal',
  google: { apiKey: '...', calendarId: '...' },

  // Custom click behavior (return false to prevent navigation to detail view)
  onEventClick: (event, view) => {
    if (event.links.length) {
      window.open(event.links[0].url);
      return false;
    }
  },

  // Track view changes
  onViewChange: (newView, oldView) => {
    analytics.track('calendar_view_change', { from: oldView, to: newView });
  },

  // Post-load processing
  onDataLoad: (data) => {
    console.log(`Loaded ${data.events.length} events`);
  },

  // Custom error handling
  onError: (error) => {
    Sentry.captureException(error);
  },

  // Filter events (e.g. only show events with images)
  eventFilter: (event) => event.image !== null,

  // Transform events after loading (e.g. add computed fields)
  eventTransform: (event) => ({
    ...event,
    title: event.title.toUpperCase(),
  }),
});
```

## Responsive Design

Breakpoints and mobile behavior are configurable:

```js
OgCal.init({
  mobileBreakpoint: 768,          // default
  mobileDefaultView: 'list',      // what mobile users see first
  mobileHiddenViews: ['week'],    // hide complex views on small screens
});
```

Defaults:
- **Desktop (>1024px)** — all views, full grid layouts
- **Tablet (768–1024px)** — condensed month view, 2-column grid
- **Mobile (<768px)** — defaults to list view, single-column grid, week view hidden

## Multiple Instances

Use `storageKeyPrefix` to avoid localStorage collisions:

```html
<div id="events-a"></div>
<div id="events-b"></div>
<script>
OgCal.init({ el: '#events-a', storageKeyPrefix: 'cal-a', ... });
OgCal.init({ el: '#events-b', storageKeyPrefix: 'cal-b', ... });
</script>
```

## Internationalization

og-cal respects the browser's locale by default. Override with `locale` and `i18n`:

```js
OgCal.init({
  locale: 'es',
  weekStartDay: 1,  // Monday
  i18n: {
    viewLabels: { month: 'Mes', week: 'Semana', day: 'Dia', grid: 'Cuadricula', list: 'Lista' },
    noUpcomingEvents: 'No hay eventos proximos.',
    showPastEvents: 'Mostrar eventos pasados',
    hidePastEvents: 'Ocultar eventos pasados',
    couldNotLoad: 'No se pudieron cargar los eventos.',
    retry: 'Reintentar',
    allDay: 'Todo el dia',
    noEventsThisDay: 'No hay eventos hoy.',
    back: '← Volver',
    moreEvents: '+{count} mas',
  },
});
```

Day names, month names, and date/time formatting all use `Intl.DateTimeFormat` with the configured locale automatically.

## Development

```bash
npm install
npm run build     # build to dist/
npm run dev       # watch mode
npm test          # run tests
open dev.html     # local preview with mock data
```

## Built with

- Vanilla JavaScript (no framework)
- [esbuild](https://esbuild.github.io/) for bundling
- [marked](https://github.com/markedjs/marked) for markdown (bundled)
- CSS custom properties for theming
- `Intl.DateTimeFormat` for locale-aware, timezone-correct formatting

## License

[AGPL-3.0](LICENSE)
