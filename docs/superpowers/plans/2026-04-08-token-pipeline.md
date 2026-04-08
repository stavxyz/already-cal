# Unified Token Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sequential extractor chain with a unified token pipeline that deduplicates by canonical ID, and add directive parsing (`#ogcal:`/`#showcal:`) with tag support.

**Architecture:** A new `TokenSet` class provides the dedup layer. A new `directives.js` module parses directive syntax. Each existing extractor (`images.js`, `links.js`, `attachments.js`) gains a `canonicalize()` function on its platform definitions and a token-producing wrapper. The `enrichEvent` function in `data.js` orchestrates the pipeline through the shared `TokenSet`. Tag rendering is added to `detail.js` and `og-cal.css`.

**Tech Stack:** Vanilla JS (ESM modules), node:test for testing, esbuild for bundling.

**Spec:** `docs/superpowers/specs/2026-04-08-token-pipeline-design.md`

---

### Task 1: TokenSet and URL Normalization

**Files:**
- Create: `src/util/tokens.js`
- Create: `test/tokens.test.js`

- [ ] **Step 1: Write failing tests for TokenSet**

In `test/tokens.test.js`:

```js
const { describe, it, before } = require('node:test');
const assert = require('node:assert');

let TokenSet, normalizeUrl;

before(async () => {
  const mod = await import('../src/util/tokens.js');
  TokenSet = mod.TokenSet;
  normalizeUrl = mod.normalizeUrl;
});

describe('TokenSet', () => {
  it('accepts a token and retrieves it by type', () => {
    const ts = new TokenSet();
    ts.add({ canonicalId: 'instagram:foo', type: 'link', source: 'url', url: 'https://instagram.com/foo', label: 'Follow @foo on Instagram', metadata: {} });
    const links = ts.ofType('link');
    assert.strictEqual(links.length, 1);
    assert.strictEqual(links[0].canonicalId, 'instagram:foo');
  });

  it('rejects duplicate canonicalId and returns false', () => {
    const ts = new TokenSet();
    const token = { canonicalId: 'instagram:foo', type: 'link', source: 'url', url: 'https://instagram.com/foo', label: 'Follow @foo', metadata: {} };
    assert.strictEqual(ts.add(token), true);
    assert.strictEqual(ts.add({ ...token, url: 'https://www.instagram.com/foo/' }), false);
    assert.strictEqual(ts.ofType('link').length, 1);
  });

  it('addAll adds multiple tokens and deduplicates', () => {
    const ts = new TokenSet();
    ts.addAll([
      { canonicalId: 'instagram:a', type: 'link', source: 'url', url: 'u1', label: 'l1', metadata: {} },
      { canonicalId: 'instagram:b', type: 'link', source: 'url', url: 'u2', label: 'l2', metadata: {} },
      { canonicalId: 'instagram:a', type: 'link', source: 'directive', url: 'u3', label: 'l3', metadata: {} },
    ]);
    assert.strictEqual(ts.ofType('link').length, 2);
  });

  it('filters by type correctly across mixed types', () => {
    const ts = new TokenSet();
    ts.add({ canonicalId: 'instagram:x', type: 'link', source: 'url', url: 'u', label: 'l', metadata: {} });
    ts.add({ canonicalId: 'image:y.png', type: 'image', source: 'url', url: 'u2', label: 'img', metadata: {} });
    ts.add({ canonicalId: 'tag:outdoor', type: 'tag', source: 'directive', url: null, label: 'outdoor', metadata: { key: 'tag', value: 'outdoor' } });
    assert.strictEqual(ts.ofType('link').length, 1);
    assert.strictEqual(ts.ofType('image').length, 1);
    assert.strictEqual(ts.ofType('tag').length, 1);
  });

  it('preserves insertion order', () => {
    const ts = new TokenSet();
    ts.add({ canonicalId: 'a', type: 'link', source: 'url', url: '1', label: 'first', metadata: {} });
    ts.add({ canonicalId: 'b', type: 'link', source: 'url', url: '2', label: 'second', metadata: {} });
    const links = ts.ofType('link');
    assert.strictEqual(links[0].label, 'first');
    assert.strictEqual(links[1].label, 'second');
  });
});

describe('normalizeUrl', () => {
  it('strips www. prefix', () => {
    assert.strictEqual(normalizeUrl('https://www.instagram.com/foo'), 'https://instagram.com/foo');
  });

  it('normalizes http to https', () => {
    assert.strictEqual(normalizeUrl('http://instagram.com/foo'), 'https://instagram.com/foo');
  });

  it('removes trailing slash', () => {
    assert.strictEqual(normalizeUrl('https://instagram.com/foo/'), 'https://instagram.com/foo');
  });

  it('strips utm_* params', () => {
    assert.strictEqual(normalizeUrl('https://example.com/page?utm_source=twitter&utm_medium=social'), 'https://example.com/page');
  });

  it('strips fbclid param', () => {
    assert.strictEqual(normalizeUrl('https://example.com/page?fbclid=abc123'), 'https://example.com/page');
  });

  it('strips si param', () => {
    assert.strictEqual(normalizeUrl('https://example.com/page?si=abc'), 'https://example.com/page');
  });

  it('preserves non-tracking params', () => {
    assert.strictEqual(normalizeUrl('https://example.com/page?id=5&ref=home'), 'https://example.com/page?id=5&ref=home');
  });

  it('handles multiple tracking and non-tracking params', () => {
    assert.strictEqual(normalizeUrl('https://example.com/page?id=5&utm_source=x&keep=1&fbclid=abc'), 'https://example.com/page?id=5&keep=1');
  });

  it('returns the URL unchanged if already normalized', () => {
    assert.strictEqual(normalizeUrl('https://instagram.com/foo'), 'https://instagram.com/foo');
  });

  it('handles URLs without path', () => {
    assert.strictEqual(normalizeUrl('https://www.example.com'), 'https://example.com');
  });

  it('handles invalid URLs gracefully', () => {
    assert.strictEqual(normalizeUrl('not-a-url'), 'not-a-url');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/tokens.test.js`
Expected: FAIL — module `../src/util/tokens.js` does not exist

- [ ] **Step 3: Implement TokenSet and normalizeUrl**

In `src/util/tokens.js`:

```js
const TRACKING_PARAMS = new Set(['fbclid', 'si']);
const TRACKING_PREFIX = 'utm_';

export function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.protocol = 'https:';
    u.hostname = u.hostname.replace(/^www\./, '');
    u.pathname = u.pathname.replace(/\/+$/, '') || '/';
    // Remove root path to match convention (bare domain = no trailing slash)
    if (u.pathname === '/') u.pathname = '';

    const cleaned = new URLSearchParams();
    for (const [key, value] of u.searchParams) {
      if (key.startsWith(TRACKING_PREFIX)) continue;
      if (TRACKING_PARAMS.has(key)) continue;
      cleaned.append(key, value);
    }
    u.search = cleaned.toString();
    // URLSearchParams encodes, but we want a clean string
    return u.origin + u.pathname + (u.search ? '?' + cleaned.toString() : '') + u.hash;
  } catch {
    return url;
  }
}

export class TokenSet {
  constructor() {
    this._map = new Map();
  }

  add(token) {
    if (!this._map.has(token.canonicalId)) {
      this._map.set(token.canonicalId, token);
      return true;
    }
    return false;
  }

  addAll(tokens) {
    tokens.forEach(t => this.add(t));
  }

  ofType(type) {
    return [...this._map.values()].filter(t => t.type === type);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/tokens.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/util/tokens.js test/tokens.test.js
git commit -m "feat: add TokenSet and normalizeUrl for unified token pipeline"
```

---

### Task 2: Platform Canonicalization

**Files:**
- Modify: `src/util/links.js` — add `canonicalize` function to each platform definition
- Modify: `test/links.test.js` — add canonicalization tests

- [ ] **Step 1: Write failing tests for platform canonicalization**

Append to `test/links.test.js`:

```js
describe('platform canonicalization', () => {
  it('canonicalizes Instagram profile URL', () => {
    const platform = DEFAULT_PLATFORMS.find(p => p.pattern.test('https://instagram.com/foo'));
    assert.strictEqual(platform.canonicalize('https://www.instagram.com/savebigbend/'), 'instagram:savebigbend');
  });

  it('canonicalizes Instagram post URL', () => {
    const platform = DEFAULT_PLATFORMS.find(p => p.pattern.test('https://instagram.com/p/ABC'));
    assert.strictEqual(platform.canonicalize('https://www.instagram.com/p/ABC123/'), 'instagram:p/ABC123');
  });

  it('canonicalizes X/Twitter profile — x.com', () => {
    const platform = DEFAULT_PLATFORMS.find(p => p.pattern.test('https://x.com/foo'));
    assert.strictEqual(platform.canonicalize('https://x.com/nobigbendwall'), 'x:nobigbendwall');
  });

  it('canonicalizes X/Twitter profile — twitter.com', () => {
    const platform = DEFAULT_PLATFORMS.find(p => p.pattern.test('https://twitter.com/foo'));
    assert.strictEqual(platform.canonicalize('https://twitter.com/nobigbendwall'), 'x:nobigbendwall');
  });

  it('canonicalizes Facebook profile', () => {
    const platform = DEFAULT_PLATFORMS.find(p => p.pattern.test('https://facebook.com/foo'));
    assert.strictEqual(platform.canonicalize('https://www.facebook.com/savebigbend'), 'facebook:savebigbend');
  });

  it('canonicalizes Facebook group', () => {
    const platform = DEFAULT_PLATFORMS.find(p => p.pattern.test('https://facebook.com/groups/foo'));
    assert.strictEqual(platform.canonicalize('https://facebook.com/groups/mygroup'), 'facebook:groups/mygroup');
  });

  it('canonicalizes YouTube video — full URL', () => {
    const platform = DEFAULT_PLATFORMS.find(p => p.pattern.test('https://youtube.com/watch?v=abc'));
    assert.strictEqual(platform.canonicalize('https://youtube.com/watch?v=abc123'), 'youtube:abc123');
  });

  it('canonicalizes YouTube video — short URL', () => {
    const platform = DEFAULT_PLATFORMS.find(p => p.pattern.test('https://youtu.be/abc'));
    assert.strictEqual(platform.canonicalize('https://youtu.be/abc123'), 'youtube:abc123');
  });

  it('canonicalizes Zoom meeting', () => {
    const platform = DEFAULT_PLATFORMS.find(p => p.pattern.test('https://zoom.us/j/123'));
    assert.strictEqual(platform.canonicalize('https://zoom.us/j/123456789'), 'zoom:123456789');
  });

  it('canonicalizes Eventbrite event', () => {
    const platform = DEFAULT_PLATFORMS.find(p => p.pattern.test('https://eventbrite.com/e/foo'));
    assert.strictEqual(platform.canonicalize('https://www.eventbrite.com/e/save-big-bend-rally-12345'), 'eventbrite:12345');
  });

  it('canonicalizes GoFundMe campaign', () => {
    const platform = DEFAULT_PLATFORMS.find(p => p.pattern.test('https://gofundme.com/f/foo'));
    assert.strictEqual(platform.canonicalize('https://www.gofundme.com/f/save-big-bend'), 'gofundme:save-big-bend');
  });

  it('canonicalizes Reddit subreddit', () => {
    const platform = DEFAULT_PLATFORMS.find(p => p.pattern.test('https://reddit.com/r/BigBend'));
    assert.strictEqual(platform.canonicalize('https://www.reddit.com/r/BigBend'), 'reddit:r/BigBend');
  });

  it('canonicalizes TikTok profile', () => {
    const platform = DEFAULT_PLATFORMS.find(p => p.pattern.test('https://tiktok.com/@foo'));
    assert.strictEqual(platform.canonicalize('https://www.tiktok.com/@savebigbend'), 'tiktok:savebigbend');
  });

  it('canonicalizes Google Meet link', () => {
    const platform = DEFAULT_PLATFORMS.find(p => p.pattern.test('https://meet.google.com/abc'));
    assert.strictEqual(platform.canonicalize('https://meet.google.com/abc-defg-hij'), 'googlemeet:abc-defg-hij');
  });

  it('canonicalizes Discord invite', () => {
    const platform = DEFAULT_PLATFORMS.find(p => p.pattern.test('https://discord.gg/abc'));
    assert.strictEqual(platform.canonicalize('https://discord.gg/AbCdEf'), 'discord:AbCdEf');
  });

  it('canonicalizes Luma event', () => {
    const platform = DEFAULT_PLATFORMS.find(p => p.pattern.test('https://lu.ma/abc'));
    assert.strictEqual(platform.canonicalize('https://lu.ma/my-event'), 'luma:my-event');
  });

  it('canonicalizes Google Maps URL', () => {
    const platform = DEFAULT_PLATFORMS.find(p => p.pattern.test('https://maps.app.goo.gl/abc'));
    assert.strictEqual(platform.canonicalize('https://maps.app.goo.gl/xYz123'), 'googlemaps:xYz123');
  });

  it('canonicalizes Google Forms URL', () => {
    const platform = DEFAULT_PLATFORMS.find(p => p.pattern.test('https://docs.google.com/forms/d/e/abc'));
    assert.strictEqual(platform.canonicalize('https://docs.google.com/forms/d/e/1FAIpQ/viewform'), 'googleforms:1FAIpQ');
  });

  it('canonicalizes Mobilize URL', () => {
    const platform = DEFAULT_PLATFORMS.find(p => p.pattern.test('https://mobilize.us/foo'));
    assert.strictEqual(platform.canonicalize('https://www.mobilize.us/savebigbend/event/12345/'), 'mobilize:savebigbend/event/12345');
  });

  it('canonicalizes Action Network URL', () => {
    const platform = DEFAULT_PLATFORMS.find(p => p.pattern.test('https://actionnetwork.org/events/foo'));
    assert.strictEqual(platform.canonicalize('https://actionnetwork.org/events/rally-for-big-bend'), 'actionnetwork:events/rally-for-big-bend');
  });

  it('canonicalizes Partiful URL', () => {
    const platform = DEFAULT_PLATFORMS.find(p => p.pattern.test('https://partiful.com/e/abc'));
    assert.strictEqual(platform.canonicalize('https://partiful.com/e/AbC123'), 'partiful:AbC123');
  });

  it('canonicalizes LinkedIn URL', () => {
    const platform = DEFAULT_PLATFORMS.find(p => p.pattern.test('https://linkedin.com/in/foo'));
    assert.strictEqual(platform.canonicalize('https://www.linkedin.com/in/johndoe'), 'linkedin:in/johndoe');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/links.test.js`
Expected: FAIL — `platform.canonicalize is not a function`

- [ ] **Step 3: Add canonicalize to each platform definition**

Modify `src/util/links.js` — add a `canonicalize` function to each platform in `DEFAULT_PLATFORMS`. The function takes a URL string and returns `platformname:identifier`.

Helper function to add at the top of the file (below the existing `handleAt` export):

```js
function pathSegments(url) {
  try {
    return new URL(url).pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  } catch { return []; }
}
```

Then update each platform entry. For example, Instagram becomes:

```js
{
  pattern: /instagram\.com/i,
  labelFn: (url) => { const h = handleAt(url); return h ? `Follow @${h} on Instagram` : 'View on Instagram'; },
  canonicalize: (url) => {
    const segs = pathSegments(url);
    if (segs.length === 0) return 'instagram:';
    if (segs.length === 1) return `instagram:${segs[0].replace(/^@/, '')}`;
    return `instagram:${segs.join('/')}`;
  },
},
```

Full list of canonicalize functions for each platform:

- **Eventbrite:** Extract trailing numeric ID from slug: `eventbrite:<id>` (e.g., `/e/save-big-bend-12345` → `eventbrite:12345`)
- **Google Forms:** Extract form ID from `/forms/d/e/<id>/`: `googleforms:<id>`
- **Google Maps:** For `maps.app.goo.gl/<code>` use `googlemaps:<code>`. For `google.com/maps` URLs, use full path: `googlemaps:<path>`
- **Zoom:** Extract meeting ID from `/j/<id>`: `zoom:<id>`
- **Google Meet:** Extract meeting code from path: `googlemeet:<code>`
- **Instagram:** Use `pathSegments`, strip `@`: `instagram:<handle>` or `instagram:<segments>`
- **Facebook:** Use `pathSegments`: `facebook:<segments>`. Normalize `fb.com` to `facebook`.
- **X/Twitter:** Use `pathSegments`, always prefix `x:`: `x:<handle>`
- **Reddit:** Use `pathSegments`: `reddit:<segments>`
- **YouTube:** Extract video ID from `?v=` param or `youtu.be/<id>`: `youtube:<id>`. For non-video URLs, use path.
- **TikTok:** Use `pathSegments`, strip `@`: `tiktok:<handle>`
- **LinkedIn:** Use `pathSegments`: `linkedin:<segments>`
- **Discord:** Extract invite code from `discord.gg/<code>` or `discord.com/invite/<code>`: `discord:<code>`
- **Luma:** Extract event slug from path: `luma:<slug>`
- **Mobilize:** Use `pathSegments`: `mobilize:<segments>`
- **Action Network:** Use `pathSegments`: `actionnetwork:<segments>`
- **GoFundMe:** Extract campaign slug from `/f/<slug>`: `gofundme:<slug>`
- **Partiful:** Extract event ID from `/e/<id>`: `partiful:<id>`

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/links.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/util/links.js test/links.test.js
git commit -m "feat: add canonicalize functions to all platform definitions"
```

---

### Task 3: Directive Parser

**Files:**
- Create: `src/util/directives.js`
- Create: `test/directives.test.js`

- [ ] **Step 1: Write failing tests for directive parsing**

In `test/directives.test.js`:

```js
const { describe, it, before } = require('node:test');
const assert = require('node:assert');

let extractDirectives;

before(async () => {
  const mod = await import('../src/util/directives.js');
  extractDirectives = mod.extractDirectives;
});

describe('extractDirectives — platform link directives', () => {
  it('parses #ogcal:instagram:handle into a link token', () => {
    const result = extractDirectives('#ogcal:instagram:savebigbend');
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].type, 'link');
    assert.strictEqual(result.tokens[0].canonicalId, 'instagram:savebigbend');
    assert.strictEqual(result.tokens[0].label, 'Follow @savebigbend on Instagram');
    assert.strictEqual(result.tokens[0].source, 'directive');
    assert.strictEqual(result.description.trim(), '');
  });

  it('parses #showcal:instagram:handle (showcal prefix)', () => {
    const result = extractDirectives('#showcal:instagram:savebigbend');
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].canonicalId, 'instagram:savebigbend');
  });

  it('is case-insensitive for the prefix', () => {
    const result = extractDirectives('#OGCAL:instagram:foo');
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].canonicalId, 'instagram:foo');
  });

  it('parses #ogcal:zoom:meetingid', () => {
    const result = extractDirectives('#ogcal:zoom:123456789');
    assert.strictEqual(result.tokens[0].type, 'link');
    assert.strictEqual(result.tokens[0].canonicalId, 'zoom:123456789');
    assert.strictEqual(result.tokens[0].label, 'Join Zoom');
  });

  it('parses #ogcal:discord:invitecode', () => {
    const result = extractDirectives('#ogcal:discord:AbCdEf');
    assert.strictEqual(result.tokens[0].canonicalId, 'discord:AbCdEf');
    assert.strictEqual(result.tokens[0].label, 'Join Discord');
  });

  it('parses #ogcal:eventbrite:12345', () => {
    const result = extractDirectives('#ogcal:eventbrite:12345');
    assert.strictEqual(result.tokens[0].canonicalId, 'eventbrite:12345');
    assert.strictEqual(result.tokens[0].label, 'RSVP on Eventbrite');
  });
});

describe('extractDirectives — image directives', () => {
  it('parses #ogcal:image:url', () => {
    const result = extractDirectives('#ogcal:image:https://example.com/flyer.png');
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].type, 'image');
    assert.strictEqual(result.tokens[0].url, 'https://example.com/flyer.png');
    assert.strictEqual(result.tokens[0].source, 'directive');
  });

  it('parses #showcal:image:drive:ABC123', () => {
    const result = extractDirectives('#showcal:image:drive:ABC123');
    assert.strictEqual(result.tokens[0].type, 'image');
    assert.strictEqual(result.tokens[0].canonicalId, 'image:drive:ABC123');
  });
});

describe('extractDirectives — scalar tag directives', () => {
  it('parses #ogcal:tag:fundraiser as scalar tag', () => {
    const result = extractDirectives('#ogcal:tag:fundraiser');
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].type, 'tag');
    assert.strictEqual(result.tokens[0].canonicalId, 'tag:fundraiser');
    assert.strictEqual(result.tokens[0].metadata.key, 'tag');
    assert.strictEqual(result.tokens[0].metadata.value, 'fundraiser');
  });

  it('parses #showcal:tag:outdoor', () => {
    const result = extractDirectives('#showcal:tag:outdoor');
    assert.strictEqual(result.tokens[0].canonicalId, 'tag:outdoor');
    assert.strictEqual(result.tokens[0].metadata.value, 'outdoor');
  });
});

describe('extractDirectives — key-value tag directives', () => {
  it('parses #ogcal:cost:$25 as key-value tag', () => {
    const result = extractDirectives('#ogcal:cost:$25');
    assert.strictEqual(result.tokens[0].type, 'tag');
    assert.strictEqual(result.tokens[0].canonicalId, 'tag:cost:$25');
    assert.strictEqual(result.tokens[0].metadata.key, 'cost');
    assert.strictEqual(result.tokens[0].metadata.value, '$25');
  });

  it('parses #ogcal:rsvp:https://form.com as key-value tag with URL value', () => {
    const result = extractDirectives('#ogcal:rsvp:https://form.com');
    assert.strictEqual(result.tokens[0].canonicalId, 'tag:rsvp:https://form.com');
    assert.strictEqual(result.tokens[0].metadata.key, 'rsvp');
    assert.strictEqual(result.tokens[0].metadata.value, 'https://form.com');
  });

  it('parses #ogcal:capacity:50', () => {
    const result = extractDirectives('#ogcal:capacity:50');
    assert.strictEqual(result.tokens[0].metadata.key, 'capacity');
    assert.strictEqual(result.tokens[0].metadata.value, '50');
  });
});

describe('extractDirectives — description stripping', () => {
  it('strips directive from description', () => {
    const result = extractDirectives('Join us! #ogcal:tag:fundraiser See you there');
    assert.ok(!result.description.includes('#ogcal'));
    assert.ok(result.description.includes('Join us!'));
    assert.ok(result.description.includes('See you there'));
  });

  it('strips multiple directives', () => {
    const result = extractDirectives('#ogcal:tag:outdoor #showcal:cost:$25 Event info');
    assert.strictEqual(result.tokens.length, 2);
    assert.ok(!result.description.includes('#ogcal'));
    assert.ok(!result.description.includes('#showcal'));
    assert.ok(result.description.includes('Event info'));
  });

  it('strips directive wrapped in HTML <a> tag', () => {
    const result = extractDirectives('Info <a href="#">#ogcal:tag:fundraiser</a> here');
    assert.strictEqual(result.tokens.length, 1);
    assert.ok(!result.description.includes('#ogcal'));
  });

  it('deduplicates identical directives', () => {
    const result = extractDirectives('#ogcal:tag:outdoor #ogcal:tag:outdoor');
    assert.strictEqual(result.tokens.length, 1);
  });

  it('deduplicates across prefixes (ogcal and showcal)', () => {
    const result = extractDirectives('#ogcal:tag:outdoor #showcal:tag:outdoor');
    assert.strictEqual(result.tokens.length, 1);
  });
});

describe('extractDirectives — edge cases', () => {
  it('returns empty tokens for null description', () => {
    const result = extractDirectives(null);
    assert.deepStrictEqual(result.tokens, []);
    assert.strictEqual(result.description, null);
  });

  it('returns empty tokens for description with no directives', () => {
    const result = extractDirectives('Just a plain description');
    assert.deepStrictEqual(result.tokens, []);
    assert.strictEqual(result.description, 'Just a plain description');
  });

  it('ignores malformed directive without value', () => {
    const result = extractDirectives('#ogcal:tag');
    assert.deepStrictEqual(result.tokens, []);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/directives.test.js`
Expected: FAIL — module `../src/util/directives.js` does not exist

- [ ] **Step 3: Implement extractDirectives**

In `src/util/directives.js`:

```js
import { cleanupHtml } from './sanitize.js';
import { normalizeImageUrl } from './images.js';

// Directive regex: #ogcal: or #showcal: followed by non-whitespace chars
const DIRECTIVE_PATTERN = /#(?:ogcal|showcal):(\S+)/gi;

// Map directive platform names to their labels and canonical prefix.
// The key must match the platform name used in the directive (e.g., #ogcal:instagram:handle).
const DIRECTIVE_PLATFORMS = {
  instagram:     { label: (v) => `Follow @${v} on Instagram`, canonicalPrefix: 'instagram' },
  facebook:      { label: (v) => `${v} on Facebook`, canonicalPrefix: 'facebook' },
  x:             { label: (v) => `Follow @${v} on X`, canonicalPrefix: 'x' },
  twitter:       { label: (v) => `Follow @${v} on X`, canonicalPrefix: 'x' },
  reddit:        { label: (v) => `r/${v} on Reddit`, canonicalPrefix: 'reddit' },
  youtube:       { label: () => 'Watch on YouTube', canonicalPrefix: 'youtube' },
  tiktok:        { label: (v) => `@${v} on TikTok`, canonicalPrefix: 'tiktok' },
  linkedin:      { label: () => 'View on LinkedIn', canonicalPrefix: 'linkedin' },
  discord:       { label: () => 'Join Discord', canonicalPrefix: 'discord' },
  zoom:          { label: () => 'Join Zoom', canonicalPrefix: 'zoom' },
  googlemeet:    { label: () => 'Join Google Meet', canonicalPrefix: 'googlemeet' },
  meet:          { label: () => 'Join Google Meet', canonicalPrefix: 'googlemeet' },
  eventbrite:    { label: () => 'RSVP on Eventbrite', canonicalPrefix: 'eventbrite' },
  luma:          { label: () => 'RSVP on Luma', canonicalPrefix: 'luma' },
  mobilize:      { label: () => 'RSVP on Mobilize', canonicalPrefix: 'mobilize' },
  actionnetwork: { label: () => 'Take Action', canonicalPrefix: 'actionnetwork' },
  gofundme:      { label: () => 'Donate on GoFundMe', canonicalPrefix: 'gofundme' },
  partiful:      { label: () => 'RSVP on Partiful', canonicalPrefix: 'partiful' },
  googleforms:   { label: () => 'Fill Out Form', canonicalPrefix: 'googleforms' },
  forms:         { label: () => 'Fill Out Form', canonicalPrefix: 'googleforms' },
  googlemaps:    { label: () => 'View on Map', canonicalPrefix: 'googlemaps' },
  maps:          { label: () => 'View on Map', canonicalPrefix: 'googlemaps' },
};

function parseDirective(body) {
  // body is everything after #ogcal: or #showcal:, e.g., "instagram:savebigbend"
  const colonIdx = body.indexOf(':');
  if (colonIdx === -1) return null; // malformed — no value

  const type = body.slice(0, colonIdx).toLowerCase();
  const value = body.slice(colonIdx + 1);
  if (!value) return null;

  // 1. Known platform?
  const platform = DIRECTIVE_PLATFORMS[type];
  if (platform) {
    return {
      canonicalId: `${platform.canonicalPrefix}:${value}`,
      type: 'link',
      source: 'directive',
      url: null,
      label: platform.label(value),
      metadata: {},
    };
  }

  // 2. Image?
  if (type === 'image') {
    const canonicalId = `image:${value}`;
    const url = value.startsWith('http') ? value : null;
    const normalized = url ? normalizeImageUrl(url) : null;
    return {
      canonicalId,
      type: 'image',
      source: 'directive',
      url: normalized || value,
      label: '',
      metadata: {},
    };
  }

  // 3. Scalar tag?
  if (type === 'tag') {
    return {
      canonicalId: `tag:${value}`,
      type: 'tag',
      source: 'directive',
      url: null,
      label: value,
      metadata: { key: 'tag', value },
    };
  }

  // 4. Key-value tag
  return {
    canonicalId: `tag:${type}:${value}`,
    type: 'tag',
    source: 'directive',
    url: value.startsWith('http') ? value : null,
    label: `${type}: ${value}`,
    metadata: { key: type, value },
  };
}

export function extractDirectives(description) {
  if (!description) return { tokens: [], description };

  const tokens = [];
  const seen = new Set();
  let cleaned = description;

  const matches = [...description.matchAll(DIRECTIVE_PATTERN)];
  for (const match of matches) {
    const fullMatch = match[0];
    const body = match[1];
    const token = parseDirective(body);
    if (!token) continue;

    if (!seen.has(token.canonicalId)) {
      seen.add(token.canonicalId);
      tokens.push(token);
    }

    // Strip the directive (and any wrapping <a> tag) from description
    const escaped = fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cleaned = cleaned.replace(new RegExp(`<a[^>]*>${escaped}</a>`, 'gi'), '');
    cleaned = cleaned.replace(fullMatch, '');
  }

  cleaned = cleanupHtml(cleaned);
  return { tokens, description: cleaned };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/directives.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/util/directives.js test/directives.test.js
git commit -m "feat: add directive parser for #ogcal:/#showcal: syntax"
```

---

### Task 4: Token-Producing Wrappers for Existing Extractors

**Files:**
- Modify: `src/util/links.js` — add `extractLinkTokens` that wraps `extractLinks`
- Modify: `src/util/images.js` — add `extractImageTokens` that wraps `extractImage`
- Modify: `src/util/attachments.js` — add `extractAttachmentTokens` that wraps `extractAttachments`
- Create: `test/token-extractors.test.js`

- [ ] **Step 1: Write failing tests for token-producing wrappers**

In `test/token-extractors.test.js`:

```js
const { describe, it, before } = require('node:test');
const assert = require('node:assert');

let extractLinkTokens, extractImageTokens, extractAttachmentTokens;

before(async () => {
  const links = await import('../src/util/links.js');
  const images = await import('../src/util/images.js');
  const attachments = await import('../src/util/attachments.js');
  extractLinkTokens = links.extractLinkTokens;
  extractImageTokens = images.extractImageTokens;
  extractAttachmentTokens = attachments.extractAttachmentTokens;
});

describe('extractLinkTokens', () => {
  it('produces tokens with canonicalId for Instagram URL', () => {
    const result = extractLinkTokens('Follow us https://www.instagram.com/savebigbend/');
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].canonicalId, 'instagram:savebigbend');
    assert.strictEqual(result.tokens[0].type, 'link');
    assert.strictEqual(result.tokens[0].source, 'url');
    assert.strictEqual(result.tokens[0].label, 'Follow @savebigbend on Instagram');
    assert.ok(!result.description.includes('instagram.com'));
  });

  it('deduplicates semantically equivalent URLs', () => {
    const result = extractLinkTokens('https://instagram.com/savebigbend https://www.instagram.com/savebigbend/');
    assert.strictEqual(result.tokens.length, 1);
    assert.ok(!result.description.includes('instagram.com'));
  });

  it('deduplicates x.com and twitter.com URLs', () => {
    const result = extractLinkTokens('https://x.com/foo https://twitter.com/foo');
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].canonicalId, 'x:foo');
  });
});

describe('extractImageTokens', () => {
  it('produces tokens with canonicalId for image URL', () => {
    const result = extractImageTokens('See https://example.com/flyer.png');
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].type, 'image');
    assert.strictEqual(result.tokens[0].canonicalId, 'image:example.com/flyer.png');
    assert.strictEqual(result.tokens[0].source, 'url');
  });

  it('produces token with Drive canonical ID', () => {
    const result = extractImageTokens('https://drive.google.com/file/d/ABC123/view');
    assert.strictEqual(result.tokens[0].canonicalId, 'image:drive:ABC123');
  });

  it('deduplicates same Drive image in different URL formats', () => {
    const result = extractImageTokens('https://drive.google.com/file/d/SAME/view https://drive.google.com/open?id=SAME');
    assert.strictEqual(result.tokens.length, 1);
  });
});

describe('extractAttachmentTokens', () => {
  it('produces tokens with canonicalId for PDF URL', () => {
    const result = extractAttachmentTokens('Get https://example.com/report.pdf');
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].type, 'attachment');
    assert.strictEqual(result.tokens[0].canonicalId, 'attachment:example.com/report.pdf');
    assert.strictEqual(result.tokens[0].source, 'url');
    assert.strictEqual(result.tokens[0].label, 'Download PDF');
  });

  it('produces token with Drive canonical ID', () => {
    const result = extractAttachmentTokens('https://drive.google.com/file/d/XYZ/view');
    assert.strictEqual(result.tokens[0].canonicalId, 'attachment:drive:XYZ');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/token-extractors.test.js`
Expected: FAIL — `extractLinkTokens is not a function`

- [ ] **Step 3: Implement token-producing wrappers**

Add to the bottom of `src/util/links.js`:

```js
import { normalizeUrl } from './tokens.js';

export function extractLinkTokens(description, config) {
  if (!description) return { tokens: [], description };
  description = description.replace(/&amp;/g, '&');
  const platforms = (config && config.knownPlatforms) || DEFAULT_PLATFORMS;
  const tokens = [];
  let cleaned = description;
  const seen = new Set();

  const urls = description.match(URL_PATTERN) || [];
  for (const url of urls) {
    const normalized = normalizeUrl(url);
    for (const platform of platforms) {
      if (platform.pattern.test(url)) {
        const canonicalId = platform.canonicalize ? platform.canonicalize(normalized) : null;
        if (canonicalId && seen.has(canonicalId)) {
          // Duplicate — still strip from description
          const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          cleaned = cleaned.replace(new RegExp(`<a[^>]*>${escapedUrl}</a>`, 'gi'), '');
          cleaned = cleaned.replace(url, '');
          break;
        }
        if (canonicalId) seen.add(canonicalId);
        const label = platform.labelFn ? platform.labelFn(url) : platform.label;
        tokens.push({
          canonicalId: canonicalId || `link:${normalized}`,
          type: 'link',
          source: 'url',
          url,
          label,
          metadata: {},
        });
        const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        cleaned = cleaned.replace(new RegExp(`<a[^>]*>${escapedUrl}</a>`, 'gi'), '');
        cleaned = cleaned.replace(url, '');
        break;
      }
    }
  }

  cleaned = cleanupHtml(cleaned);
  return { tokens, description: cleaned };
}
```

Add to the bottom of `src/util/images.js`:

```js
import { normalizeUrl } from './tokens.js';
import { DRIVE_ID_PATTERN } from './images.js'; // already in-file, just use it

function imageCanonicalId(originalUrl, normalizedUrl) {
  // Drive URLs: use file ID
  const driveMatch = originalUrl.match(DRIVE_ID_PATTERN);
  if (driveMatch) return `image:drive:${driveMatch[1]}`;

  // Dropbox URLs: use hash/filename from path
  const dropboxMatch = originalUrl.match(/dropbox\.com\/(?:scl\/fi|s)\/([^?]+)/);
  if (dropboxMatch) return `image:dropbox:${dropboxMatch[1]}`;

  // General: host + path (normalized)
  try {
    const u = new URL(normalizedUrl);
    return `image:${u.hostname.replace(/^www\./, '')}${u.pathname}`;
  } catch {
    return `image:${normalizedUrl}`;
  }
}

export function extractImageTokens(description, config) {
  if (!description) return { tokens: [], description };
  description = description.replace(/&amp;/g, '&');
  const extensions = (config && config.imageExtensions) || DEFAULT_IMAGE_EXTENSIONS;
  const pattern = buildImagePattern(extensions);
  const seen = new Set();
  const tokens = [];
  const originalUrls = [];
  let match;

  // Standard image URLs (by extension)
  while ((match = pattern.exec(description)) !== null) {
    const originalUrl = match[1];
    const normalized = normalizeImageUrl(originalUrl);
    const cid = imageCanonicalId(originalUrl, normalized || originalUrl);
    if (normalized && !seen.has(cid)) {
      seen.add(cid);
      tokens.push({
        canonicalId: cid,
        type: 'image',
        source: 'url',
        url: normalized,
        label: '',
        metadata: {},
      });
    }
    originalUrls.push(originalUrl);
  }

  // Google Drive image URLs
  DRIVE_URL_PATTERN.lastIndex = 0;
  while ((match = DRIVE_URL_PATTERN.exec(description)) !== null) {
    const originalUrl = match[0];
    const normalized = normalizeImageUrl(originalUrl);
    const cid = imageCanonicalId(originalUrl, normalized || originalUrl);
    if (normalized && !seen.has(cid)) {
      seen.add(cid);
      tokens.push({ canonicalId: cid, type: 'image', source: 'url', url: normalized, label: '', metadata: {} });
    }
    originalUrls.push(originalUrl);
  }

  // Dropbox image URLs
  DROPBOX_URL_PATTERN.lastIndex = 0;
  while ((match = DROPBOX_URL_PATTERN.exec(description)) !== null) {
    const originalUrl = match[0];
    const ext = getPathExtension(originalUrl);
    if (ext && NON_IMAGE_EXTENSIONS.has(ext)) continue;
    const normalized = normalizeImageUrl(originalUrl);
    const cid = imageCanonicalId(originalUrl, normalized || originalUrl);
    if (normalized && !seen.has(cid)) {
      seen.add(cid);
      tokens.push({ canonicalId: cid, type: 'image', source: 'url', url: normalized, label: '', metadata: {} });
    }
    originalUrls.push(originalUrl);
  }

  let cleaned = description;
  for (const url of originalUrls) {
    cleaned = stripUrl(cleaned, url);
  }
  cleaned = cleanupHtml(cleaned);
  return { tokens, description: cleaned };
}
```

Add to the bottom of `src/util/attachments.js`:

```js
import { normalizeUrl } from './tokens.js';

function attachmentCanonicalId(url) {
  const driveMatch = url.match(DRIVE_ID_PATTERN);
  if (driveMatch) return `attachment:drive:${driveMatch[1]}`;

  try {
    const u = new URL(url);
    return `attachment:${u.hostname.replace(/^www\./, '')}${u.pathname}`;
  } catch {
    return `attachment:${url}`;
  }
}

export function extractAttachmentTokens(description, config) {
  if (!description) return { tokens: [], description };
  description = description.replace(/&amp;/g, '&');

  const tokens = [];
  let cleaned = description;
  const seen = new Set();

  const urls = description.match(URL_PATTERN) || [];
  for (const url of urls) {
    const classification = classifyUrl(url);
    if (!classification) continue;

    const cid = attachmentCanonicalId(url);
    if (seen.has(cid)) {
      cleaned = stripUrl(cleaned, url);
      continue;
    }
    seen.add(cid);

    const normalizedUrl = normalizeAttachmentUrl(url);
    tokens.push({
      canonicalId: cid,
      type: 'attachment',
      source: 'url',
      url: normalizedUrl,
      label: classification.label,
      metadata: { fileType: classification.type },
    });
    cleaned = stripUrl(cleaned, url);
  }

  cleaned = cleanupHtml(cleaned);
  return { tokens, description: cleaned };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/token-extractors.test.js`
Expected: All tests PASS

- [ ] **Step 5: Run all existing tests to verify no regressions**

Run: `node --test test/*.test.js`
Expected: All tests PASS — the existing `extractLinks`, `extractImage`, and `extractAttachments` functions are unchanged; the new token wrappers are additive.

- [ ] **Step 6: Commit**

```bash
git add src/util/links.js src/util/images.js src/util/attachments.js test/token-extractors.test.js
git commit -m "feat: add token-producing wrappers for image, link, and attachment extractors"
```

---

### Task 5: Integrate Token Pipeline into enrichEvent

**Files:**
- Modify: `src/data.js` — rewrite `enrichEvent` to use `TokenSet` and token-producing extractors
- Modify: `test/data.test.js` — add integration tests

- [ ] **Step 1: Write failing integration tests**

Add to `test/data.test.js`:

```js
let enrichEvent;

before(async () => {
  // enrichEvent is not exported — we test through transformGoogleEvents + loadData
  // Instead, test the enrichment behavior by importing transformGoogleEvents
  const mod = await import('../src/data.js');
  // transformGoogleEvents calls enrichEvent internally
  transformGoogleEvents = mod.transformGoogleEvents;
});

describe('enrichEvent — token pipeline deduplication', () => {
  it('deduplicates exact duplicate platform links', () => {
    const data = transformGoogleEvents({
      summary: 'Test', timeZone: 'UTC',
      items: [{
        id: '1', summary: 'Test',
        description: 'https://instagram.com/savebigbend https://instagram.com/savebigbend',
        start: { dateTime: '2026-04-10T10:00:00Z' }, end: { dateTime: '2026-04-10T11:00:00Z' },
      }],
    });
    assert.strictEqual(data.events[0].links.length, 1);
    assert.ok(!data.events[0].description.includes('instagram.com'));
  });

  it('deduplicates semantically equivalent URLs (www vs non-www)', () => {
    const data = transformGoogleEvents({
      summary: 'Test', timeZone: 'UTC',
      items: [{
        id: '1', summary: 'Test',
        description: 'https://instagram.com/savebigbend https://www.instagram.com/savebigbend/',
        start: { dateTime: '2026-04-10T10:00:00Z' }, end: { dateTime: '2026-04-10T11:00:00Z' },
      }],
    });
    assert.strictEqual(data.events[0].links.length, 1);
  });

  it('deduplicates twitter.com and x.com URLs', () => {
    const data = transformGoogleEvents({
      summary: 'Test', timeZone: 'UTC',
      items: [{
        id: '1', summary: 'Test',
        description: 'https://x.com/foo https://twitter.com/foo',
        start: { dateTime: '2026-04-10T10:00:00Z' }, end: { dateTime: '2026-04-10T11:00:00Z' },
      }],
    });
    assert.strictEqual(data.events[0].links.length, 1);
  });

  it('extracts directives and produces tokens', () => {
    const data = transformGoogleEvents({
      summary: 'Test', timeZone: 'UTC',
      items: [{
        id: '1', summary: 'Test',
        description: 'Event info #ogcal:tag:fundraiser #ogcal:cost:$25',
        start: { dateTime: '2026-04-10T10:00:00Z' }, end: { dateTime: '2026-04-10T11:00:00Z' },
      }],
    });
    assert.strictEqual(data.events[0].tags.length, 2);
    assert.ok(!data.events[0].description.includes('#ogcal'));
  });

  it('deduplicates directive and URL producing same canonical ID', () => {
    const data = transformGoogleEvents({
      summary: 'Test', timeZone: 'UTC',
      items: [{
        id: '1', summary: 'Test',
        description: '#ogcal:instagram:savebigbend https://instagram.com/savebigbend',
        start: { dateTime: '2026-04-10T10:00:00Z' }, end: { dateTime: '2026-04-10T11:00:00Z' },
      }],
    });
    assert.strictEqual(data.events[0].links.length, 1);
    assert.ok(!data.events[0].description.includes('#ogcal'));
    assert.ok(!data.events[0].description.includes('instagram.com'));
  });

  it('exposes tags on the event object', () => {
    const data = transformGoogleEvents({
      summary: 'Test', timeZone: 'UTC',
      items: [{
        id: '1', summary: 'Test',
        description: '#ogcal:tag:outdoor #ogcal:rsvp:https://form.com',
        start: { dateTime: '2026-04-10T10:00:00Z' }, end: { dateTime: '2026-04-10T11:00:00Z' },
      }],
    });
    const tags = data.events[0].tags;
    assert.strictEqual(tags.length, 2);
    assert.deepStrictEqual(tags[0], { key: 'tag', value: 'outdoor' });
    assert.deepStrictEqual(tags[1], { key: 'rsvp', value: 'https://form.com' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/data.test.js`
Expected: FAIL — `enrichEvent` does not use token pipeline yet, no `tags` field on events

- [ ] **Step 3: Rewrite enrichEvent to use token pipeline**

Modify `src/data.js` — update imports and rewrite `enrichEvent`:

```js
import { normalizeImageUrl, extractImageTokens } from './util/images.js';
import { extractLinkTokens } from './util/links.js';
import { detectFormat } from './util/description.js';
import { deriveTypeFromMimeType, labelForType, extractAttachmentTokens } from './util/attachments.js';
import { extractDirectives } from './util/directives.js';
import { TokenSet } from './util/tokens.js';
```

Rewrite `enrichEvent`:

```js
function enrichEvent(event, config) {
  let description = event.description || '';
  let image = event.image || null;
  let images = (event.images && event.images.length > 0) ? event.images : [];
  let links = (event.links && event.links.length > 0) ? event.links : [];

  const tokenSet = new TokenSet();

  // Step 1: Extract directives (#ogcal:/#showcal: syntax)
  if (description) {
    const result = extractDirectives(description);
    description = result.description;
    tokenSet.addAll(result.tokens);
  }

  // Step 2: Extract images from description if not already set
  if (images.length === 0 && description) {
    const result = extractImageTokens(description, config);
    description = result.description;
    tokenSet.addAll(result.tokens);
  }

  // Fallback: check attachments for images
  const attachmentImages = getImagesFromAttachments(event._imageAttachments || event.attachments);
  if (attachmentImages.length > 0) {
    const imgTokens = tokenSet.ofType('image');
    const existing = new Set(imgTokens.map(t => t.url));
    for (const ai of attachmentImages) {
      if (!existing.has(ai)) {
        tokenSet.add({
          canonicalId: `image:attachment:${ai}`,
          type: 'image',
          source: 'url',
          url: ai,
          label: '',
          metadata: {},
        });
      }
    }
  }

  // Step 3: Extract links from description if not already populated
  if (links.length === 0 && description) {
    const result = extractLinkTokens(description, config);
    description = result.description;
    tokenSet.addAll(result.tokens);
  }

  // Step 4: Extract file attachments from description
  let attachments = (event.attachments && event.attachments.length > 0) ? event.attachments : [];
  if (description) {
    const result = extractAttachmentTokens(description, config);
    if (result.tokens.length > 0) {
      tokenSet.addAll(result.tokens);
      description = result.description;
    }
  }

  // Build output arrays from token set
  const imageTokens = tokenSet.ofType('image');
  if (imageTokens.length > 0 && images.length === 0) {
    images = imageTokens.map(t => t.url);
  }
  if (!image && images.length > 0) image = images[0];

  const linkTokens = tokenSet.ofType('link');
  if (linkTokens.length > 0 && links.length === 0) {
    links = linkTokens.map(t => ({ label: t.label, url: t.url || '' }));
  }

  const attachmentTokens = tokenSet.ofType('attachment');
  if (attachmentTokens.length > 0) {
    const tokenAttachments = attachmentTokens.map(t => ({
      label: t.label,
      url: t.url,
      type: t.metadata.fileType || 'file',
    }));
    attachments = [...attachments, ...tokenAttachments];
  }

  // Build tags from tag tokens
  const tagTokens = tokenSet.ofType('tag');
  const tags = tagTokens.map(t => ({ key: t.metadata.key, value: t.metadata.value }));

  // Detect format if not set
  const descriptionFormat = event.descriptionFormat || detectFormat(description);

  const { _imageAttachments, ...rest } = event;
  return { ...rest, description, descriptionFormat, image, images, links, attachments, tags };
}
```

- [ ] **Step 4: Run integration tests to verify they pass**

Run: `node --test test/data.test.js`
Expected: All tests PASS

- [ ] **Step 5: Run full test suite for regressions**

Run: `node --test test/*.test.js`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/data.js test/data.test.js
git commit -m "feat: integrate token pipeline into enrichEvent with directive support"
```

---

### Task 6: Tag Rendering in Detail View

**Files:**
- Modify: `src/views/detail.js` — add tag rendering
- Modify: `og-cal.css` — add tag styles

- [ ] **Step 1: Add tag rendering to detail.js**

In `src/views/detail.js`, after the `meta` section is appended to `content` (after line 115 in the current file), add tag rendering:

```js
  // Render tags (scalar tags and key-value text tags)
  const scalarAndTextTags = (event.tags || []).filter(t => {
    if (t.key === 'tag') return true; // scalar tag
    if (t.value && !t.value.startsWith('http')) return true; // key-value text
    return false;
  });

  if (scalarAndTextTags.length > 0) {
    const tagsDiv = document.createElement('div');
    tagsDiv.className = 'ogcal-detail-tags';
    for (const tag of scalarAndTextTags) {
      const span = document.createElement('span');
      span.className = 'ogcal-detail-tag';
      span.textContent = tag.key === 'tag' ? tag.value : `${tag.key}: ${tag.value}`;
      tagsDiv.appendChild(span);
    }
    content.appendChild(tagsDiv);
  }
```

Then, in the links section (where `event.links` is rendered), also render key-value URL tags as buttons:

```js
  // Collect key-value URL tags to render alongside links
  const urlTags = (event.tags || []).filter(t => t.key !== 'tag' && t.value && t.value.startsWith('http'));
  const allLinks = [...(event.links || []), ...urlTags.map(t => ({ label: t.key, url: t.value }))];

  if (allLinks.length > 0) {
    const linksDiv = document.createElement('div');
    linksDiv.className = 'ogcal-detail-links';
    for (const link of allLinks) {
      const a = document.createElement('a');
      a.className = 'ogcal-detail-link';
      a.href = link.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = link.label;
      linksDiv.appendChild(a);
    }
    content.appendChild(linksDiv);
  }
```

This replaces the existing links rendering block — the new version includes both platform links and URL tags.

- [ ] **Step 2: Add tag CSS styles**

Append to `og-cal.css`, before the responsive media query section:

```css
.ogcal-detail-tags {
  margin-top: 0.75rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.ogcal-detail-tag {
  display: inline-block;
  padding: 0.25rem 0.625rem;
  background: var(--ogcal-surface);
  color: var(--ogcal-text-secondary);
  border: 1px solid var(--ogcal-text-secondary);
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 500;
}
```

- [ ] **Step 3: Run full test suite**

Run: `node --test test/*.test.js`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/views/detail.js og-cal.css
git commit -m "feat: render tags as badge pills in event detail view"
```

---

### Task 7: Build and Final Verification

**Files:**
- Modify: `dist/` — rebuild

- [ ] **Step 1: Run full test suite one final time**

Run: `node --test test/*.test.js`
Expected: All tests PASS

- [ ] **Step 2: Rebuild dist**

Run: `node build.js`
Expected: Build completes without errors

- [ ] **Step 3: Commit the build**

```bash
git add dist/
git commit -m "build: rebuild dist with unified token pipeline"
```

- [ ] **Step 4: Verify git status is clean**

Run: `git status`
Expected: Clean working tree
