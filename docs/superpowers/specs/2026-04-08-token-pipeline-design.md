# Unified Token Pipeline & Directive System

**Date:** 2026-04-08
**Status:** Approved

## Problem

Event authors sometimes include the same link or directive twice in descriptions — either accidentally or deliberately for prominence. The current extraction pipeline deduplicates by exact URL string match within each extractor, but fails when:

1. The exact same URL string appears twice (edge cases in the Set-based dedup)
2. Semantically equivalent URLs appear in different forms (e.g., `instagram.com/foo` vs `www.instagram.com/foo/`)

Additionally, there is no way for event authors to express structured metadata (tags, key-value pairs) or use shorthand directives instead of full URLs.

## Solution: Unified Token Pipeline

Replace the sequential extractor chain with a unified token-based pipeline. All meaningful content extracted from a description becomes a **Token** — a structured object with a canonical ID used for deduplication.

### Token Model

```js
{
  canonicalId: 'instagram:savebigbend',    // dedup key
  type: 'link',                             // 'link' | 'image' | 'attachment' | 'tag'
  source: 'url',                            // 'url' | 'directive'
  url: 'https://instagram.com/savebigbend', // original URL (null for scalar tags)
  label: 'Follow @savebigbend on Instagram', // display label
  metadata: {},                             // type-specific extras
}
```

Two tokens with the same `canonicalId` are duplicates. The first one wins for rendering; the second one's source pattern is still stripped from the description (duplicates are cleaned but only rendered once).

### TokenSet

```js
class TokenSet {
  constructor() { this._map = new Map(); }
  add(token) {
    if (!this._map.has(token.canonicalId)) {
      this._map.set(token.canonicalId, token);
      return true;
    }
    return false;
  }
  addAll(tokens) { tokens.forEach(t => this.add(t)); }
  ofType(type) { return [...this._map.values()].filter(t => t.type === type); }
}
```

## Canonical ID Format

Each token type produces a canonical ID by normalizing its input to a stable string.

### General URL Normalization (applied before platform-specific canonicalization)

- Strip `www.` prefix from hostname
- Normalize protocol to `https`
- Remove trailing slash from path
- Strip tracking params: `utm_*`, `fbclid`, `si`

### Platform Links

| URL | Canonical ID |
|-----|-------------|
| `https://www.instagram.com/savebigbend/` | `instagram:savebigbend` |
| `https://instagram.com/savebigbend` | `instagram:savebigbend` |
| `https://twitter.com/foo` | `x:foo` |
| `https://x.com/foo` | `x:foo` |
| `https://youtu.be/abc123` | `youtube:abc123` |
| `https://youtube.com/watch?v=abc123` | `youtube:abc123` |
| `https://zoom.us/j/123456` | `zoom:123456` |
| `https://eventbrite.com/e/my-event-12345` | `eventbrite:12345` |
| `https://gofundme.com/f/some-cause` | `gofundme:some-cause` |

Each platform definition gains a `canonicalize(url)` function alongside its existing `pattern` and `labelFn`. The function extracts the platform-specific identifier from a URL and returns `platformName:identifier`.

### Images

| URL | Canonical ID |
|-----|-------------|
| `https://example.com/flyer.png` | `image:example.com/flyer.png` |
| `https://drive.google.com/file/d/ABC123/view` | `image:drive:ABC123` |
| `https://dropbox.com/scl/fi/hash/pic.jpg?rlkey=x&dl=0` | `image:dropbox:hash/pic.jpg` |

### Attachments

| URL | Canonical ID |
|-----|-------------|
| `https://example.com/report.pdf` | `attachment:example.com/report.pdf` |
| `https://drive.google.com/file/d/XYZ/view` | `attachment:drive:XYZ` |

### Tags

| Directive | Canonical ID |
|-----------|-------------|
| `#ogcal:tag:fundraiser` | `tag:fundraiser` |
| `#showcal:rsvp:https://link` | `tag:rsvp:https://link` |
| `#ogcal:cost:$25` | `tag:cost:$25` |

## Directive Syntax

**Format:** `#ogcal:<type>:<value>` or `#showcal:<type>:<value>` (case-insensitive prefix)

Directives can appear anywhere in the description text and are stripped after extraction.

### Parsing Rules

- The directive regex matches `#(?:ogcal|showcal):` followed by non-whitespace characters (terminated by whitespace, newline, or end of string)
- The prefix is split off first, then the remainder is split on the **first** colon to get `type` and `value` — e.g., `image:drive:ABC123` splits into type `image` and value `drive:ABC123`
- Values may contain colons, slashes, and other URL-safe characters
- Values must not contain whitespace (whitespace terminates the directive)
- If the directive appears inside an HTML tag (e.g., `<a>` wrapping), the tag is also stripped

### Examples

```
# Platform links
#ogcal:instagram:savebigbend        → Follow @savebigbend on Instagram
#showcal:zoom:123456789             → Join Zoom
#ogcal:eventbrite:12345             → RSVP on Eventbrite
#ogcal:discord:AbCdEf               → Join Discord (invite code)

# Images
#ogcal:image:https://example.com/flyer.png
#showcal:image:drive:ABC123          → Google Drive image by ID

# Scalar tags
#ogcal:tag:fundraiser
#showcal:tag:outdoor

# Key-value tags
#ogcal:rsvp:https://my-form.com
#ogcal:cost:$25
```

### Type Resolution Order

When parsing `#ogcal:foo:bar`:

1. Is `foo` a known platform name? → produce a link token
2. Is `foo` `image`? → produce an image token
3. Is `foo` `tag`? → produce a scalar tag token (`tag:bar`)
4. Otherwise → treat as a key-value tag token (`tag:foo:bar`)

This means arbitrary key-value pairs work without registration — `#ogcal:cost:$25`, `#ogcal:rsvp:https://...`, `#ogcal:capacity:50` all produce tag tokens automatically.

## Extraction Pipeline

### Pipeline Order

```
1. Directive parser     — scan for #ogcal:/#showcal: patterns, produce tokens, strip from description
2. Image extractor      — scan for image URLs, produce tokens, strip from description
3. Link extractor       — scan for platform URLs, produce tokens, strip from description
4. Attachment extractor — scan for file URLs, produce tokens, strip from description
```

### Orchestration in enrichEvent

```js
const tokenSet = new TokenSet();

// Step 1: directives
const d = extractDirectives(description);
description = d.description;
tokenSet.addAll(d.tokens);

// Step 2: images
const img = extractImageTokens(description, config);
description = img.description;
tokenSet.addAll(img.tokens);

// Step 3: links
const lnk = extractLinkTokens(description, config);
description = lnk.description;
tokenSet.addAll(lnk.tokens);

// Step 4: attachments
const att = extractAttachmentTokens(description, config);
description = att.description;
tokenSet.addAll(att.tokens);

// Consume tokens grouped by type
const images = tokenSet.ofType('image');
const links = tokenSet.ofType('link');
const attachments = tokenSet.ofType('attachment');
const tags = tokenSet.ofType('tag');
```

Each extractor strips its matched patterns from the description regardless of whether the token was accepted or rejected as a duplicate. This ensures duplicate content is always cleaned from the description while only being rendered once.

### Migration Path

The existing `extractImage`, `extractLinks`, and `extractAttachments` functions get thin wrappers that produce tokens internally but return the same shapes. The individual extractors evolve incrementally; `enrichEvent` in `data.js` is the primary integration point that changes.

## Rendering

### Links, Images, Attachments

No rendering changes. The detail view already renders these from arrays on the event object. The arrays now come from `tokenSet.ofType(...)` instead of directly from extractors, but the shape is identical.

### Tags (New)

Tags appear on the event object as:

```js
event.tags = [
  { key: 'tag', value: 'fundraiser' },       // scalar
  { key: 'rsvp', value: 'https://...' },      // key-value URL
  { key: 'cost', value: '$25' },              // key-value text
]
```

**Rendering rules:**

- **Scalar tags** (`key === 'tag'`): render as badge pills — small colored chips showing the value
- **Key-value URL tags**: render as labeled buttons in the links section alongside platform links, with the key as the label
- **Key-value text tags**: render as labeled pills — `key: value` in a chip, alongside scalar tag badges

**Placement in detail view:**

- Tag badges and key-value text tags appear after the meta section (date/location), before the description
- Key-value URL tags appear in the links section alongside platform links

### Event Object

Tags are exposed as `event.tags` — a new field accessible to `eventTransform` and `eventFilter` callbacks, enabling calendar operators to filter or transform events by tag.

## Design Principles

- **Stupid-proof:** The system gracefully handles careless event descriptions — duplicate links, inconsistent URL forms, sloppy formatting all resolve cleanly
- **Easy to extend:** Adding a new platform means adding a `canonicalize` function alongside `pattern` and `labelFn`. Adding a new directive type means adding a case to the type resolution order.
- **Single mental model:** Everything extracted from a description is a token with a canonical ID. Deduplication is set membership. No special cases.
- **Directive-URL convergence:** `https://instagram.com/savebigbend` and `#ogcal:instagram:savebigbend` produce the same canonical ID and the same rendered output.
