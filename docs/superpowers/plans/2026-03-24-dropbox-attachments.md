# Dropbox Image Support & Attachment Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Dropbox image URL support to og-cal and create a generalized attachment extraction system for non-image file URLs (PDF, docs, etc.) from any host.

**Architecture:** Extend `images.js` with Dropbox URL detection/normalization alongside existing Drive support. Create a new `attachments.js` utility for host-agnostic file attachment extraction. Refactor `data.js` to consolidate the dual enrichment paths and add attachment extraction to the pipeline. Render attachments in the detail view.

**Tech Stack:** Vanilla JavaScript (ES modules), Node.js native test runner, esbuild

**Spec:** `docs/superpowers/specs/2026-03-24-dropbox-attachments-design.md`

---

### Task 1: Add Dropbox URL normalization to images.js

**Files:**
- Modify: `src/util/images.js`
- Test: `test/images.test.js`

- [ ] **Step 1: Write failing tests for `normalizeImageUrl` with Dropbox URLs**

Add to `test/images.test.js` inside the `normalizeImageUrl` describe block:

```javascript
it('normalizes Dropbox scl/fi URL with dl=0 to raw=1', () => {
  const url = 'https://www.dropbox.com/scl/fi/abc123hash/photo.jpg?rlkey=xyz789&dl=0';
  assert.strictEqual(
    normalizeImageUrl(url),
    'https://www.dropbox.com/scl/fi/abc123hash/photo.jpg?rlkey=xyz789&raw=1'
  );
});

it('normalizes Dropbox scl/fi URL without dl param — appends &raw=1', () => {
  const url = 'https://www.dropbox.com/scl/fi/abc123hash/photo.jpg?rlkey=xyz789';
  assert.strictEqual(
    normalizeImageUrl(url),
    'https://www.dropbox.com/scl/fi/abc123hash/photo.jpg?rlkey=xyz789&raw=1'
  );
});

it('normalizes legacy Dropbox /s/ URL with dl=0', () => {
  const url = 'https://www.dropbox.com/s/abc123/flyer.png?dl=0';
  assert.strictEqual(
    normalizeImageUrl(url),
    'https://www.dropbox.com/s/abc123/flyer.png?raw=1'
  );
});

it('normalizes legacy Dropbox /s/ URL without query string — appends ?raw=1', () => {
  const url = 'https://www.dropbox.com/s/abc123/flyer.png';
  assert.strictEqual(
    normalizeImageUrl(url),
    'https://www.dropbox.com/s/abc123/flyer.png?raw=1'
  );
});

it('passes through dl.dropboxusercontent.com URLs unchanged', () => {
  const url = 'https://dl.dropboxusercontent.com/s/abc123/photo.jpg';
  assert.strictEqual(normalizeImageUrl(url), url);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/stavxyz/src/og-cal && npm test`
Expected: 5 new tests FAIL (normalizeImageUrl returns the URL unchanged for Dropbox)

- [ ] **Step 3: Implement Dropbox normalization in `normalizeImageUrl`**

In `src/util/images.js`, add a Dropbox detection pattern and update `normalizeImageUrl`:

```javascript
// Dropbox share URL patterns: /scl/fi/ (current) and /s/ (legacy)
const DROPBOX_PATTERN = /(?:www\.)?dropbox\.com\/(?:scl\/fi|s)\//;

// dl.dropboxusercontent.com is already direct-serve
const DROPBOX_DIRECT_PATTERN = /dl\.dropboxusercontent\.com/;

export function normalizeImageUrl(url) {
  if (!url) return null;

  // Google Drive → lh3.googleusercontent.com
  const m = url.match(DRIVE_ID_PATTERN);
  if (m) return `https://lh3.googleusercontent.com/d/${m[1]}`;

  // Dropbox direct URLs — already servable
  if (DROPBOX_DIRECT_PATTERN.test(url)) return url;

  // Dropbox share URLs — normalize to raw=1
  if (DROPBOX_PATTERN.test(url)) {
    if (url.includes('dl=0')) return url.replace('dl=0', 'raw=1');
    if (url.includes('?')) return url + '&raw=1';
    return url + '?raw=1';
  }

  return url;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/stavxyz/src/og-cal && npm test`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/stavxyz/src/og-cal && git add src/util/images.js test/images.test.js && git commit -m "feat: add Dropbox URL normalization to normalizeImageUrl"
```

---

### Task 2: Add Dropbox image extraction to extractImage

**Files:**
- Modify: `src/util/images.js`
- Test: `test/images.test.js`

- [ ] **Step 1: Write failing tests for Dropbox image extraction**

Add a new describe block to `test/images.test.js`:

```javascript
describe('extractImage — Dropbox URLs', () => {
  it('extracts a Dropbox scl/fi image URL with rlkey', () => {
    const url = 'https://www.dropbox.com/scl/fi/abc123/poster.jpg?rlkey=xyz&dl=0';
    const desc = `Check out the flyer: ${url}`;
    const result = extractImage(desc);
    assert.strictEqual(result.image, 'https://www.dropbox.com/scl/fi/abc123/poster.jpg?rlkey=xyz&raw=1');
    assert.strictEqual(result.images.length, 1);
    assert.ok(!result.description.includes('dropbox.com'));
  });

  it('extracts a legacy Dropbox /s/ image URL', () => {
    const desc = 'Poster: https://www.dropbox.com/s/abc123/flyer.png?dl=0';
    const result = extractImage(desc);
    assert.strictEqual(result.image, 'https://www.dropbox.com/s/abc123/flyer.png?raw=1');
    assert.ok(!result.description.includes('dropbox.com'));
  });

  it('extracts dl.dropboxusercontent.com URL unchanged', () => {
    const url = 'https://dl.dropboxusercontent.com/s/abc123/photo.jpg';
    const desc = `Image: ${url}`;
    const result = extractImage(desc);
    assert.strictEqual(result.image, url);
    assert.ok(!result.description.includes('dropboxusercontent.com'));
  });

  it('skips Dropbox URL with non-image extension (.pdf)', () => {
    const desc = 'Download: https://www.dropbox.com/scl/fi/abc123/report.pdf?rlkey=xyz&dl=0';
    const result = extractImage(desc);
    assert.strictEqual(result.image, null);
    assert.deepStrictEqual(result.images, []);
    assert.ok(result.description.includes('dropbox.com'));
  });

  it('skips Dropbox URL with .docx extension', () => {
    const desc = 'Doc: https://www.dropbox.com/scl/fi/abc123/notes.docx?rlkey=xyz&dl=0';
    const result = extractImage(desc);
    assert.strictEqual(result.image, null);
    assert.deepStrictEqual(result.images, []);
  });

  it('extracts extensionless Dropbox URL optimistically', () => {
    const desc = 'Photo: https://www.dropbox.com/scl/fi/abc123hash/somefile?rlkey=xyz&dl=0';
    const result = extractImage(desc);
    assert.strictEqual(result.images.length, 1);
    assert.ok(!result.description.includes('dropbox.com'));
  });

  it('extracts multiple Dropbox image URLs', () => {
    const desc = 'https://www.dropbox.com/scl/fi/a/one.jpg?rlkey=r1&dl=0 and https://www.dropbox.com/scl/fi/b/two.png?rlkey=r2&dl=0';
    const result = extractImage(desc);
    assert.strictEqual(result.images.length, 2);
  });

  it('strips Dropbox URL wrapped in <a> tag', () => {
    const url = 'https://www.dropbox.com/scl/fi/abc/pic.jpg?rlkey=xyz&dl=0';
    const desc = `See <a href="${url}">${url}</a> here`;
    const result = extractImage(desc);
    assert.strictEqual(result.images.length, 1);
    assert.ok(!result.description.includes('dropbox.com'));
  });

  it('deduplicates same Dropbox URL appearing twice', () => {
    const url = 'https://www.dropbox.com/scl/fi/abc/pic.jpg?rlkey=xyz&dl=0';
    const desc = `First: ${url} Second: ${url}`;
    const result = extractImage(desc);
    assert.strictEqual(result.images.length, 1);
    assert.ok(!result.description.includes('dropbox.com'));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/stavxyz/src/og-cal && npm test`
Expected: New Dropbox extractImage tests FAIL

- [ ] **Step 3: Implement Dropbox extraction in `extractImage`**

In `src/util/images.js`, add constants and update `extractImage`:

```javascript
// Known non-image extensions — these are left for attachment extraction
const NON_IMAGE_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'zip', 'txt'
]);

// Full-URL Dropbox pattern for scanning descriptions
const DROPBOX_URL_PATTERN = /https?:\/\/(?:(?:www\.)?dropbox\.com\/(?:scl\/fi|s)\/|dl\.dropboxusercontent\.com\/)[^\s<>"]+/gi;

/**
 * Extract the file extension from a URL's path (last segment before query string).
 * Returns lowercase extension without dot, or null if none found.
 */
function getPathExtension(url) {
  try {
    const pathname = new URL(url).pathname;
    const lastSegment = pathname.split('/').pop();
    const dotIdx = lastSegment.lastIndexOf('.');
    if (dotIdx === -1) return null;
    return lastSegment.slice(dotIdx + 1).toLowerCase();
  } catch { return null; }
}
```

Then add a Dropbox extraction block in `extractImage`, after the Drive extraction block (line 69) and before the cleanup (line 71):

```javascript
  // Extract Dropbox image URLs
  DROPBOX_URL_PATTERN.lastIndex = 0;
  while ((match = DROPBOX_URL_PATTERN.exec(description)) !== null) {
    const originalUrl = match[0];
    const ext = getPathExtension(originalUrl);
    // Skip known non-image extensions (they'll be picked up by attachment extraction)
    if (ext && NON_IMAGE_EXTENSIONS.has(ext)) continue;
    const normalized = normalizeImageUrl(originalUrl);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      images.push(normalized);
      originalUrls.push(originalUrl);
    }
  }
```

Export `getPathExtension` and `NON_IMAGE_EXTENSIONS` for reuse by `attachments.js`:

```javascript
export { getPathExtension, NON_IMAGE_EXTENSIONS };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/stavxyz/src/og-cal && npm test`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/stavxyz/src/og-cal && git add src/util/images.js test/images.test.js && git commit -m "feat: extract Dropbox image URLs from event descriptions"
```

---

### Task 3: Create attachments.js with extractAttachments

**Files:**
- Modify: `src/util/sanitize.js` (export `stripUrl`)
- Modify: `src/util/images.js` (import `stripUrl` from sanitize, export `DRIVE_ID_PATTERN`)
- Create: `src/util/attachments.js`
- Create: `test/attachments.test.js`

- [ ] **Step 1: Write failing tests for `extractAttachments`**

Create `test/attachments.test.js`:

```javascript
const { describe, it, before } = require('node:test');
const assert = require('node:assert');

let extractAttachments, normalizeAttachmentUrl, deriveTypeFromMimeType;

before(async () => {
  const mod = await import('../src/util/attachments.js');
  extractAttachments = mod.extractAttachments;
  normalizeAttachmentUrl = mod.normalizeAttachmentUrl;
  deriveTypeFromMimeType = mod.deriveTypeFromMimeType;
});

describe('extractAttachments — basic extraction', () => {
  it('extracts a PDF URL from description', () => {
    const desc = 'Download the flyer: https://example.com/flyer.pdf';
    const result = extractAttachments(desc);
    assert.strictEqual(result.attachments.length, 1);
    assert.strictEqual(result.attachments[0].label, 'Download PDF');
    assert.strictEqual(result.attachments[0].url, 'https://example.com/flyer.pdf');
    assert.strictEqual(result.attachments[0].type, 'pdf');
    assert.ok(!result.description.includes('example.com'));
  });

  it('extracts a .docx URL', () => {
    const desc = 'Notes: https://example.com/notes.docx';
    const result = extractAttachments(desc);
    assert.strictEqual(result.attachments.length, 1);
    assert.strictEqual(result.attachments[0].label, 'Download Document');
    assert.strictEqual(result.attachments[0].type, 'docx');
  });

  it('extracts a .xlsx URL', () => {
    const desc = 'Data: https://example.com/data.xlsx';
    const result = extractAttachments(desc);
    assert.strictEqual(result.attachments[0].label, 'Download Spreadsheet');
    assert.strictEqual(result.attachments[0].type, 'xlsx');
  });

  it('extracts a .pptx URL', () => {
    const desc = 'Slides: https://example.com/slides.pptx';
    const result = extractAttachments(desc);
    assert.strictEqual(result.attachments[0].label, 'Download Presentation');
    assert.strictEqual(result.attachments[0].type, 'pptx');
  });

  it('extracts a .zip URL', () => {
    const desc = 'Files: https://example.com/archive.zip';
    const result = extractAttachments(desc);
    assert.strictEqual(result.attachments[0].label, 'Download Archive');
    assert.strictEqual(result.attachments[0].type, 'zip');
  });

  it('extracts a .csv URL', () => {
    const desc = 'Data: https://example.com/export.csv';
    const result = extractAttachments(desc);
    assert.strictEqual(result.attachments[0].label, 'Download Spreadsheet');
    assert.strictEqual(result.attachments[0].type, 'csv');
  });

  it('extracts a .txt URL', () => {
    const desc = 'Read: https://example.com/readme.txt';
    const result = extractAttachments(desc);
    assert.strictEqual(result.attachments[0].label, 'Download File');
    assert.strictEqual(result.attachments[0].type, 'txt');
  });

  it('does not extract image URLs', () => {
    const desc = 'Photo: https://example.com/photo.jpg';
    const result = extractAttachments(desc);
    assert.strictEqual(result.attachments.length, 0);
  });

  it('does not extract URLs without file extensions', () => {
    const desc = 'Visit https://example.com/page for info';
    const result = extractAttachments(desc);
    assert.strictEqual(result.attachments.length, 0);
  });

  it('extracts multiple attachments', () => {
    const desc = 'Docs: https://example.com/a.pdf and https://example.com/b.docx';
    const result = extractAttachments(desc);
    assert.strictEqual(result.attachments.length, 2);
  });

  it('returns empty for null description', () => {
    const result = extractAttachments(null);
    assert.deepStrictEqual(result.attachments, []);
    assert.strictEqual(result.description, null);
  });

  it('returns empty for empty string', () => {
    const result = extractAttachments('');
    assert.deepStrictEqual(result.attachments, []);
  });

  it('strips attachment URL from description', () => {
    const desc = 'Get the report https://example.com/report.pdf here';
    const result = extractAttachments(desc);
    assert.ok(!result.description.includes('report.pdf'));
    assert.ok(result.description.includes('Get the report'));
  });

  it('strips <a>-wrapped attachment URL from description', () => {
    const url = 'https://example.com/doc.pdf';
    const desc = `Download <a href="${url}">${url}</a> now`;
    const result = extractAttachments(desc);
    assert.strictEqual(result.attachments.length, 1);
    assert.ok(!result.description.includes('doc.pdf'));
  });
});

describe('extractAttachments — Dropbox normalization', () => {
  it('normalizes Dropbox PDF URL with dl=0 to raw=1', () => {
    const desc = 'Flyer: https://www.dropbox.com/scl/fi/abc/report.pdf?rlkey=xyz&dl=0';
    const result = extractAttachments(desc);
    assert.strictEqual(result.attachments[0].url, 'https://www.dropbox.com/scl/fi/abc/report.pdf?rlkey=xyz&raw=1');
  });

  it('passes through dl.dropboxusercontent.com unchanged', () => {
    const url = 'https://dl.dropboxusercontent.com/s/abc/doc.pdf';
    const desc = `Download: ${url}`;
    const result = extractAttachments(desc);
    assert.strictEqual(result.attachments[0].url, url);
  });
});

describe('extractAttachments — Drive normalization', () => {
  it('normalizes Drive file URL to download URL', () => {
    const desc = 'Doc: https://drive.google.com/file/d/ABC123/view';
    const result = extractAttachments(desc);
    assert.strictEqual(result.attachments.length, 1);
    assert.strictEqual(result.attachments[0].url, 'https://drive.google.com/uc?export=download&id=ABC123');
    assert.strictEqual(result.attachments[0].type, 'file');
    assert.strictEqual(result.attachments[0].label, 'Download File');
  });
});

describe('normalizeAttachmentUrl', () => {
  it('normalizes Dropbox share URL', () => {
    const url = 'https://www.dropbox.com/s/abc/doc.pdf?dl=0';
    assert.strictEqual(normalizeAttachmentUrl(url), 'https://www.dropbox.com/s/abc/doc.pdf?raw=1');
  });

  it('normalizes Drive URL to download link', () => {
    const url = 'https://drive.google.com/file/d/XYZ/view';
    assert.strictEqual(normalizeAttachmentUrl(url), 'https://drive.google.com/uc?export=download&id=XYZ');
  });

  it('passes through other URLs unchanged', () => {
    const url = 'https://example.com/doc.pdf';
    assert.strictEqual(normalizeAttachmentUrl(url), url);
  });
});

describe('deriveTypeFromMimeType', () => {
  it('returns pdf for application/pdf', () => {
    assert.strictEqual(deriveTypeFromMimeType('application/pdf'), 'pdf');
  });

  it('returns doc for Word mime types', () => {
    assert.strictEqual(deriveTypeFromMimeType('application/vnd.openxmlformats-officedocument.wordprocessingml.document'), 'doc');
  });

  it('returns spreadsheet for Excel mime types', () => {
    assert.strictEqual(deriveTypeFromMimeType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), 'spreadsheet');
  });

  it('returns presentation for PowerPoint mime types', () => {
    assert.strictEqual(deriveTypeFromMimeType('application/vnd.openxmlformats-officedocument.presentationml.presentation'), 'presentation');
  });

  it('returns archive for zip mime type', () => {
    assert.strictEqual(deriveTypeFromMimeType('application/zip'), 'archive');
  });

  it('returns file for unknown mime type', () => {
    assert.strictEqual(deriveTypeFromMimeType('application/octet-stream'), 'file');
  });

  it('returns file for null', () => {
    assert.strictEqual(deriveTypeFromMimeType(null), 'file');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/stavxyz/src/og-cal && npm test`
Expected: All attachments tests FAIL (module not found)

- [ ] **Step 3: Extract shared `stripUrl` to `sanitize.js`**

Before creating attachments.js, move `stripUrl` to `src/util/sanitize.js` so both `images.js` and `attachments.js` can import it (avoiding duplication).

Add to the end of `src/util/sanitize.js`:

```javascript
export function stripUrl(html, url) {
  const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  html = html.replace(new RegExp(`<a[^>]*>${escaped}</a>`, 'gi'), '');
  html = html.replace(new RegExp(escaped, 'g'), '');
  return html;
}
```

Update `src/util/images.js` to import `stripUrl` from sanitize instead of defining it locally:

```javascript
import { cleanupHtml, stripUrl } from './sanitize.js';
```

Remove the local `stripUrl` function definition (lines 31-37) from `images.js`.

Also export `DRIVE_ID_PATTERN` from `images.js` so `attachments.js` can reuse it:

```javascript
export const DRIVE_ID_PATTERN = /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=view&)?id=)([a-zA-Z0-9_-]+)/;
```

- [ ] **Step 4: Run tests to verify refactor didn't break anything**

Run: `cd /Users/stavxyz/src/og-cal && npm test`
Expected: All existing tests PASS

- [ ] **Step 5: Implement `src/util/attachments.js`**

Create `src/util/attachments.js`:

```javascript
import { cleanupHtml, stripUrl } from './sanitize.js';
import { DRIVE_ID_PATTERN, getPathExtension, NON_IMAGE_EXTENSIONS } from './images.js';

const DROPBOX_PATTERN = /(?:www\.)?dropbox\.com\/(?:scl\/fi|s)\//;
const DROPBOX_DIRECT_PATTERN = /dl\.dropboxusercontent\.com/;

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp']);

const URL_PATTERN = /https?:\/\/[^\s<>"]+/gi;

// Map extensions to {label, type} — grouped by category
const EXTENSION_MAP = {
  pdf:  { label: 'Download PDF', type: 'pdf' },
  doc:  { label: 'Download Document', type: 'doc' },
  docx: { label: 'Download Document', type: 'docx' },
  xls:  { label: 'Download Spreadsheet', type: 'xls' },
  xlsx: { label: 'Download Spreadsheet', type: 'xlsx' },
  csv:  { label: 'Download Spreadsheet', type: 'csv' },
  ppt:  { label: 'Download Presentation', type: 'ppt' },
  pptx: { label: 'Download Presentation', type: 'pptx' },
  zip:  { label: 'Download Archive', type: 'zip' },
  txt:  { label: 'Download File', type: 'txt' },
};

/**
 * Normalize a URL for direct download from known cloud hosts.
 * Dropbox: dl=0 → raw=1.  Drive: → /uc?export=download&id=ID.
 * Other hosts: pass through unchanged.
 */
export function normalizeAttachmentUrl(url) {
  if (!url) return url;

  // Drive → download URL
  const driveMatch = url.match(DRIVE_ID_PATTERN);
  if (driveMatch) return `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;

  // dl.dropboxusercontent.com — already direct
  if (DROPBOX_DIRECT_PATTERN.test(url)) return url;

  // Dropbox share URLs — normalize to raw=1
  if (DROPBOX_PATTERN.test(url)) {
    if (url.includes('dl=0')) return url.replace('dl=0', 'raw=1');
    if (url.includes('?')) return url + '&raw=1';
    return url + '?raw=1';
  }

  return url;
}

/**
 * Check if a URL points to a known file attachment (by extension or Drive pattern).
 * Returns {label, type} or null.
 */
function classifyUrl(url) {
  const ext = getPathExtension(url);

  // Has a file extension
  if (ext) {
    // Skip image extensions — those are handled by extractImage
    if (IMAGE_EXTENSIONS.has(ext)) return null;
    // Known file type
    if (EXTENSION_MAP[ext]) return EXTENSION_MAP[ext];
    return null;
  }

  // No extension — check for Drive URL (which could be any file type).
  // Note: in the full pipeline, Drive URLs are typically consumed by extractImage first.
  // This handles the case where extractAttachments is called standalone or on a
  // description where a Drive URL survived image extraction.
  const driveMatch = url.match(DRIVE_ID_PATTERN);
  if (driveMatch) return { label: 'Download File', type: 'file' };

  return null;
}

export function extractAttachments(description, config) {
  if (!description) return { attachments: [], description };

  const attachments = [];
  let cleaned = description;
  const seen = new Set();

  const urls = description.match(URL_PATTERN) || [];
  for (const url of urls) {
    if (seen.has(url)) continue;
    const classification = classifyUrl(url);
    if (!classification) continue;

    seen.add(url);
    const normalizedUrl = normalizeAttachmentUrl(url);
    attachments.push({
      label: classification.label,
      url: normalizedUrl,
      type: classification.type,
    });
    cleaned = stripUrl(cleaned, url);
  }

  cleaned = cleanupHtml(cleaned);
  return { attachments, description: cleaned };
}

/**
 * Derive a type string from a MIME type (for Google Calendar API attachments).
 */
export function deriveTypeFromMimeType(mimeType) {
  if (!mimeType) return 'file';
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'doc';
  if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('csv')) return 'spreadsheet';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
  if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('compressed')) return 'archive';
  return 'file';
}

/**
 * Derive a label from a type string (for Google Calendar API attachments).
 */
export function labelForType(type) {
  const map = {
    pdf: 'Download PDF', doc: 'Download Document', spreadsheet: 'Download Spreadsheet',
    presentation: 'Download Presentation', archive: 'Download Archive',
  };
  return map[type] || 'Download File';
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd /Users/stavxyz/src/og-cal && npm test`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
cd /Users/stavxyz/src/og-cal && git add src/util/sanitize.js src/util/images.js src/util/attachments.js test/attachments.test.js && git commit -m "feat: add host-agnostic attachment extraction for file URLs"
```

---

### Task 4: Refactor data.js — consolidate enrichment paths, add attachment extraction

**Files:**
- Modify: `src/data.js`
- Test: `test/data.test.js` (if it exists, verify existing tests still pass)

- [ ] **Step 1: Read existing data tests**

Run: `cd /Users/stavxyz/src/og-cal && cat test/data.test.js 2>/dev/null || echo "no data tests"`

- [ ] **Step 2: Add attachment extraction to `enrichEvent` in `data.js`**

In `src/data.js`, add the imports at the top:

```javascript
import { extractAttachments, deriveTypeFromMimeType, labelForType } from './util/attachments.js';
```

In `enrichEvent()`, after the links extraction block (after line 83) and before the `detectFormat` line (line 86), add attachment extraction:

```javascript
  // Extract file attachments from description
  let attachments = (event.attachments && event.attachments.length > 0) ? event.attachments : [];
  if (description) {
    const result = extractAttachments(description, config);
    if (result.attachments.length > 0) {
      attachments = [...attachments, ...result.attachments];
      description = result.description;
    }
  }
```

Update the return statement on line 88 to include `attachments`:

```javascript
  return { ...event, description, descriptionFormat, image, images, links, attachments };
```

- [ ] **Step 3: Refactor `transformGoogleEvents` to delegate to `enrichEvent`**

Replace the body of `transformGoogleEvents()` so it builds the base event shape and delegates enrichment to `enrichEvent()`. The function should no longer call `extractImage`, `extractLinks`, or `getImagesFromAttachments` directly.

Updated `transformGoogleEvents` — separates image attachments (which keep `mimeType` for `getImagesFromAttachments`) from file attachments (normalized to `{label, url, type}`):

```javascript
export function transformGoogleEvents(googleData, config) {
  const events = (googleData.items || []).map(item => {
    // Separate image attachments from file attachments.
    // Image attachments keep mimeType so getImagesFromAttachments can process them.
    // File attachments get normalized to {label, url, type} schema.
    const apiAttachments = [];
    const imageAttachments = [];
    for (const a of (item.attachments || [])) {
      if (a.mimeType && a.mimeType.startsWith('image/')) {
        imageAttachments.push({ mimeType: a.mimeType, url: a.fileUrl });
      } else {
        const type = deriveTypeFromMimeType(a.mimeType);
        apiAttachments.push({
          label: a.title || labelForType(type),
          url: a.fileUrl,
          type,
        });
      }
    }

    // Build base event shape — enrichEvent handles description extraction.
    // _imageAttachments is internal, stripped by enrichEvent before returning.
    return {
      id: item.id,
      title: item.summary || 'Untitled Event',
      description: item.description || '',
      location: item.location || '',
      start: item.start?.dateTime || item.start?.date || '',
      end: item.end?.dateTime || item.end?.date || '',
      allDay: !item.start?.dateTime,
      image: null,
      images: [],
      links: [],
      attachments: apiAttachments,
      _imageAttachments: imageAttachments,
    };
  });

  return {
    events,
    calendar: {
      name: googleData.summary || '',
      description: googleData.description || '',
      timezone: googleData.timeZone || 'UTC',
    },
    generated: new Date().toISOString(),
  };
}
```

Note: `deriveTypeFromMimeType` and `labelForType` are imported from `attachments.js` (added in Task 3).

Update `getImagesFromAttachments` — no changes to the function itself (it still filters by `mimeType`), but update its call site in `enrichEvent` to check `_imageAttachments` first:

```javascript
  // Fallback: check attachments for images
  const attachmentImages = getImagesFromAttachments(event._imageAttachments || event.attachments);
```

And strip `_imageAttachments` from the return value (it's internal-only):

```javascript
  const { _imageAttachments, ...rest } = event;
  return { ...rest, description, descriptionFormat, image, images, links, attachments };
```

- [ ] **Step 4: Run all tests to verify nothing is broken**

Run: `cd /Users/stavxyz/src/og-cal && npm test`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/stavxyz/src/og-cal && git add src/data.js && git commit -m "refactor: consolidate enrichment paths, add attachment extraction to pipeline"
```

---

### Task 5: Render attachments in detail view

**Files:**
- Modify: `src/views/detail.js`
- Modify: `og-cal.css`

- [ ] **Step 1: Add attachment rendering in `renderDetailView`**

In `src/views/detail.js`, after the description block (line 113) and before the links block (line 115), add:

```javascript
  if (event.attachments && event.attachments.length > 0) {
    const attachDiv = document.createElement('div');
    attachDiv.className = 'ogcal-detail-attachments';
    for (const att of event.attachments) {
      const a = document.createElement('a');
      a.className = 'ogcal-detail-attachment';
      a.href = att.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = att.label;
      attachDiv.appendChild(a);
    }
    content.appendChild(attachDiv);
  }
```

- [ ] **Step 2: Add CSS for attachments**

In `og-cal.css`, after the `.ogcal-detail-link:focus-visible` rule (around line 857), add:

```css
.ogcal-detail-attachments {
  margin-top: 1.25rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.ogcal-detail-attachment {
  display: inline-block;
  padding: 0.5rem 1rem;
  background: var(--ogcal-surface);
  color: var(--ogcal-text);
  border: 1px solid var(--ogcal-text-secondary);
  border-radius: var(--ogcal-radius);
  text-decoration: none;
  font-size: 0.875rem;
  transition: opacity 0.15s;
}

.ogcal-detail-attachment:hover {
  opacity: 0.85;
}

.ogcal-detail-attachment:focus-visible {
  outline: 2px solid var(--ogcal-text);
  outline-offset: 2px;
}
```

And in the mobile section (around line 1099 where `.ogcal-detail-links` has mobile styles), add:

```css
  .ogcal-detail-attachments {
    flex-direction: column;
  }

  .ogcal-detail-attachment {
    text-align: center;
  }
```

- [ ] **Step 3: Run tests to verify nothing is broken**

Run: `cd /Users/stavxyz/src/og-cal && npm test`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
cd /Users/stavxyz/src/og-cal && git add src/views/detail.js og-cal.css && git commit -m "feat: render attachments in event detail view"
```

---

### Task 6: Fix per-image error handling in gallery

**Files:**
- Modify: `src/views/detail.js`

- [ ] **Step 1: Replace `renderGallery` with per-image error handling**

In `src/views/detail.js`, replace the entire `renderGallery` function (lines 5-56) with this unified replacement:

```javascript
function renderGallery(images, altText) {
  const gallery = document.createElement('div');
  gallery.className = 'ogcal-detail-gallery';

  let loadedImages = [...images];
  let current = 0;
  let counter = null;

  const imgEl = document.createElement('img');
  imgEl.className = 'ogcal-detail-gallery-img';
  imgEl.src = images[0];
  imgEl.alt = altText;
  imgEl.loading = 'lazy';
  imgEl.onerror = () => {
    loadedImages = loadedImages.filter(u => u !== imgEl.src);
    if (loadedImages.length === 0) {
      gallery.closest('.ogcal-detail-image')?.remove();
      return;
    }
    current = 0;
    imgEl.src = loadedImages[0];
    if (counter) counter.textContent = `1 / ${loadedImages.length}`;
  };
  gallery.appendChild(imgEl);

  if (images.length <= 1) return gallery;

  counter = document.createElement('div');
  counter.className = 'ogcal-detail-gallery-counter';
  counter.textContent = `1 / ${images.length}`;
  gallery.appendChild(counter);

  const prevBtn = document.createElement('button');
  prevBtn.className = 'ogcal-detail-gallery-prev';
  prevBtn.innerHTML = '&#8249;';
  prevBtn.setAttribute('aria-label', 'Previous image');
  gallery.appendChild(prevBtn);

  const nextBtn = document.createElement('button');
  nextBtn.className = 'ogcal-detail-gallery-next';
  nextBtn.innerHTML = '&#8250;';
  nextBtn.setAttribute('aria-label', 'Next image');
  gallery.appendChild(nextBtn);

  function goTo(idx) {
    current = (idx + loadedImages.length) % loadedImages.length;
    imgEl.src = loadedImages[current];
    counter.textContent = `${current + 1} / ${loadedImages.length}`;
  }

  prevBtn.addEventListener('click', () => goTo(current - 1));
  nextBtn.addEventListener('click', () => goTo(current + 1));

  gallery.setAttribute('tabindex', '0');
  gallery.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { goTo(current - 1); e.preventDefault(); }
    if (e.key === 'ArrowRight') { goTo(current + 1); e.preventDefault(); }
  });

  return gallery;
}
```

- [ ] **Step 2: Run tests to verify nothing is broken**

Run: `cd /Users/stavxyz/src/og-cal && npm test`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
cd /Users/stavxyz/src/og-cal && git add src/views/detail.js && git commit -m "fix: per-image error handling in gallery — skip broken images instead of removing gallery"
```

---

### Task 7: Build and verify

**Files:**
- Modify: `dist/` (build output)

- [ ] **Step 1: Run the full test suite**

Run: `cd /Users/stavxyz/src/og-cal && npm test`
Expected: All tests PASS

- [ ] **Step 2: Build the dist**

Run: `cd /Users/stavxyz/src/og-cal && npm run build`
Expected: Build succeeds, `dist/og-cal.js`, `dist/og-cal.min.js`, `dist/og-cal.css`, `dist/og-cal.min.css` updated

- [ ] **Step 3: Commit the build**

```bash
cd /Users/stavxyz/src/og-cal && git add dist/ && git commit -m "build: rebuild dist with Dropbox image support and attachment extraction"
```

---

### Task 8: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add Dropbox and attachment docs to README**

Add a section documenting Dropbox image support (alongside the existing Drive docs) and the new attachment extraction feature. Include the supported file types and the attachment schema.

- [ ] **Step 2: Commit**

```bash
cd /Users/stavxyz/src/og-cal && git add README.md && git commit -m "docs: document Dropbox image support and attachment extraction"
```
