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
| Detail | `#event/<id>` or `/event/<id>` | Two-column: image gallery + event info |

Visitors can switch views via the selector bar. Their preference is saved in localStorage. Detail view shows a gallery with arrow navigation when an event has multiple images.

## Configuration

Every option has a sensible default. Pass only what you need.

```js
OgCal.init({
  el: '#cal',                          // CSS selector or DOM element

  // --- Data (pick one) ---
  data: { /* og-cal or Google Calendar API JSON */ },
  fetchUrl: 'https://...',
  google: { apiKey, calendarId, maxResults: 50 },

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
    clearFilter: 'Clear',
  },

  // --- Responsive ---
  mobileBreakpoint: 768,
  mobileDefaultView: 'list',
  mobileHiddenViews: ['week'],

  // --- Deep-linking ---
  initialEvent: null,                  // event ID to open on load

  // --- Behavior ---
  maxEventsPerDay: 3,                  // month view: chips before "+N more"
  locationLinkTemplate: 'https://maps.google.com/?q={location}',
  storageKeyPrefix: 'ogcal',          // for multiple instances
  imageExtensions: null,               // null = defaults: png, jpg, jpeg, gif, webp

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

For detailed descriptions of every option, callback signatures, custom renderer examples, and data hook behavior, see the **[full configuration reference](docs/configuration.md)**.

All options also work as HTML `data-` attributes for zero-JS setup. See the [data attributes table](#data-attributes) below.

### Data attributes

| Attribute | Maps to |
|-----------|---------|
| `data-og-cal` | Enables auto-init (required) |
| `data-api-key` | `google.apiKey` |
| `data-calendar-id` | `google.calendarId` |
| `data-max-results` | `google.maxResults` |
| `data-fetch-url` | `fetchUrl` |
| `data-default-view` | `defaultView` |
| `data-views` | `views` (comma-separated: `"month,week,list"`) |
| `data-locale` | `locale` |
| `data-week-start-day` | `weekStartDay` |
| `data-show-past-events` | `showPastEvents` (`"true"`) |
| `data-mobile-breakpoint` | `mobileBreakpoint` |
| `data-mobile-default-view` | `mobileDefaultView` |
| `data-mobile-hidden-views` | `mobileHiddenViews` (comma-separated) |
| `data-max-events-per-day` | `maxEventsPerDay` |
| `data-location-link-template` | `locationLinkTemplate` |
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

Social platforms auto-detect handles from profile URLs (e.g. `instagram.com/savebigbend`). Links to individual posts, reels, or status pages get a generic label instead (e.g. "View on Instagram"). Facebook groups and Reddit communities (`/r/`, `/u/`) are recognized as profile-like destinations. Add your own platforms via `knownPlatforms` config.

## Event Images

og-cal collects images from three sources:

1. **Image URLs in the description** (`.png`, `.jpg`, `.gif`, `.webp`) — extracted and removed from rendered text
2. **Google Drive links in the description** (`drive.google.com/file/d/.../view`, `/open?id=...`, `/uc?id=...`) — converted to direct-servable URLs via `lh3.googleusercontent.com` and removed from rendered text. The file must be publicly shared.
3. **Dropbox links in the description** — URLs containing `/scl/fi/`, `/s/`, or on `dl.dropboxusercontent.com` are recognized and normalized to `?raw=1` for direct serving. The file must be publicly shared.
4. **Attachments** with `image/*` MIME type — from Google Calendar or your own data (Drive and Dropbox attachment URLs are also normalized)

The first image is the thumbnail (grid/list views). Multiple images show as a gallery in detail view with ← → navigation and keyboard support.

To add image attachments via the Google Calendar API, use `supportsAttachments: true` in your update call. Attachments can point to any public URL.

## Attachments

og-cal detects file URLs in event descriptions and surfaces them as downloadable attachments. Any URL ending in a recognized file extension — `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.csv`, `.ppt`, `.pptx`, `.zip`, `.txt` — is extracted from the description text and added to the event's `attachments` array.

Dropbox and Google Drive URLs are normalized to direct-download links before being stored. Each attachment follows this schema:

```js
{ label: 'Download PDF', url: 'https://...', type: 'pdf' }
```

Attachments are rendered as a list of download links in the detail view, below the event description.

## Directives

Directives let you control og-cal behavior directly from event descriptions using a hashtag syntax. This is useful when you don't have access to code — you can add platform links, images, and metadata tags right inside a Google Calendar event description.

### Syntax

```
#ogcal:<type>:<value>
#showcal:<type>:<value>
```

Both `ogcal` and `showcal` prefixes are supported (case-insensitive). Directives are stripped from the rendered description.

### Platform link directives

Add a platform button without pasting the full URL:

```
#ogcal:instagram:savebigbend     → "Follow @savebigbend on Instagram"
#ogcal:zoom:123456789            → "Join Zoom" (links to zoom.us/j/123456789)
#ogcal:discord:AbCdEf            → "Join Discord" (links to discord.gg/AbCdEf)
#ogcal:eventbrite:12345          → "RSVP on Eventbrite"
```

All 18 built-in platforms are supported. Aliases: `twitter` → X, `meet` → Google Meet, `forms` → Google Forms, `maps` → Google Maps.

Directives and URLs are deduplicated: `#ogcal:instagram:foo` and `https://instagram.com/foo` produce the same canonical ID, so only one button renders.

### Image directives

```
#ogcal:image:https://example.com/flyer.png    → adds image to gallery
#showcal:image:drive:ABC123                    → Google Drive image by file ID
```

### Featured and hidden directives

Control event visibility and prominence:

```
#ogcal:featured    → pins event to top of its date group, adds star badge
#ogcal:hidden      → hides event from all views (still accessible via direct link)
```

Featured events sort first within their date in all views. Hidden events are filtered out before rendering. Both flags are available on the event object as `event.featured` and `event.hidden` booleans.

### Tag directives

Tags are rendered as badge pills in the detail view and as filterable pills in the tag filter bar:

```
#ogcal:tag:fundraiser        → scalar tag badge "fundraiser"
#ogcal:tag:outdoor           → scalar tag badge "outdoor"
#ogcal:cost:$25              → key-value badge "cost: $25"
#ogcal:capacity:50           → key-value badge "capacity: 50"
#ogcal:rsvp:https://form.com → rendered as a link button "Rsvp"
```

Key-value tags where the value is a URL are rendered as link buttons alongside platform links.

## Tag Filtering

When events have tags (via `#ogcal:tag:` directives or key-value directives), a filter bar appears above the view. Tags display as clickable pills ordered by frequency.

- Click a pill to filter events to those matching that tag
- Select multiple pills for union/OR filtering (events matching **any** selected tag)
- A "Clear" button appears when tags are selected
- URL-valued tags are excluded from the filter bar (they render as link buttons instead)

The clear button label is configurable via `i18n.clearFilter`.

## Event Deep-Linking

Events can be linked directly via hash or path:

- **Hash:** `#event/<event-id>` — works on any page
- **Path:** `/event/<event-id>` — requires server-side routing to serve the same page

Use `initialEvent` to open a specific event on load:

```js
OgCal.init({
  el: '#cal',
  initialEvent: 'abc123',  // opens detail view for this event ID
  // ...
});
```

Priority order: `initialEvent` > URL hash/path > localStorage > `defaultView`.

**Note:** og-cal manages client-side OG meta tags (`og:title`, `og:description`, `og:image`) when viewing event details. This works for JavaScript-rendering crawlers (like Google) but social media crawlers (Facebook, Twitter) that don't execute JS will not see these tags. For full social sharing support, use server-side rendering or a prerender service.

## Description Rendering

Event descriptions are auto-detected as HTML, markdown, or plain text:

- **HTML** (contains `<tag>`) — sanitized to allowed tags and attributes
- **Markdown** (contains `# headings`, `**bold**`, `[links](url)`, `- lists`) — parsed with [marked](https://github.com/markedjs/marked), then sanitized
- **Plain text** (default) — escaped, newlines converted to `<br>`

Extracted URLs (images, platform links, file attachments, directives) are removed from the rendered description. Sanitization rules are configurable via `sanitization` config.

## Past Events

A toggle button appears when past events exist. Visitors can show/hide past events, and the labels are configurable via `i18n.showPastEvents` and `i18n.hidePastEvents`. The initial state is controlled by `showPastEvents` config.

## Event Object

Events are enriched with extracted images, links, attachments, tags, and featured/hidden flags. For the full event schema and data pipeline details, see **[docs/event-schema.md](docs/event-schema.md)**.

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

## Accessibility

- All interactive elements have `tabindex="0"` and `role="button"` or `role="tab"`
- Keyboard navigation: Enter/Space to activate buttons, arrow keys in image galleries
- ARIA attributes: `role="tablist"` on view selector, `aria-selected` on active tab, `aria-live="polite"` on the view container, `aria-label` on navigation buttons
- `role="grid"` and `role="gridcell"` on the month view calendar
- Focus management: back button auto-focused when entering detail view

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
- [esbuild](https://esbuild.github.io/) for bundling (IIFE format, `OgCal` global)
- [marked](https://github.com/markedjs/marked) for markdown (bundled)
- CSS custom properties for theming
- `Intl.DateTimeFormat` for locale-aware formatting

Build outputs: `dist/og-cal.js` (+ sourcemap), `dist/og-cal.min.js`, `dist/og-cal.css`, `dist/og-cal.min.css`. The default config object is available as `OgCal.DEFAULTS` for extending (e.g., `OgCal.DEFAULTS.knownPlatforms`).

## License

[AGPL-3.0](LICENSE)
