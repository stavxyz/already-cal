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
| `tags` | `object[]` | Tags from directives: `[{ key, value }]`. Pre-set tags pass through unchanged. A tag renders as a pill only if it is a non-blank string, or has a string key and a non-blank string or numeric value that is not a URL. |
| `featured` | `boolean` | `true` if `#already:featured` directive is present |
| `hidden` | `boolean` | `true` if `#already:hidden` directive is present |
| `imageShuffle` | `boolean` | `true` if the `#already:image-shuffle` directive is present or the host set it |
| `rsvp` | `boolean` | `true` if the `#already:rsvp` directive is present |
| `composite` | `boolean` | `true` if the `#already:composite` directive is present |
| `standalone` | `boolean` | `true` if the `#already:standalone` directive is present |
| `partOf` | `boolean` | `true` if the `#already:part-of` directive is present |
| `htmlLink` | `string` | Google Calendar web link (empty string if not available) |
| `_sourceTimeZone` | `string` (optional) | IANA zone for this event's own source calendar, e.g. `"America/New_York"` |
| `_sourceKey` | `string` (optional) | Opaque key for the calendar this event came from, supplied by the data producer |

`_sourceTimeZone` is supplied by the data producer per event (not extracted by `enrichEvent()`): for example, a downstream consumer that vendors this widget might set it to the zone of the specific source calendar an event came from. When present, built-in card and day views show event times in the viewer's local zone with this zone appended if it differs (e.g. `"Aug 19, 2:00 – 3:00 PM · 3:00 PM EDT"`). When absent, `calendar.timezone` is used as the fallback. A malformed or unrecognized value is ignored and the fallback is used: it never throws.

`_sourceKey` is also supplied by the data producer per event. It tells [composite events](directives.md#composite-events) which entries share a calendar: a parent takes entries that have its own key, and an entry with a different key joins only when it carries `#already:part-of`. Two rules apply. A producer that merges more than one calendar must set the key on every event, because events with no key all count as one calendar. And the key is meaningful only for equality within one data load: it is not a calendar's identity, and it may differ on the next load.

## Composed Events

Renderers and callbacks receive events after composition. Two fields exist only there:

| Field | Type | Description |
|-------|------|-------------|
| `parts` | `object[]` | On a parent that took at least one part: every part, in start order. Each is a full event object |
| `parentId` | `string` | On a part: the id of its parent |

No existing field changes meaning on a composed parent. `image`, `images`, `tags`, and the rest hold that entry's own values. The built-in views combine a composite's images and tags for display, and a custom layout that wants the same derives them from `parts`. `data.events`, as `onDataLoad` receives it, is the flat list before composition and has neither field.

Composition writes `parts` and `parentId` itself. A value a producer put in either field is replaced on a composed parent and on its parts, and is left alone on every other event.

Two things composition needs from the data. A parent needs an `id`, because its parts point at it: an entry without one never becomes a parent. A part without an `id` is still shown with its parent, but no link can name it. And timed `start` and `end` values should carry a UTC offset (`2026-04-15T19:00:00-05:00` or `...Z`). A timed value without one is a wall-clock time. Its main time label shows that clock reading to every viewer, and composition compares it as written, so mixing values with and without offsets in one view can put an entry inside or outside a parent's hours by the size of the offset. A timed value in any other format takes no part in composition, and its entry is shown on its own.

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
Passed to onDataLoad as data.events
  ↓
Composed once per load:
  hidden entries leave
  parents gain parts, and parts leave the top level
  ↓
Per render:
  isPast filter        ← past events toggle
  tag filter           ← tag pill selection
  ↓
Passed to view renderer
```

## Enrichment Details

The `enrichEvent()` function processes each event's description in this order:

All extraction stages decode `&amp;` to `&` before pattern matching, since HTML-rendered descriptions from Google Calendar may contain encoded ampersands.

1. **Directives** — `#already:` tokens are extracted and removed from the description. Platform directives become links, image directives become images, tag directives become tags, and the `featured`, `hidden`, `imageShuffle`, `rsvp`, `composite`, `standalone`, and `partOf` flags are set. See the **[directives reference](directives.md)** for the full syntax and supported types.

2. **Images** — URLs ending in image extensions (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`) and Google Drive/Dropbox links are extracted from the description and removed from the rendered text. Image attachments from Google Calendar with `image/*` MIME types are also included.

3. **Links** — URLs matching known platforms (Eventbrite, Instagram, Zoom, etc.) are extracted and removed from the description. Each becomes a `{ label, url }` entry in `event.links`.

4. **File attachments** — URLs ending in file extensions (`.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.csv`, `.ppt`, `.pptx`, `.zip`, `.txt`) are extracted and removed. Each becomes a `{ label, url, type }` entry in `event.attachments`.

Pre-set values on events take priority over extraction. If an event already has a non-empty `images` array, image extraction from the description is skipped. The same applies to `links`. This allows pre-loaded data to override what would be extracted from descriptions.

Tokens are deduplicated — a directive and a URL pointing to the same resource produce one entry (e.g., `#already:instagram:foo` and `https://instagram.com/foo` are merged).

## Description Rendering

Event descriptions use **AFL (Already Format Language)**. After extraction, the cleaned description is rendered based on auto-detected format:

| Format | Detection | Rendering |
|--------|-----------|-----------|
| HTML | Contains `<tag>` patterns | Sanitized (allowed tags/attrs only) |
| Markdown | Contains `# headings`, `**bold**`, `[links](url)`, `- lists` | Parsed with [marked](https://github.com/markedjs/marked), then sanitized |
| Plain text | Default | Escaped, newlines converted to `<br>` |

Comment lines (`// `) are stripped before any extraction runs. Sanitization rules are configurable — see the [sanitization section](configuration.md#sanitization) in the configuration reference.

The format is stored as `event.descriptionFormat` and can be pre-set in your data to skip auto-detection.

For the full AFL specification including comments, directives, and URL extraction, see the **[AFL Reference](afl.md)**.

## Pre-loaded Data Format

When using `config.data`, provide this structure:

```js
{
  events: [
    {
      id: 'unique-id',
      title: 'Event Title',
      description: 'Description text with #already:tag:outdoor directives...',
      location: 'Austin, TX',
      start: '2026-04-15T19:00:00-05:00',
      end: '2026-04-15T21:00:00-05:00',
      allDay: false,
      // Optional — enrichEvent fills these from description if not set:
      image: null,
      images: [],
      links: [],
      htmlLink: '',
      attachments: [],
      tags: [],
      featured: false,
      hidden: false,
      imageShuffle: false,
      rsvp: false,
      composite: false,
      standalone: false,
      partOf: false,
    },
  ],
  calendar: {
    name: 'My Calendar',
    description: 'Community events',
    timezone: 'America/Chicago',
  },
}
```

already-cal also accepts **raw Google Calendar API JSON** (the response from `calendars/{id}/events`). It auto-detects the format by checking for an `items` array and transforms it.

## Attachment Types

Attachments come from two sources, each producing slightly different `type` values.

### URL-extracted attachments

URLs in event descriptions ending in recognized file extensions are extracted as attachments. The `type` value preserves the specific extension:

| Extension(s) | `type` value | Default label |
|-------------|-------------|---------------|
| `.pdf` | `'pdf'` | Download PDF |
| `.doc`, `.docx` | `'doc'` / `'docx'` | Download Document |
| `.xls`, `.xlsx` | `'xls'` / `'xlsx'` | Download Spreadsheet |
| `.csv` | `'csv'` | Download Spreadsheet |
| `.ppt`, `.pptx` | `'ppt'` / `'pptx'` | Download Presentation |
| `.zip` | `'zip'` | Download Archive |
| `.txt` | `'txt'` | Download File |

### Google Calendar API attachments

Non-image attachments from the Google Calendar API are classified by MIME type. The `type` value is a generic category rather than a specific extension. Checks are evaluated in the order shown — the first match wins. This matters because Office XML MIME types like `application/vnd.openxmlformats-officedocument.presentationml.presentation` contain both "document" and "presentation" substrings; checking `presentation` first produces the correct result.

| MIME type pattern | `type` value | Default label |
|-------------------|-------------|---------------|
| Contains `pdf` | `'pdf'` | Download PDF |
| Contains `presentation` or `powerpoint` | `'presentation'` | Download Presentation |
| Contains `sheet`, `excel`, or `csv` | `'spreadsheet'` | Download Spreadsheet |
| Contains `word` or `document` | `'doc'` | Download Document |
| Contains `zip`, `archive`, or `compressed` | `'archive'` | Download Archive |
| Anything else | `'file'` | Download File |

When consuming `event.attachments`, handle both kinds of type values — specific extensions (`'docx'`, `'xlsx'`) from URL-extracted attachments and generic categories (`'doc'`, `'spreadsheet'`) from API attachments — if you need to branch on type.

Google Drive and Dropbox URLs in attachments are normalized to direct-download links.
