# og-cal

Open-source Google Calendar event display. Drop it on any website.

Six views — month, week, day, grid, list, and event detail — with hash routing, responsive design, and full theming. Zero framework dependencies.

**Live example:** [nobigbendwall.org/event-calendar/](https://nobigbendwall.org/event-calendar/)

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
| Detail | `#event/<id>` | Two-column layout with image gallery + event info |

The view selector bar lets visitors switch between views. Selection is saved in localStorage.

Detail view uses a **two-column layout** when an event has images: gallery on the left, event details on the right. Stacks vertically on mobile.

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
  // 18 built-in platforms: Eventbrite, Google Forms, Google Maps, Zoom,
  // Google Meet, Instagram, Facebook, X/Twitter, Reddit, YouTube, TikTok,
  // LinkedIn, Discord, Luma, Mobilize, Action Network, GoFundMe, Partiful.
  // Social platforms auto-detect handles from URLs:
  //   "https://instagram.com/savebigbend" → "Follow @savebigbend on Instagram"
  // Extend the defaults or override entirely:
  knownPlatforms: [
    ...OgCal.DEFAULTS.knownPlatforms,
    { pattern: /your-site\.com/i, label: 'Visit Our Site' },
    { pattern: /custom\.app/i, labelFn: (url) => `Open ${new URL(url).pathname}` },
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

og-cal consumes this JSON format from any source. Most fields are optional — og-cal auto-enriches events by extracting images, links, and format from descriptions.

**Minimal input** (what you need to provide):

```json
{
  "events": [
    {
      "id": "abc123",
      "title": "Community Rally",
      "description": "Join us! https://example.com/flyer.png\n\nhttps://eventbrite.com/e/rally-123",
      "location": "City Hall, Austin, TX",
      "start": "2026-04-04T16:00:00-05:00",
      "end": "2026-04-04T19:00:00-05:00",
      "allDay": false,
      "attachments": [
        { "url": "https://example.com/photo.jpg", "mimeType": "image/jpeg" }
      ]
    }
  ],
  "calendar": {
    "name": "My Calendar",
    "timezone": "America/Chicago"
  },
  "generated": "2026-03-18T20:00:00Z"
}
```

**After auto-enrichment**, og-cal adds these fields internally:

| Field | Source |
|-------|--------|
| `image` | First image URL from description, or first `image/*` attachment |
| `images` | All image URLs (description + attachments), in order |
| `links` | Platform URLs extracted from description (Eventbrite, Instagram, etc.) |
| `descriptionFormat` | Auto-detected: `html`, `markdown`, or `plain` |

The description is cleaned up — extracted image URLs and platform links are removed from the rendered text so they don't show as raw URLs.

### Smart description rendering

Descriptions are auto-detected and rendered:
- **HTML** — sanitized with configurable allowlist and rendered
- **Markdown** — parsed with [marked](https://github.com/markedjs/marked) and sanitized
- **Plain text** — escaped with line breaks preserved

### Event images

og-cal extracts **all** image URLs from descriptions and attachments, building an `images` array. The first image is the primary thumbnail (used in grid/list views). In detail view, multiple images display as a **gallery** with ← → navigation and keyboard support.

Image sources (combined in order):

1. **Image URLs in description** — all URLs ending in `.png`, `.jpg`, `.gif`, `.webp` (or configured `imageExtensions`) are extracted from the description and removed from the rendered text. The first one becomes the primary image.

2. **Google Calendar attachments** — og-cal checks the event's `attachments` for all `image/*` MIME types and appends them after description images. Attachments can point to any public URL — they don't have to be Google Drive files.

   To add an image attachment programmatically, use the [Google Calendar API](https://developers.google.com/calendar/api/v3/reference/events/update) with a service account or OAuth2 credentials:

   **Python** (using `google-api-python-client`):
   ```python
   from google.oauth2 import service_account
   from googleapiclient.discovery import build

   creds = service_account.Credentials.from_service_account_file(
       'service-account-key.json',
       scopes=['https://www.googleapis.com/auth/calendar'],
   )
   service = build('calendar', 'v3', credentials=creds)

   # Fetch the event, add an attachment, and update
   event = service.events().get(calendarId=CALENDAR_ID, eventId=EVENT_ID).execute()
   event['attachments'] = [{
       'fileUrl': 'https://example.com/poster.png',
       'title': 'Event Poster',
       'mimeType': 'image/png',
   }]
   service.events().update(
       calendarId=CALENDAR_ID,
       eventId=EVENT_ID,
       body=event,
       supportsAttachments=True,
   ).execute()
   ```

   **JavaScript** (using `googleapis` npm package):
   ```js
   const { google } = require('googleapis');
   const auth = new google.auth.GoogleAuth({
     keyFile: 'service-account-key.json',
     scopes: ['https://www.googleapis.com/auth/calendar'],
   });
   const calendar = google.calendar({ version: 'v3', auth });

   const { data: event } = await calendar.events.get({
     calendarId: CALENDAR_ID, eventId: EVENT_ID,
   });
   event.attachments = [{
     fileUrl: 'https://example.com/poster.png',
     title: 'Event Poster',
     mimeType: 'image/png',
   }];
   await calendar.events.update({
     calendarId: CALENDAR_ID, eventId: EVENT_ID,
     requestBody: event, supportsAttachments: true,
   });
   ```

3. **No image** — grid view shows a placeholder; detail view shows no image column.

Images display with `object-fit: contain` in the detail gallery (full image visible) and `object-fit: cover` in grid view (cropped to 16:9 cards). The gallery supports keyboard navigation (← → arrow keys).

### Automatic enrichment

og-cal enriches events from **all data sources** — not just Google API mode. If you provide pre-loaded data or use a fetch URL, og-cal will still:
- Extract image URLs from descriptions
- Extract platform links from descriptions (even when wrapped in `<a>` tags)
- Detect description format (HTML, markdown, plain text)
- Check attachments for image thumbnails

This means your server-side code can pass raw event data without duplicating extraction logic.

### Link extraction

URLs matching `knownPlatforms` patterns are extracted from descriptions and rendered as action buttons. Built-in platforms:

| Platform | Example label |
|----------|--------------|
| Eventbrite | RSVP on Eventbrite |
| Google Forms | Fill Out Form |
| Google Maps | View on Map |
| Zoom | Join Zoom |
| Google Meet | Join Google Meet |
| Instagram | Follow @savebigbend on Instagram |
| Facebook | savebigbend on Facebook |
| X / Twitter | Follow @savebigbend on X |
| Reddit | r/BigBend on Reddit |
| YouTube | Watch on YouTube |
| TikTok | @savebigbend on TikTok |
| LinkedIn | View on LinkedIn |
| Discord | Join Discord |
| Luma | RSVP on Luma |
| Mobilize | RSVP on Mobilize |
| Action Network | Take Action |
| GoFundMe | Donate on GoFundMe |
| Partiful | RSVP on Partiful |

Social platforms auto-detect handles from the URL path. Add your own with static `label` or dynamic `labelFn`:

```js
OgCal.init({
  knownPlatforms: [
    ...OgCal.DEFAULTS.knownPlatforms,
    { pattern: /your-org\.com/i, label: 'Visit Our Site' },
    { pattern: /custom\.app/i, labelFn: (url) => `Open ${new URL(url).pathname}` },
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
