# already-cal

Display Google Calendar events on any website. Six views, responsive design, full theming, no framework dependencies.

**Live:** [nobigbendwall.org/event-calendar/](https://nobigbendwall.org/event-calendar/)

## Quick Start

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/stavxyz/already-cal@main/dist/already-cal.min.css">
<script src="https://cdn.jsdelivr.net/gh/stavxyz/already-cal@main/dist/already-cal.min.js"></script>

<!-- Zero JS — just data attributes -->
<div data-already-cal
     data-api-key="YOUR_GOOGLE_API_KEY"
     data-calendar-id="YOUR_CALENDAR_ID@group.calendar.google.com"
     data-default-view="grid">
</div>
```

Or initialize with JavaScript for more control:

```js
Already.init({
  el: '#cal',
  google: {
    apiKey: 'YOUR_GOOGLE_API_KEY',
    calendarId: 'YOUR_CALENDAR_ID@group.calendar.google.com',
  },
});
```

## How It Works

Put URLs in your Google Calendar event descriptions — already-cal does the rest:

- **Image URLs** (`.png`, `.jpg`, etc.) become the event thumbnail and detail gallery
- **Google Drive links** (`drive.google.com/file/d/.../view`) are converted to servable image URLs
- **Platform URLs** (Eventbrite, Instagram, Zoom, etc.) become action buttons
- **Google Calendar attachments** with `image/*` MIME types are added to the gallery
- **Descriptions** are auto-detected as HTML, markdown, or plain text and rendered accordingly

Everything is extracted and cleaned up automatically. Raw URLs are removed from the rendered description so they don't clutter the text.

## Data Sources

### 1. Pre-loaded (recommended for production)

Pass event data server-side. Accepts already-cal schema **or raw Google Calendar API JSON** — already-cal auto-detects the format. Your server can just proxy and cache the Google Calendar API response with zero transform.

```js
Already.init({
  el: '#cal',
  data: googleCalendarApiResponse, // { items: [...], summary: '...', timeZone: '...' }
});
```

### 2. Fetch URL

Point at your own endpoint returning already-cal schema or raw Google Calendar API JSON.

```js
Already.init({ el: '#cal', fetchUrl: 'https://your-api.com/events' });
```

### 3. Direct Google Calendar API

Fetches client-side. The API key is visible in page source — restrict it in the Google Cloud Console.

```js
Already.init({
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

Visitors can switch views via the selector bar, which includes inline SVG icons for each view. Their preference is saved in localStorage. Detail view shows a gallery with arrow navigation when an event has multiple images.

Grid and list views are paginated (default: 10 events per page, configurable via `pageSize`) with "Load more" and "Show earlier" buttons. Month, week, and day views show all events for their date range.

## Configuration

Every option has a sensible default. Pass only what you need.

```js
Already.init({
  el: '#cal',                          // CSS selector or DOM element

  // --- Data (pick one) ---
  data: { /* already-cal or Google Calendar API JSON */ },
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
  pageSize: 10,                        // events per page in grid/list views

  // --- Sticky header ---
  sticky: true,                        // true | false | { header, viewSelector, tagFilter }

  // --- Theming ---
  // Shorthand (layout name only):
  // theme: 'hero',
  // Full control:
  theme: {
    layout: 'clean',                     // clean | hero | badge | compact
    palette: 'light',                    // light | dark | warm | cool
    orientation: 'vertical',             // vertical | horizontal (ignored for compact)
    imagePosition: 'left',               // left | right | alternating (horizontal only)
    primary: '#8B4513',                  // CSS custom property overrides
    radius: '12px',
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
    loadMore: 'Load more',
    showEarlier: 'Show earlier',
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
  storageKeyPrefix: 'already',        // for multiple instances
  imageExtensions: null,               // null = defaults: png, jpg, jpeg, gif, webp

  // --- Link extraction ---
  // 18 built-in: Eventbrite, Google Forms, Google Maps, Zoom, Google Meet,
  // Instagram, Facebook, X/Twitter, Reddit, YouTube, TikTok, LinkedIn,
  // Discord, Luma, Mobilize, Action Network, GoFundMe, Partiful.
  // Social platforms auto-detect handles:
  //   "https://instagram.com/savebigbend" → "Follow @savebigbend on Instagram"
  knownPlatforms: [
    ...Already.DEFAULTS.knownPlatforms,
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

The most common options are also available as HTML `data-` attributes for zero-JS setup. See the [data attributes table](#data-attributes) below. Some options (callbacks, custom renderers, sticky, pageSize, and others) require JavaScript initialization — see the [full data attributes reference](docs/configuration.md#data-attributes) for details.

### Data attributes

| Attribute | Maps to |
|-----------|---------|
| `data-already-cal` | Enables auto-init (required) |
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

## Themes

Themes have two independent axes: **layouts** (card structure) and **palettes** (visual style). Mix any layout with any palette.

### Layouts

| Layout | Description |
|--------|-------------|
| `clean` | Image, title, date, location. Minimal and fast to scan. **(default)** |
| `hero` | Large image, bold uppercase title, description preview, footer with icons |
| `badge` | Date badge overlay on image, tags, description, RSVP action footer |
| `compact` | No image, inline date badge, dense info. Great for text-heavy calendars |

### Palettes

| Palette | Vibe |
|---------|------|
| `light` | Clean default — system-ui, subtle shadows **(default)** |
| `dark` | Dark mode — dark backgrounds, no shadows |
| `warm` | Earthy/organic — Georgia serif, generous radius, warm shadows |
| `cool` | Modern/minimal — Inter font, tight radius, crisp shadows |

### Usage

```js
// Shorthand — just pick a layout (defaults to light palette)
Already.init({ el: '#cal', theme: 'hero' });

// Full control
Already.init({
  el: '#cal',
  theme: {
    layout: 'badge',
    palette: 'dark',
    orientation: 'horizontal',  // vertical (default) | horizontal
    imagePosition: 'alternating', // left (default) | right | alternating

    // CSS custom property overrides (applied on top of palette)
    primary: '#e63946',
    radius: '0px',
  },
});
```

Grid view uses the theme's orientation (default: vertical). List view always renders horizontal cards (vertical for compact). The `imagePosition` option only applies in horizontal orientation.

### CSS Custom Properties

Palettes set these properties. Override any of them in the theme config:

`primary`, `primaryText`, `background`, `surface`, `text`, `textSecondary`, `border`, `fontFamily`, `fontWeightNormal`, `fontWeightBold`, `fontSizeSm`, `fontSizeBase`, `fontSizeLg`, `radius`, `radiusSm`, `shadow`, `shadowHover`, `highlight`, `spacing`

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

already-cal collects images from three sources:

1. **Image URLs in the description** (`.png`, `.jpg`, `.gif`, `.webp`) — extracted and removed from rendered text
2. **Google Drive links in the description** (`drive.google.com/file/d/.../view`, `/open?id=...`, `/uc?id=...`) — converted to direct-servable URLs via `lh3.googleusercontent.com` and removed from rendered text. The file must be publicly shared.
3. **Dropbox links in the description** — URLs containing `/scl/fi/`, `/s/`, or on `dl.dropboxusercontent.com` are recognized and normalized to `?raw=1` for direct serving. The file must be publicly shared.
4. **Attachments** with `image/*` MIME type — from Google Calendar or your own data (Drive and Dropbox attachment URLs are also normalized)

The first image is the thumbnail (grid/list views). Multiple images show as a gallery in detail view with ← → navigation and keyboard support. Tapping any gallery image opens a fullscreen lightbox overlay for easy reading of text-heavy images like flyers — with prev/next navigation, keyboard controls, and multiple dismiss methods (close button, backdrop tap, image tap, Escape key).

To add image attachments via the Google Calendar API, use `supportsAttachments: true` in your update call. Attachments can point to any public URL.

## Attachments

already-cal detects file URLs in event descriptions and surfaces them as downloadable attachments. Any URL ending in a recognized file extension — `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.csv`, `.ppt`, `.pptx`, `.zip`, `.txt` — is extracted from the description text and added to the event's `attachments` array.

Dropbox and Google Drive URLs are normalized to direct-download links before being stored. Each attachment follows this schema:

```js
{ label: 'Download PDF', url: 'https://...', type: 'pdf' }
```

Attachments are rendered as a list of download links in the detail view, below the event description.

## Directives

Directives let you control already-cal behavior directly from event descriptions using a `#already:<type>:<value>` syntax. The `#already:` prefix is case-insensitive. Directives are stripped from the rendered description.

```
#already:instagram:savebigbend     → "Follow @savebigbend on Instagram"
#already:image:https://example.com/flyer.png  → adds image to gallery
#already:image:drive:FILE_ID       → Google Drive image by file ID
#already:tag:fundraiser            → filterable tag badge
#already:cost:$25                  → key-value tag badge "cost: $25"
#already:featured                  → pins event to top, adds star badge
#already:hidden                    → hides from views (still accessible via direct link)
```

All 18 built-in platforms are supported as directives, plus aliases (`twitter` → X, `meet` → Google Meet, `forms` → Google Forms, `maps` → Google Maps). Directives and URLs are deduplicated — `#already:instagram:foo` and `https://instagram.com/foo` produce one button, not two.

For the complete reference including all platforms, URL construction, tag types, and deduplication rules, see the **[directives reference](docs/directives.md)**.

## Tag Filtering

When events have tags (via `#already:tag:` directives or key-value directives), a filter bar appears above the view. Tags display as clickable pills ordered by frequency.

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
Already.init({
  el: '#cal',
  initialEvent: 'abc123',  // opens detail view for this event ID
  // ...
});
```

Priority order: `initialEvent` > URL hash/path > localStorage > `defaultView`.

**Note:** already-cal manages client-side OG meta tags (`og:title`, `og:description`, `og:image`) when viewing event details. This works for JavaScript-rendering crawlers (like Google) but social media crawlers (Facebook, Twitter) that don't execute JS will not see these tags. For full social sharing support, use server-side rendering or a prerender service.

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

already-cal uses `Intl.DateTimeFormat` for all date/time formatting. Set `locale` and `weekStartDay` to match your audience. All UI strings are overridable via `i18n`.

## Multiple Instances

```js
Already.init({ el: '#events-a', storageKeyPrefix: 'cal-a', ... });
Already.init({ el: '#events-b', storageKeyPrefix: 'cal-b', ... });
```

## Accessibility

- All interactive elements have `tabindex="0"` and `role="button"` or `role="tab"`
- Keyboard navigation: Enter/Space to activate buttons, arrow keys in image galleries and lightbox
- ARIA attributes: `role="tablist"` on view selector, `aria-selected` on active tab, `aria-live="polite"` on the view container, `aria-label` on navigation buttons
- `role="grid"` and `role="gridcell"` on the month view calendar
- `role="dialog"` with `aria-modal="true"` on the image lightbox
- Focus management: back button auto-focused when entering detail view, focus trapped within lightbox and restored on close

## Development

```bash
npm install
npm run build           # build to dist/
npm run dev             # watch mode
npm test                # run tests
npm run test:coverage   # tests with c8 coverage report
npm run lint            # check formatting and lint rules
npm run format          # auto-fix formatting and lint
open dev.html           # local preview with mock data
```

## CI/CD

Three GitHub Actions workflows run automatically:

- **Quality** — Biome lint + format check on PRs and pushes to main (path-filtered)
- **Tests** — Node 20/22 matrix with c8 coverage on Node 22, build verification (path-filtered)
- **Release** — Tag-triggered (`v[0-9]*`): tests, builds, creates GitHub Release with dist assets

### Creating a release

1. Bump `version` in `package.json`, commit
2. `git tag v<version>`
3. `git push origin v<version>`
4. The release workflow builds, tests, and creates a GitHub Release with dist assets

## Built with

- Vanilla JavaScript (no framework)
- [esbuild](https://esbuild.github.io/) for bundling (IIFE format, `Already` global)
- [marked](https://github.com/markedjs/marked) for markdown (bundled)
- [Biome](https://biomejs.dev/) for linting and formatting
- [c8](https://github.com/bcoe/c8) for test coverage reporting
- CSS custom properties for theming
- `Intl.DateTimeFormat` for locale-aware formatting

Build outputs: `dist/already-cal.js` (+ sourcemap), `dist/already-cal.min.js`, `dist/already-cal.css`, `dist/already-cal.min.css`. The default config object is available as `Already.DEFAULTS` for extending (e.g., `Already.DEFAULTS.knownPlatforms`).

## License

[AGPL-3.0](LICENSE)
