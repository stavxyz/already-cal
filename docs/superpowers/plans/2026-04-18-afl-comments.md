# AFL & Comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add comment stripping (`// ` line syntax) to the description pipeline, name the format "AFL" (Already Format Language), and document it.

**Architecture:** A new `src/util/comments.js` module exports `stripComments()` which runs as the first step in `enrichEvent()` before directives. Documentation adds a new `docs/afl.md` reference page and updates existing docs to reference AFL and show the comment extraction step.

**Tech Stack:** Node.js built-in test runner, JSDOM, Biome

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/util/comments.js` | Create | `stripComments(description)` — remove `// ` comment lines |
| `src/data.js` | Modify | Call `stripComments()` as first step in `enrichEvent()` |
| `test/comments.test.cjs` | Create | Unit tests for `stripComments()` |
| `test/data.test.cjs` | Modify | Integration test: comments stripped before directive extraction |
| `docs/afl.md` | Create | AFL format reference page |
| `docs/architecture.md` | Modify | Add comments to pipeline diagram, reference AFL |
| `docs/event-schema.md` | Modify | Link to `afl.md` from Description Rendering section |
| `docs/development.md` | Modify | Add `comments.js` to project structure tree |
| `README.md` | Modify | Add AFL mention, add `docs/afl.md` to Documentation table |

---

### Task 1: Comment stripping — tests

**Files:**
- Create: `test/comments.test.cjs`

- [ ] **Step 1: Write failing tests for `stripComments()`**

```js
const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let stripComments;

before(async () => {
  const mod = await import("../src/util/comments.js");
  stripComments = mod.stripComments;
});

describe("stripComments", () => {
  it("strips a basic comment line", () => {
    assert.strictEqual(stripComments("// hello"), "");
  });

  it("strips a comment with leading whitespace", () => {
    assert.strictEqual(stripComments("  // indented comment"), "");
  });

  it("strips a tab-indented comment", () => {
    assert.strictEqual(stripComments("\t// tab comment"), "");
  });

  it("preserves text without comment prefix", () => {
    assert.strictEqual(stripComments("hello world"), "hello world");
  });

  it("does NOT strip // without a trailing space", () => {
    assert.strictEqual(stripComments("//nospace"), "//nospace");
  });

  it("does NOT strip mid-line //", () => {
    const input = "visit us // open daily";
    assert.strictEqual(stripComments(input), input);
  });

  it("preserves URLs with ://", () => {
    const input = "https://example.com/path";
    assert.strictEqual(stripComments(input), input);
  });

  it("strips multiple consecutive comment lines", () => {
    const input = "// line 1\n// line 2\n// line 3";
    assert.strictEqual(stripComments(input), "");
  });

  it("strips comments mixed with content without leaving blank lines", () => {
    const input = "line one\n// comment\nline two";
    assert.strictEqual(stripComments(input), "line one\nline two");
  });

  it("strips an empty comment (just // and a space)", () => {
    assert.strictEqual(stripComments("// "), "");
  });

  it("decodes &amp; before matching", () => {
    assert.strictEqual(stripComments("&amp;// not a comment"), "&// not a comment");
  });

  it("strips comment after &amp; decoding when line-leading", () => {
    assert.strictEqual(stripComments("// has &amp; entity"), "");
  });

  it("handles empty string", () => {
    assert.strictEqual(stripComments(""), "");
  });

  it("handles null/undefined gracefully", () => {
    assert.strictEqual(stripComments(null), "");
    assert.strictEqual(stripComments(undefined), "");
  });

  it("does not leave trailing newline after stripping last line", () => {
    const input = "content\n// comment";
    assert.strictEqual(stripComments(input), "content");
  });

  it("does not leave leading newline after stripping first line", () => {
    const input = "// comment\ncontent";
    assert.strictEqual(stripComments(input), "content");
  });

  it("collapses multiple blank lines left by comment removal", () => {
    const input = "above\n\n// comment\n\nbelow";
    const result = stripComments(input);
    assert.ok(!result.includes("\n\n\n"), "should not have 3+ consecutive newlines");
    assert.strictEqual(result, "above\n\nbelow");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/comments.test.cjs`
Expected: FAIL — `Cannot find module '../src/util/comments.js'`

- [ ] **Step 3: Commit**

```bash
git add test/comments.test.cjs
git commit -m "test: add failing tests for comment stripping (issue #38)"
```

---

### Task 2: Comment stripping — implementation

**Files:**
- Create: `src/util/comments.js`

- [ ] **Step 1: Implement `stripComments()`**

```js
const COMMENT_RE = /^[ \t]*\/\/ .*$/gm;

/**
 * Strip AFL comment lines from a description.
 * Comments start with // (followed by a space) at the beginning of a line,
 * with optional leading whitespace. Entire comment lines are removed.
 */
export function stripComments(description) {
  if (!description) return "";
  // Decode HTML entities before matching (consistent with other extractors)
  let text = description.replace(/&amp;/g, "&");
  // Remove comment lines
  text = text.replace(COMMENT_RE, "");
  // Clean up: collapse runs of 3+ newlines to 2, trim leading/trailing newlines
  text = text.replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "").replace(/\n+$/, "");
  return text;
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `node --test test/comments.test.cjs`
Expected: All 17 tests PASS

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: All existing tests still pass

- [ ] **Step 4: Run linter**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/util/comments.js
git commit -m "feat: add stripComments() for AFL comment syntax (issue #38)"
```

---

### Task 3: Integrate into enrichEvent pipeline

**Files:**
- Modify: `src/data.js:1-10` (imports), `src/data.js:72-79` (enrichEvent body)
- Modify: `test/data.test.cjs` (add integration test)

- [ ] **Step 1: Write failing integration test**

Add to the end of `test/data.test.cjs`:

```js
describe("enrichEvent — AFL comments", () => {
  it("strips comment lines before processing directives", () => {
    const event = {
      id: "comment-test",
      title: "Test",
      description: "// #already:tag:disabled\n#already:tag:active\nVisible text",
      location: "",
      start: "2099-06-15T10:00:00-05:00",
      end: "2099-06-15T11:00:00-05:00",
      allDay: false,
      image: null,
      images: [],
      links: [],
      attachments: [],
      tags: [],
      featured: false,
      hidden: false,
      htmlLink: "",
    };
    const result = enrichEvent(event, {});
    // The commented-out tag directive should NOT be processed
    assert.strictEqual(result.tags.length, 1);
    assert.strictEqual(result.tags[0].value, "active");
    // The comment line should not appear in the description
    assert.ok(!result.description.includes("// #already"));
    assert.ok(result.description.includes("Visible text"));
  });

  it("strips comment lines before image extraction", () => {
    const event = {
      id: "comment-img",
      title: "Test",
      description: "// https://example.com/photo.png\nhttps://example.com/real.png",
      location: "",
      start: "2099-06-15T10:00:00-05:00",
      end: "2099-06-15T11:00:00-05:00",
      allDay: false,
      image: null,
      images: [],
      links: [],
      attachments: [],
      tags: [],
      featured: false,
      hidden: false,
      htmlLink: "",
    };
    const result = enrichEvent(event, {});
    // Only the non-commented image should be extracted
    assert.strictEqual(result.images.length, 1);
    assert.strictEqual(result.images[0], "https://example.com/real.png");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/data.test.cjs`
Expected: FAIL — comment lines are not yet stripped in enrichEvent

- [ ] **Step 3: Add import and call in `enrichEvent()`**

In `src/data.js`, add to the imports (after line 6):

```js
import { stripComments } from "./util/comments.js";
```

In `enrichEvent()`, add comment stripping as the first step. Replace lines 72-73:

```js
  // Step 1: Extract directives (#already: syntax)
  if (description) {
```

With:

```js
  // Step 0: Strip AFL comments (// lines)
  description = stripComments(description);

  // Step 1: Extract directives (#already: syntax)
  if (description) {
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/data.test.cjs`
Expected: All tests PASS (existing + 2 new)

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/data.js test/data.test.cjs
git commit -m "feat: integrate comment stripping into enrichEvent pipeline (issue #38)"
```

---

### Task 4: Build dist

**Files:**
- Modify: `dist/` (rebuilt)

- [ ] **Step 1: Rebuild**

Run: `npm run build`
Expected: Clean build, no errors

- [ ] **Step 2: Verify clean git state for dist**

Run: `git diff --stat dist/`
Expected: Shows changes to `dist/already-cal.js` and `dist/already-cal.min.js` (comment stripping code added)

- [ ] **Step 3: Commit**

```bash
git add dist/
git commit -m "build: rebuild dist with AFL comment support"
```

---

### Task 5: Documentation — AFL reference page

**Files:**
- Create: `docs/afl.md`

- [ ] **Step 1: Write the AFL reference page**

```markdown
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

## Directives

Directives let you control already-cal behavior using `#already:<type>:<value>` syntax. They are extracted and removed from the rendered description.

```
#already:instagram:savebigbend     → "Follow @savebigbend on Instagram"
#already:image:https://example.com/flyer.png  → adds image to gallery
#already:tag:fundraiser            → filterable tag badge
#already:featured                  → pins event to top
#already:hidden                    → hides from views
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

All extractors decode `&amp;` to `&` before matching (Google Calendar HTML-encodes ampersands). Tokens from all stages share a `TokenSet` that enforces deduplication by canonical ID — a directive and a URL pointing to the same resource produce one entry.
```

- [ ] **Step 2: Commit**

```bash
git add docs/afl.md
git commit -m "docs: add AFL (Already Format Language) reference page (issue #38)"
```

---

### Task 6: Documentation updates — existing files

**Files:**
- Modify: `README.md:465-473` (Description Rendering section)
- Modify: `README.md:566-573` (Documentation table)
- Modify: `docs/architecture.md:20-51` (Data Pipeline diagram and summary)
- Modify: `docs/event-schema.md:69-81` (Description Rendering section)
- Modify: `docs/development.md:52-60` (util/ file tree)

- [ ] **Step 1: Update README.md — Description Rendering section**

Replace the Description Rendering section (lines 465-473) with:

```markdown
## Description Rendering

Event descriptions are written in **AFL (Already Format Language)** — a superset of plain text, HTML, and markdown that adds comments, directives, and automatic URL extraction. See the **[AFL reference](docs/afl.md)** for the full format specification.

The base format is auto-detected:

- **HTML** (contains `<tag>`) — sanitized to allowed tags and attributes
- **Markdown** (contains `# headings`, `**bold**`, `[links](url)`, `- lists`) — parsed with [marked](https://github.com/markedjs/marked), then sanitized
- **Plain text** (default) — escaped, newlines converted to `<br>`

Comment lines (`// `) are stripped before rendering. Extracted URLs (images, platform links, file attachments, directives) are removed from the rendered description. Sanitization rules are configurable via `sanitization` config.
```

- [ ] **Step 2: Update README.md — Documentation table**

Add a row to the Documentation table (after the Directives Reference row):

```markdown
| [AFL Reference](docs/afl.md) | Already Format Language: comments, directives, URL extraction, format detection |
```

- [ ] **Step 3: Update docs/architecture.md — Data Pipeline**

In the `enrichEvent()` section of the pipeline diagram (lines 20-26), add comments as step 0:

```
enrichEvent() — per event
  Processes the description in this order:
  0. Comments — // lines stripped (AFL comment syntax)
  1. Directives — #already: tokens extracted and removed
  2. Images — image URLs, Drive links, Dropbox links extracted and removed
  3. Links — platform URLs extracted and removed
  4. Attachments — file URLs (.pdf, .doc, etc.) extracted and removed
  All stages share a TokenSet for deduplication by canonical ID.
  Pre-set values (non-empty images/links arrays) skip extraction.
```

Update the summary line (line 51) to mention comments.js:

```
Data loading is in `src/data.js`. Enrichment helpers are in `src/util/` (comments.js, directives.js, images.js, links.js, attachments.js). The `TokenSet` deduplication container is in `src/util/tokens.js`.
```

- [ ] **Step 4: Update docs/event-schema.md — Description Rendering section**

Replace the Description Rendering section (lines 69-81) with:

```markdown
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
```

- [ ] **Step 5: Update docs/development.md — project structure**

In the `src/util/` section (around line 52), add `comments.js` as the first entry:

```
├── util/
│   ├── comments.js         # AFL comment stripping (// line syntax)
│   ├── tokens.js           # TokenSet — deduplication container with canonical IDs
```

- [ ] **Step 6: Run linter on all changed files**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add README.md docs/architecture.md docs/event-schema.md docs/development.md
git commit -m "docs: update existing docs for AFL and comment support (issue #38)"
```

---

## Self-Review

**Spec coverage:**
- [x] Name the format "AFL" → Task 5 (afl.md), Task 6 (existing doc updates)
- [x] Comment syntax `// ` → Task 1 (tests), Task 2 (implementation)
- [x] Comments as first extraction step → Task 3 (pipeline integration)
- [x] Internal notes use case → Task 5 (afl.md "Use comments to" section)
- [x] Commenting out directives use case → Task 1 (integration test), Task 5 (afl.md)
- [x] `docs/afl.md` reference page → Task 5
- [x] README.md updates → Task 6 steps 1-2
- [x] architecture.md pipeline update → Task 6 step 3
- [x] event-schema.md link to afl.md → Task 6 step 4
- [x] development.md file tree → Task 6 step 5
- [x] Build dist → Task 4
- [x] `&amp;` decoding → Task 2 implementation, Task 1 tests

**Placeholder scan:** No TBDs, TODOs, or vague steps. All code blocks are complete.

**Type consistency:** `stripComments` is consistently named across all tasks. Import path is `./util/comments.js` everywhere.
