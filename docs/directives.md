# Directives Reference

Directives let you control already-cal behavior directly from event descriptions using a hashtag syntax. This is useful when you don't have access to code — you can add platform links, images, and metadata tags right inside a Google Calendar event description.

## Syntax

```
#already:<type>:<value>
```

The `#already:` prefix is case-insensitive. Directives are stripped from the rendered description — visitors never see the raw directive text.

The directive regex matches `#already:` followed by non-whitespace, non-HTML characters (`[^\s<>]+`). This means directives are safe inside `<a>` tags that Google Calendar may wrap around them. HTML entities like `&amp;` are decoded before matching.

## Platform Link Directives

Add a platform button to an event without pasting the full URL. The directive value becomes the handle, ID, or slug used to construct the link.

| Directive | Alias for | Generated label | Constructed URL |
|-----------|-----------|----------------|-----------------|
| `#already:instagram:<handle>` | — | Follow @handle on Instagram | `https://instagram.com/<handle>` |
| `#already:facebook:<handle>` | — | handle on Facebook | `https://facebook.com/<handle>` |
| `#already:x:<handle>` | — | Follow @handle on X | `https://x.com/<handle>` |
| `#already:twitter:<handle>` | `x` | Follow @handle on X | `https://x.com/<handle>` |
| `#already:reddit:<subreddit>` | — | r/subreddit on Reddit | `https://reddit.com/r/<subreddit>` |
| `#already:youtube:<channel>` | — | Watch on YouTube | `https://youtube.com/<channel>` |
| `#already:tiktok:<handle>` | — | @handle on TikTok | `https://tiktok.com/@<handle>` |
| `#already:linkedin:<handle>` | — | View on LinkedIn | `https://linkedin.com/in/<handle>` |
| `#already:discord:<code>` | — | Join Discord | `https://discord.gg/<code>` |
| `#already:zoom:<meetingId>` | — | Join Zoom | `https://zoom.us/j/<meetingId>` |
| `#already:googlemeet:<code>` | — | Join Google Meet | `https://meet.google.com/<code>` |
| `#already:meet:<code>` | `googlemeet` | Join Google Meet | `https://meet.google.com/<code>` |
| `#already:eventbrite:<id>` | — | RSVP on Eventbrite | `https://eventbrite.com/e/<id>` |
| `#already:luma:<slug>` | — | RSVP on Luma | `https://lu.ma/<slug>` |
| `#already:mobilize:<path>` | — | RSVP on Mobilize | `https://mobilize.us/<path>` |
| `#already:actionnetwork:<path>` | — | Take Action | `https://actionnetwork.org/<path>` |
| `#already:gofundme:<slug>` | — | Donate on GoFundMe | `https://gofundme.com/f/<slug>` |
| `#already:partiful:<id>` | — | RSVP on Partiful | `https://partiful.com/e/<id>` |
| `#already:googleforms:<id>` | — | Fill Out Form | `https://docs.google.com/forms/d/e/<id>/viewform` |
| `#already:forms:<id>` | `googleforms` | Fill Out Form | `https://docs.google.com/forms/d/e/<id>/viewform` |
| `#already:googlemaps:<query>` | — | View on Map | `https://maps.google.com/?q=<query>` |
| `#already:maps:<query>` | `googlemaps` | View on Map | `https://maps.google.com/?q=<query>` |

**Aliases:** `twitter` produces the same result as `x`. `meet` is shorthand for `googlemeet`. `forms` is shorthand for `googleforms`. `maps` is shorthand for `googlemaps`.

### Examples

```
#already:instagram:savebigbend     → "Follow @savebigbend on Instagram"
#already:zoom:123456789            → "Join Zoom" (links to zoom.us/j/123456789)
#already:discord:AbCdEf            → "Join Discord" (links to discord.gg/AbCdEf)
#already:eventbrite:12345          → "RSVP on Eventbrite"
#already:twitter:savebigbend       → "Follow @savebigbend on X" (alias for x)
```

## Image Directives

Add images to an event's gallery without pasting the full URL into the description body.

### Direct URL

```
#already:image:https://example.com/flyer.png
```

The URL is added to the event's `images` array. Standard image normalization applies — Google Drive and Dropbox URLs are converted to direct-servable URLs.

### Google Drive shorthand

```
#already:image:drive:FILE_ID
```

Converted to `https://lh3.googleusercontent.com/d/FILE_ID`. The file must be publicly shared.

## Tag Directives

Tags are metadata labels attached to events. They appear as badge pills in the detail view and as filterable pills in the tag filter bar.

### Scalar tags

```
#already:tag:fundraiser
#already:tag:outdoor
```

Produces a tag with `key: "tag"` and `value: "fundraiser"`. Rendered as a simple badge pill.

### Key-value tags

Any directive type that isn't a recognized platform, `image`, `tag`, `featured`, or `hidden` is treated as a key-value tag:

```
#already:cost:$25              → badge pill "cost: $25"
#already:capacity:50           → badge pill "capacity: 50"
```

### URL-valued tags

When the value starts with `http`, the tag is rendered as a clickable link button alongside platform links instead of a badge pill:

```
#already:rsvp:https://forms.google.com/...  → link button labeled "Rsvp"
```

URL-valued tags are excluded from the tag filter bar.

## Featured and Hidden

These are flag directives — they have no value, just the keyword after `#already:`.

### Featured

```
#already:featured
```

- Pins the event to the top of its date group in all views
- Adds a `--featured` CSS modifier class for styling
- Sets `event.featured = true` on the event object

### Hidden

```
#already:hidden
```

- Removes the event from all views (grid, list, month, week, day)
- The event is still accessible via direct link (`#event/<id>` or `/event/<id>`)
- Sets `event.hidden = true` on the event object

## Deduplication

Directives and URL-extracted links use the same canonical ID system. If a directive and a URL in the same description resolve to the same canonical ID, only one entry is produced.

**Example:** An event description containing both `#already:instagram:savebigbend` and `https://instagram.com/savebigbend` produces a single Instagram button, not two.

Each directive type generates canonical IDs as follows:

| Type | Canonical ID format | Example |
|------|-------------------|---------|
| Platform link | `<canonicalPrefix>:<value>` | `instagram:savebigbend` |
| Image (URL) | `image:<raw-value>` | `image:https://example.com/flyer.png` |
| Image (Drive) | `image:drive:<fileId>` | `image:drive:ABC123` |
| Scalar tag | `tag:<value>` | `tag:fundraiser` |
| Key-value tag | `tag:<key>:<value>` | `tag:cost:$25` |

Platform aliases share the same `canonicalPrefix` — `twitter` and `x` both use `x`, so `#already:twitter:foo` and `#already:x:foo` deduplicate.

URL-extracted links use platform-specific `canonicalize()` functions that produce IDs in the same format. For example, `https://instagram.com/savebigbend` canonicalizes to `instagram:savebigbend`, matching the directive `#already:instagram:savebigbend`.

> **Note:** Image directive canonical IDs use the raw directive value (e.g., `image:https://example.com/pic.png`), while URL-extracted images use a normalized `image:<hostname><path>` format. This means directive images and URL-extracted images currently do not deduplicate with each other. Drive images (`image:drive:<id>`) deduplicate correctly across both sources.

## Extraction Order

Within `enrichEvent()`, the description is processed in this order:

1. **Directives** — `#already:` tokens extracted and removed
2. **Images** — Image URLs (by extension), Google Drive URLs, and Dropbox URLs extracted and removed
3. **Platform links** — URLs matching known platforms extracted and removed
4. **File attachments** — URLs ending in file extensions (`.pdf`, `.doc`, etc.) extracted and removed

All extractors decode `&amp;` to `&` before matching. Tokens from all stages are collected in a shared `TokenSet` that enforces deduplication by canonical ID.
