# Event Schema

This documents the event object available to callbacks (`onEventClick`, `onDataLoad`), data hooks (`eventTransform`, `eventFilter`), and custom renderers.

## Event Object

After enrichment, each event has these fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique event identifier |
| `title` | `string` | Event title |
| `description` | `string` | Event description with extracted URLs removed |
| `descriptionFormat` | `string` | Auto-detected: `'plain'`, `'html'`, or `'markdown'` |
| `location` | `string` | Event location (empty string if none) |
| `start` | `string` | ISO 8601 datetime or date-only string |
| `end` | `string` | ISO 8601 datetime or date-only string |
| `allDay` | `boolean` | `true` for all-day events |
| `image` | `string \| null` | First image URL, or `null` |
| `images` | `string[]` | All image URLs (from description, directives, and attachments) |
| `links` | `object[]` | Extracted platform links: `[{ label, url }]` |
| `attachments` | `object[]` | File attachments: `[{ label, url, type }]` |
| `tags` | `object[]` | Tags from directives: `[{ key, value }]` |
| `featured` | `boolean` | `true` if `#ogcal:featured` directive is present |
| `hidden` | `boolean` | `true` if `#ogcal:hidden` directive is present |

## Data Pipeline

Events are processed in this order:

```
Raw data (Google API / fetchUrl / pre-loaded)
  ↓
enrichEvent()          ← extracts directives, images, links, attachments, tags
  ↓
eventTransform()       ← your custom mutation hook (if configured)
  ↓
eventFilter()          ← your custom filter hook (if configured)
  ↓
Stored as data.events
  ↓
Per render:
  isPast filter        ← past events toggle
  hidden filter        ← removes hidden events from views
  tag filter           ← tag pill selection
  ↓
Passed to view renderer
```

## Enrichment Details

The `enrichEvent()` function processes each event's description in this order:

1. **Directives** — `#ogcal:` and `#showcal:` tokens are extracted and removed from the description. Platform directives become links, image directives become images, tag directives become tags, and `featured`/`hidden` flags are set.

2. **Images** — URLs ending in image extensions (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`) and Google Drive/Dropbox links are extracted from the description and removed from the rendered text. Image attachments from Google Calendar with `image/*` MIME types are also included.

3. **Links** — URLs matching known platforms (Eventbrite, Instagram, Zoom, etc.) are extracted and removed from the description. Each becomes a `{ label, url }` entry in `event.links`.

4. **File attachments** — URLs ending in file extensions (`.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.csv`, `.ppt`, `.pptx`, `.zip`, `.txt`) are extracted and removed. Each becomes a `{ label, url, type }` entry in `event.attachments`.

Tokens are deduplicated — a directive and a URL pointing to the same resource produce one entry (e.g., `#ogcal:instagram:foo` and `https://instagram.com/foo` are merged).

## Description Rendering

After extraction, the cleaned description is rendered based on auto-detected format:

| Format | Detection | Rendering |
|--------|-----------|-----------|
| HTML | Contains `<tag>` patterns | Sanitized (allowed tags/attrs only) |
| Markdown | Contains `# headings`, `**bold**`, `[links](url)`, `- lists` | Parsed with [marked](https://github.com/markedjs/marked), then sanitized |
| Plain text | Default | Escaped, newlines converted to `<br>` |

The format is stored as `event.descriptionFormat` and can be pre-set in your data to skip auto-detection.

## Pre-loaded Data Format

When using `config.data`, provide this structure:

```js
{
  events: [
    {
      id: 'unique-id',
      title: 'Event Title',
      description: 'Description text with #ogcal:tag:outdoor directives...',
      location: 'Austin, TX',
      start: '2026-04-15T19:00:00-05:00',
      end: '2026-04-15T21:00:00-05:00',
      allDay: false,
      // Optional — enrichEvent fills these from description if not set:
      image: null,
      images: [],
      links: [],
      attachments: [],
      tags: [],
      featured: false,
      hidden: false,
    },
  ],
  calendar: {
    name: 'My Calendar',
    description: 'Community events',
    timezone: 'America/Chicago',
  },
}
```

og-cal also accepts **raw Google Calendar API JSON** (the response from `calendars/{id}/events`). It auto-detects the format by checking for an `items` array and transforms it.

## Attachment Types

| Extension(s) | `type` value | Default label |
|-------------|-------------|---------------|
| `.pdf` | `'pdf'` | Download PDF |
| `.doc`, `.docx` | `'doc'` / `'docx'` | Download Document |
| `.xls`, `.xlsx` | `'xls'` / `'xlsx'` | Download Spreadsheet |
| `.csv` | `'csv'` | Download Spreadsheet |
| `.ppt`, `.pptx` | `'ppt'` / `'pptx'` | Download Presentation |
| `.zip` | `'zip'` | Download Archive |
| `.txt` | `'txt'` | Download File |

Google Drive and Dropbox URLs in attachments are normalized to direct-download links.
