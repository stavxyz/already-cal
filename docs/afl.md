# Already Format Language (AFL)

AFL is the description format that already-cal understands. Write event descriptions in your Google Calendar (or data source) using any combination of these features — already-cal processes them automatically.

## Base Formats

Descriptions are auto-detected as one of three base formats:

| Format | Detection | Rendering |
|--------|-----------|-----------|
| HTML | Contains `<tag>` patterns | Sanitized to allowed tags and attributes |
| Markdown | Contains `# headings`, `**bold**`, `[links](url)`, `- lists` | Parsed with [marked](https://github.com/markedjs/marked), then sanitized |
| Plain text | Default | Escaped, newlines converted to `<br>` |

Detection runs after all extractions below. The detected format is stored as `event.descriptionFormat` and can be pre-set in your data to skip auto-detection. Sanitization rules are configurable via the [`sanitization` config](configuration.md#sanitization).

## Comments

Lines starting with `// ` (two slashes followed by a space) are stripped from the description before any other processing. They are never rendered to visitors.

```
// This is a comment — stripped entirely
// reminder: confirm venue before publishing

Join us for the annual fundraiser!
#already:tag:fundraiser
```

Use comments to:

- **Add internal notes** for calendar editors that visitors shouldn't see
- **Disable directives** without deleting them: `// #already:instagram:foo`
- **Leave TODOs** for yourself: `// TODO: add flyer image once designed`

### Rules

- Must start at the beginning of a line (optional leading whitespace)
- Requires a space after `//` — `//nospace` is NOT a comment
- `// ` mid-line is NOT a comment — `visit us // open daily` renders as-is
- URLs with `://` are never affected — `https://example.com` is safe
- Protocol-relative URLs (`//example.com`) are preserved — no space after `//`
- Lines are delimited by `\n` (or `\r\n`). HTML `<br>` is not a comment boundary — write comments on real newlines, not after `<br>` tags

## Directives

Directives let you control already-cal behavior using `#already:<type>:<value>` syntax. They are extracted and removed from the rendered description.

```
#already:instagram:savebigbend     → "Follow @savebigbend on Instagram"
#already:image:https://example.com/flyer.png  → adds image to gallery
#already:tag:fundraiser            → filterable tag badge
#already:featured                  → pins event to top
#already:hidden                    → hides from views
#already:image-shuffle             → a stable image per occurrence, chosen from the list by a hash of the occurrence id
#already:composite                 → shows the entries inside this one's hours as its parts
#already:website:https://example.com/fest → the detail title links to this page
```

All 18 built-in platforms are supported, plus aliases. For the complete reference including all platforms, URL construction, tag types, and deduplication rules, see the **[Directives Reference](directives.md)**.

## URL Extraction

URLs in descriptions are automatically detected and extracted:

- **Image URLs** (`.png`, `.jpg`, `.gif`, `.webp`) → event thumbnail and gallery
- **Google Drive links** → converted to direct-servable image URLs
- **Dropbox links** → normalized to direct-download URLs
- **Platform URLs** (Eventbrite, Instagram, Zoom, etc.) → action buttons
- **File URLs** (`.pdf`, `.doc`, `.zip`, etc.) → downloadable attachments

Extracted URLs are removed from the rendered description text. For the full event object schema and field details, see **[Event Schema](event-schema.md)**.

## Processing Order

When already-cal processes a description, extractions run in this order:

1. **Comments** — `// ` lines removed
2. **Directives** — `#already:` tokens extracted
3. **Images** — image URLs, Drive links, Dropbox links extracted
4. **Links** — platform URLs extracted
5. **Attachments** — file URLs extracted
6. **Format detection** — HTML, markdown, or plain text

All stages decode `&amp;` to `&` before matching (Google Calendar HTML-encodes ampersands) via the shared `decodeAmp` helper. Stages 2–5 contribute to a shared `TokenSet` that enforces deduplication by canonical ID — a directive and a URL pointing to the same resource produce one entry. Comments (stage 1) are fully stripped and produce no tokens.
