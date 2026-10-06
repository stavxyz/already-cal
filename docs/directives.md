# Directives Reference

Directives let you control already-cal behavior directly from event descriptions using a hashtag syntax. This is useful when you don't have access to code — you can add platform links, images, and metadata tags right inside a Google Calendar event description.

Google Calendar's editor turns a pasted URL into a link, so a directive typed as `#already:image:https://example.com/a.jpg` is stored as `#already:image:<a href="https://example.com/a.jpg">https://example.com/a.jpg</a>`. The widget reads the link's `href` as the directive value, so paste URLs as you normally would. This applies to any directive whose value is a URL (`image`, `preorder`, `rsvp`, and platform directives given as full URLs). Only a plain `<a href="...">text</a>` is recognized; an anchor with no `href`, or with markup inside the link text, is left as written.

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

Add images to an event's gallery without pasting the full URL into the description body. A long list of image directives can trip the "Text too long. Remove text or style to avoid truncation." warning in Google Calendar's description editor (seen with 22 Google Photos URLs), so keep the list short.

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

### Shuffle the card image

```
#already:image-shuffle
```

A flag directive for recurring events with several `#already:image:` directives. Without it, the card always shows the first image listed, so a grid of a weekly event is one photo repeated down the page. With it, the card image is chosen per occurrence by a stable hash of the event's own id: the same occurrence always shows the same photo (consistent across renders), while the photos vary down the list of occurrences. Two occurrences can hash to the same image, so a different photo for every occurrence is not guaranteed. The detail view's gallery starts from the chosen image instead of always the first one. The shuffle applies to the event's images from any source: image directives, image URLs in the description, image attachments, or a host-supplied `images` array. It keys on the event `id`, so occurrences must have distinct ids (Google's expanded instances of a recurring event do). An event with fewer than two images, or one that already has an explicit `image` set, is unaffected. Only host-supplied event JSON can carry an explicit `image`, since events read from Google Calendar never do.

## Tag Directives

Tags are metadata labels attached to events. They appear as pills in the detail view, on badge and compact cards, and in the tag filter bar.

### Scalar tags

```
#already:tag:fundraiser
#already:tag:outdoor
```

Produces a tag with `key: "tag"` and `value: "fundraiser"`. Rendered as a simple badge pill.

### Key-value tags

Any directive type that isn't a recognized platform, `image`, `tag`, `featured`, `hidden`, or `image-shuffle` is treated as a key-value tag:

```
#already:cost:$25              → badge pill "cost: $25"
#already:capacity:50           → badge pill "capacity: 50"
```

### URL-valued tags

When the value starts with `http`, the tag is rendered as a clickable link button alongside platform links instead of a badge pill:

```
#already:rsvp:https://forms.google.com/...  → link button labeled "Rsvp"
```

URL-valued tags are excluded from the tag filter bar and from card pills.

## Featured and Hidden

These are flag directives — they have no value, just the keyword after `#already:`. `#already:rsvp` is a further flag directive, documented under RSVP below.

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

`#already:image-shuffle` is a third flag directive; see [Shuffle the card image](#shuffle-the-card-image).

## Composite Events

Some occasions are described by more than one calendar entry: a weekly dinner and the band that plays during it, or one festival listed by two organizers. Three flag directives let a view show such entries as one event. Like `featured` and `hidden`, each is a keyword with no value.

### Composite

```
#already:composite
```

- Marks an entry as a **parent**. Every entry from the parent's own calendar that starts inside the parent's hours is shown as one of its **parts** (an entry from another calendar joins only with the part-of flag below, and an entry with the standalone flag never joins)
- An entry starts inside the hours when its start is at or after the parent's start and before the parent's end. A parent with no end takes no parts
- An all-day parent takes the entries whose date falls on its dates. An all-day entry joins an all-day parent only, never a timed one. An all-day parent's end date is exclusive, the way Google Calendar reports it, so a one-day parent ends on the next date
- The composite's place in a list, its featured state, and the moment it counts as past are the parent's. Its parts are shown with it for as long as it is shown
- The parent keeps its card. The card lists up to three parts, each with its start time, then a "+N more" line. A part on a day other than the parent's shows its date as well
- A part has no card of its own in the grid and list views. In the month and week views a part that starts on its parent's first day has no chip of its own, and in the day view it is a row under the parent. A part that starts on any other day appears on its own on that day
- The detail view shows the parent, then each part with its own time, description, links, attachments, and RSVP button. A link to a part opens the parent's detail at that part
- A part whose title matches the parent's, ignoring case, punctuation, accents, and emoji, is treated as a second listing of the same occasion. It gets no line on the card and no row of its own on the parent's first day, and the detail view shows its details without repeating the title
- On a recurring event the flag applies to every occurrence
- A parent never becomes a part. An entry inside two parents joins a parent from its own calendar before one from another calendar, and between two from the same side it joins the one with the shorter window
- A hidden entry is never a parent and never a part
- Sets `event.composite = true` on the event object

Without this flag on some entry, nothing changes.

### Part of

```
#already:part-of
```

- When a view combines several calendars, a parent takes entries from its own calendar only. Put this flag on an entry from another calendar to let a parent take it
- It has no effect on an entry that no parent contains
- Sets `event.partOf = true` on the event object

The widget tells calendars apart by the optional `_sourceKey` field on each event. See the [event schema](event-schema.md). Events with no key count as one calendar.

### Standalone

```
#already:standalone
```

- Keeps an entry out of every composite. Use it for an event that starts inside a parent's hours and is not part of it
- Wins over `part-of` when an entry carries both
- Sets `event.standalone = true` on the event object

### Reserved forms

`#already:composite:<name>` and `#already:part-of:<name>` are reserved for joining a parent by name. They are removed from the description and have no effect.

## RSVP

```
#already:rsvp
```

- A flag, like `featured` and `hidden`: no value, just the keyword
- Sets `event.rsvp = true` on the event object; the widget shows an RSVP button for the event when the host configured `onRsvp` (see the README's RSVP section)
- `#already:rsvp:<url>` is not this flag: with a value it is a URL-valued tag and renders a link button labeled "Rsvp"

## Deduplication

Directives and URL-extracted links use the same canonical ID system. If a directive and a URL in the same description resolve to the same canonical ID, only one entry is produced.

**Example:** An event description containing both `#already:instagram:savebigbend` and `https://instagram.com/savebigbend` produces a single Instagram button, not two.

Each directive type generates canonical IDs as follows:

| Type | Canonical ID format | Example |
|------|-------------------|---------|
| Platform link | `<canonicalPrefix>:<value>` | `instagram:savebigbend` |
| Image (URL) | `image:<hostname><path>` | `image:example.com/flyer.png` |
| Image (Drive) | `image:drive:<fileId>` | `image:drive:ABC123` |
| Scalar tag | `tag:<value>` | `tag:fundraiser` |
| Key-value tag | `tag:<key>:<value>` | `tag:cost:$25` |

Platform aliases share the same `canonicalPrefix` — `twitter` and `x` both use `x`, so `#already:twitter:foo` and `#already:x:foo` deduplicate.

URL-extracted links use platform-specific `canonicalize()` functions that produce IDs in the same format. For example, `https://instagram.com/savebigbend` canonicalizes to `instagram:savebigbend`, matching the directive `#already:instagram:savebigbend`. Image directives and URL-extracted images also share a canonical ID function, so `#already:image:https://example.com/pic.png` and an inline `https://example.com/pic.png` deduplicate correctly.

## Extraction Order

Within `enrichEvent()`, the description is processed in this order:

1. **Directives** — `#already:` tokens extracted and removed
2. **Images** — Image URLs (by extension), Google Drive URLs, and Dropbox URLs extracted and removed
3. **Platform links** — URLs matching known platforms extracted and removed
4. **File attachments** — URLs ending in file extensions (`.pdf`, `.doc`, etc.) extracted and removed

All extractors decode `&amp;` to `&` before matching. Tokens from all stages are collected in a shared `TokenSet` that enforces deduplication by canonical ID.
