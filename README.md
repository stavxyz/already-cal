# og-cal

Open-source Google Calendar event display. Drop it on any website.

Six views — month, week, day, grid, list, and event detail — with hash routing, responsive design, and CSS custom property theming. Zero framework dependencies.

## Quick Start

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

og-cal supports three ways to load events:

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

The view selector bar lets visitors switch views. Their selection is saved in localStorage.

## Configuration

```js
OgCal.init({
  el: '#cal',                    // CSS selector or DOM element
  defaultView: 'month',          // initial view
  views: ['month', 'week', 'day', 'grid', 'list'],  // enabled views
  showPastEvents: false,         // toggle-able by visitors
  theme: {
    primary: '#8B4513',          // buttons, active states
    primaryText: '#ffffff',      // text on primary
    background: '#f5f0eb',       // container background
    surface: '#ffffff',          // card backgrounds
    text: '#1a1a1a',             // body text
    textSecondary: '#666',       // dates, locations
    radius: '8px',               // border radius
    fontFamily: 'system-ui, sans-serif',
  },
});
```

## Event Schema

og-cal consumes this JSON format (from any source):

```json
{
  "events": [
    {
      "id": "abc123",
      "title": "Community Rally",
      "description": "<p>Join us for a rally.</p>",
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
- **HTML** — sanitized (allowlist-only) and rendered
- **Markdown** — parsed with [marked](https://github.com/markedjs/marked) and sanitized
- **Plain text** — escaped and rendered with line breaks

### Image extraction

The first image URL (`.png`, `.jpg`, `.gif`, `.webp`) in an event description is automatically extracted and displayed as the event thumbnail in grid and detail views.

### Link extraction

URLs to known platforms (Eventbrite, Google Forms, Google Maps, Zoom, Google Meet) are extracted from descriptions and rendered as action buttons.

## Responsive Design

- **Desktop (>1024px)** — all views, full grid layouts
- **Tablet (768–1024px)** — condensed month view, 2-column grid
- **Mobile (<768px)** — defaults to list view, single-column grid, week view hidden

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
- `Intl.DateTimeFormat` for timezone-aware formatting

## License

[AGPL-3.0](LICENSE)
