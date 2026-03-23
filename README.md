# og-cal

Display Google Calendar events on any website. Six views, responsive design, full theming, no framework dependencies.

**Live:** [nobigbendwall.org/event-calendar/](https://nobigbendwall.org/event-calendar/)

## Quick Start

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/stavxyz/og-cal@main/dist/og-cal.min.css">
<script src="https://cdn.jsdelivr.net/gh/stavxyz/og-cal@main/dist/og-cal.min.js"></script>

<!-- Zero JS — just data attributes -->
<div data-og-cal
     data-api-key="YOUR_GOOGLE_API_KEY"
     data-calendar-id="YOUR_CALENDAR_ID@group.calendar.google.com"
     data-default-view="grid">
</div>
```

Or initialize with JavaScript for more control:

```js
OgCal.init({
  el: '#cal',
  google: {
    apiKey: 'YOUR_GOOGLE_API_KEY',
    calendarId: 'YOUR_CALENDAR_ID@group.calendar.google.com',
  },
});
```

## How It Works

Put URLs in your Google Calendar event descriptions — og-cal does the rest:

- **Image URLs** (`.png`, `.jpg`, etc.) become the event thumbnail and detail gallery
- **Google Drive links** (`drive.google.com/file/d/.../view`) are converted to servable image URLs
- **Platform URLs** (Eventbrite, Instagram, Zoom, etc.) become action buttons
- **Google Calendar attachments** with `image/*` MIME types are added to the gallery
- **Descriptions** are auto-detected as HTML, markdown, or plain text and rendered accordingly

Everything is extracted and cleaned up automatically. Raw URLs are removed from the rendered description so they don't clutter the text.

## Data Sources

### 1. Pre-loaded (recommended for production)

Pass event data server-side. Accepts og-cal schema **or raw Google Calendar API JSON** — og-cal auto-detects the format. Your server can just proxy and cache the Google Calendar API response with zero transform.

```js
OgCal.init({
  el: '#cal',
  data: googleCalendarApiResponse, // { items: [...], summary: '...', timeZone: '...' }
});
```

### 2. Fetch URL

Point at your own endpoint returning og-cal schema or raw Google Calendar API JSON.

```js
OgCal.init({ el: '#cal', fetchUrl: 'https://your-api.com/events' });
```

### 3. Direct Google Calendar API

Fetches client-side. The API key is visible in page source — restrict it in the Google Cloud Console.

```js
OgCal.init({
  el: '#cal',
  google: { apiKey: 'YOUR_API_KEY', calendarId: 'YOUR_CALENDAR_ID' },
});
```

## Views

| View | Hash | Description |
|------|------|-------------|
| Month | `#month` | Calendar grid with event chips |
| Week | `#week` | 7-column layout |
| Day | `#day` or `#day/2026-04-04` | Single day |
| Grid | `#grid` | Card layout with thumbnails |
| List | `#list` | Compact chronological list |
| Detail | `#event/<id>` | Two-column: image gallery + event info |

Visitors can switch views via the selector bar. Their preference is saved in localStorage. Detail view shows a gallery with arrow navigation when an event has multiple images.

## Configuration

Every option has a sensible default. Pass only what you need.

```js
OgCal.init({
  el: '#cal',                          // CSS selector or DOM element

  // --- Data (pick one) ---
  data: { /* og-cal or Google Calendar API JSON */ },
  fetchUrl: 'https://...',
  google: { apiKey, calendarId },

  // --- Header ---
  showHeader: true,                    // calendar name + description + subscribe button
  headerTitle: null,                   // override calendar name from data
  headerDescription: null,             // override calendar description from data
  headerIcon: null,                    // URL to icon/logo
  subscribeUrl: null,                  // auto-generated from calendarId if not set

  // --- Views ---
  defaultView: 'month',
  views: ['month', 'week', 'day', 'grid', 'list'],
  showPastEvents: false,               // visitors can toggle this

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

  // --- Locale ---
  locale: 'en-US',                     // default: navigator.language
  weekStartDay: 0,                     // 0=Sunday, 1=Monday
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
    moreEvents: '+{count} more',
    subscribe: 'Subscribe',
  },

  // --- Responsive ---
  mobileBreakpoint: 768,
  mobileDefaultView: 'list',
  mobileHiddenViews: ['week'],

  // --- Behavior ---
  maxEventsPerDay: 3,                  // month view: chips before "+N more"
  locationLinkTemplate: 'https://maps.google.com/?q={location}',
  storageKeyPrefix: 'ogcal',          // for multiple instances
  imageExtensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'],

  // --- Link extraction ---
  // 18 built-in: Eventbrite, Google Forms, Google Maps, Zoom, Google Meet,
  // Instagram, Facebook, X/Twitter, Reddit, YouTube, TikTok, LinkedIn,
  // Discord, Luma, Mobilize, Action Network, GoFundMe, Partiful.
  // Social platforms auto-detect handles:
  //   "https://instagram.com/savebigbend" → "Follow @savebigbend on Instagram"
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
  eventFilter: (event) => true,
  eventTransform: (event) => event,

  // --- Custom renderers ---
  renderEmpty: null,
  renderLoading: null,
  renderError: null,
});
```

All options also work as HTML `data-` attributes for zero-JS setup. See the [data attributes table](#data-attributes) below.

### Data attributes

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
| `data-theme-*` | `theme.*` (e.g. `data-theme-primary="#333"`) |

## Link Extraction

URLs in event descriptions matching known platforms are extracted and rendered as action buttons. The URL is removed from the description text.

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

Social platforms auto-detect handles from the URL path. Add your own via `knownPlatforms` config.

## Event Images

og-cal collects images from three sources:

1. **Image URLs in the description** (`.png`, `.jpg`, `.gif`, `.webp`) — extracted and removed from rendered text
2. **Google Drive links in the description** (`drive.google.com/file/d/.../view`, `/open?id=...`, `/uc?id=...`) — converted to direct-servable URLs via `lh3.googleusercontent.com` and removed from rendered text. The file must be publicly shared.
3. **Attachments** with `image/*` MIME type — from Google Calendar or your own data (Drive attachment URLs are also normalized)

The first image is the thumbnail (grid/list views). Multiple images show as a gallery in detail view with ← → navigation and keyboard support.

To add image attachments via the Google Calendar API, use `supportsAttachments: true` in your update call. Attachments can point to any public URL.

## Responsive

- **Desktop (>1024px)** — all views, full grid
- **Tablet (768–1024px)** — condensed month, 2-column grid
- **Mobile (<768px)** — defaults to list view, single-column, week view hidden

All breakpoints and mobile behavior are configurable.

## Internationalization

og-cal uses `Intl.DateTimeFormat` for all date/time formatting. Set `locale` and `weekStartDay` to match your audience. All UI strings are overridable via `i18n`.

## Multiple Instances

```js
OgCal.init({ el: '#events-a', storageKeyPrefix: 'cal-a', ... });
OgCal.init({ el: '#events-b', storageKeyPrefix: 'cal-b', ... });
```

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
- `Intl.DateTimeFormat` for locale-aware formatting

## License

[AGPL-3.0](LICENSE)
