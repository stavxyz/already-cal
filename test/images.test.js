const { describe, it, before, afterEach } = require('node:test');
const assert = require('node:assert');

let normalizeImageUrl;
let extractImage;
let isDropboxUrl;
let detectMimeType;
let fetchImageAsBlob;

before(async () => {
  const mod = await import('../src/util/images.js');
  normalizeImageUrl = mod.normalizeImageUrl;
  extractImage = mod.extractImage;
  isDropboxUrl = mod.isDropboxUrl;
  detectMimeType = mod.detectMimeType;
  fetchImageAsBlob = mod.fetchImageAsBlob;
});

describe('normalizeImageUrl', () => {
  it('converts file/d/ID/view URL', () => {
    const url = 'https://drive.google.com/file/d/1U4O-W2gz2jvfvQX_WEm6_H8hdwPzD2ID/view';
    assert.strictEqual(
      normalizeImageUrl(url),
      'https://lh3.googleusercontent.com/d/1U4O-W2gz2jvfvQX_WEm6_H8hdwPzD2ID'
    );
  });

  it('converts file/d/ID/view?usp=sharing URL', () => {
    const url = 'https://drive.google.com/file/d/1U4O-W2gz2jvfvQX_WEm6_H8hdwPzD2ID/view?usp=sharing';
    assert.strictEqual(
      normalizeImageUrl(url),
      'https://lh3.googleusercontent.com/d/1U4O-W2gz2jvfvQX_WEm6_H8hdwPzD2ID'
    );
  });

  it('converts open?id=ID URL', () => {
    const url = 'https://drive.google.com/open?id=abc123_XYZ-def';
    assert.strictEqual(
      normalizeImageUrl(url),
      'https://lh3.googleusercontent.com/d/abc123_XYZ-def'
    );
  });

  it('converts uc?id=ID URL', () => {
    const url = 'https://drive.google.com/uc?id=abc123';
    assert.strictEqual(
      normalizeImageUrl(url),
      'https://lh3.googleusercontent.com/d/abc123'
    );
  });

  it('converts uc?export=view&id=ID URL', () => {
    const url = 'https://drive.google.com/uc?export=view&id=abc123';
    assert.strictEqual(
      normalizeImageUrl(url),
      'https://lh3.googleusercontent.com/d/abc123'
    );
  });

  it('returns non-Drive URLs unchanged', () => {
    const url = 'https://example.com/photo.jpg';
    assert.strictEqual(normalizeImageUrl(url), url);
  });

  it('returns null for null input', () => {
    assert.strictEqual(normalizeImageUrl(null), null);
  });

  it('returns null for empty string', () => {
    assert.strictEqual(normalizeImageUrl(''), null);
  });

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
});

describe('extractImage — Drive URLs', () => {
  it('extracts a file/d/ Drive URL from description', () => {
    const desc = 'Join us! https://drive.google.com/file/d/ABC123/view';
    const result = extractImage(desc);
    assert.strictEqual(result.image, 'https://lh3.googleusercontent.com/d/ABC123');
    assert.deepStrictEqual(result.images, ['https://lh3.googleusercontent.com/d/ABC123']);
    assert.ok(!result.description.includes('drive.google.com'));
  });

  it('extracts a Drive URL with ?usp=sharing', () => {
    const desc = 'Event https://drive.google.com/file/d/XYZ/view?usp=sharing details';
    const result = extractImage(desc);
    assert.strictEqual(result.image, 'https://lh3.googleusercontent.com/d/XYZ');
    assert.ok(!result.description.includes('drive.google.com'));
    assert.ok(result.description.includes('Event'));
    assert.ok(result.description.includes('details'));
  });

  it('extracts an open?id= Drive URL', () => {
    const desc = 'See https://drive.google.com/open?id=DEF456 for the flyer';
    const result = extractImage(desc);
    assert.strictEqual(result.image, 'https://lh3.googleusercontent.com/d/DEF456');
  });

  it('extracts a uc?id= Drive URL', () => {
    const desc = 'Poster: https://drive.google.com/uc?id=GHI789';
    const result = extractImage(desc);
    assert.strictEqual(result.image, 'https://lh3.googleusercontent.com/d/GHI789');
  });

  it('strips Drive URL wrapped in an <a> tag', () => {
    const url = 'https://drive.google.com/file/d/ABC123/view';
    const desc = `Check <a href="${url}">${url}</a> out`;
    const result = extractImage(desc);
    assert.strictEqual(result.image, 'https://lh3.googleusercontent.com/d/ABC123');
    assert.ok(!result.description.includes('drive.google.com'));
  });

  it('strips all occurrences of a duplicated Drive URL', () => {
    const url = 'https://drive.google.com/file/d/DUP/view';
    const desc = `First: ${url} Second: ${url}`;
    const result = extractImage(desc);
    assert.strictEqual(result.images.length, 1);
    assert.ok(!result.description.includes('drive.google.com'));
  });

  it('extracts both a standard image URL and a Drive URL', () => {
    const desc = 'Photo: https://example.com/img.png and https://drive.google.com/file/d/MIX/view';
    const result = extractImage(desc);
    assert.strictEqual(result.images.length, 2);
    assert.strictEqual(result.images[0], 'https://example.com/img.png');
    assert.strictEqual(result.images[1], 'https://lh3.googleusercontent.com/d/MIX');
    assert.strictEqual(result.image, 'https://example.com/img.png');
  });

  it('deduplicates when same Drive URL appears in different formats', () => {
    // Two different formats pointing to the same file ID
    const desc = 'https://drive.google.com/file/d/SAME/view https://drive.google.com/open?id=SAME';
    const result = extractImage(desc);
    assert.strictEqual(result.images.length, 1);
    assert.strictEqual(result.images[0], 'https://lh3.googleusercontent.com/d/SAME');
  });
});

describe('extractImage — standard image URLs', () => {
  it('extracts a .png URL', () => {
    const desc = 'Event https://example.com/flyer.png info';
    const result = extractImage(desc);
    assert.strictEqual(result.image, 'https://example.com/flyer.png');
    assert.ok(!result.description.includes('flyer.png'));
  });

  it('extracts a .jpg URL with query string', () => {
    const desc = 'See https://cdn.example.com/photo.jpg?w=800 here';
    const result = extractImage(desc);
    assert.strictEqual(result.image, 'https://cdn.example.com/photo.jpg?w=800');
  });

  it('does not extract non-image URLs', () => {
    const desc = 'Visit https://example.com/page for info';
    const result = extractImage(desc);
    assert.strictEqual(result.image, null);
    assert.deepStrictEqual(result.images, []);
  });
});

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

describe('extractImage — HTML entity decoding', () => {
  it('decodes &amp; in Dropbox URLs from HTML descriptions', () => {
    const desc = '<a href="https://www.dropbox.com/scl/fi/abc/photo.jpg?rlkey=xyz&amp;dl=0">https://www.dropbox.com/scl/fi/abc/photo.jpg?rlkey=xyz&amp;dl=0</a>';
    const result = extractImage(desc);
    assert.strictEqual(result.image, 'https://www.dropbox.com/scl/fi/abc/photo.jpg?rlkey=xyz&raw=1');
    assert.ok(!result.image.includes('&amp;'));
  });

  it('decodes &amp; in standard image URLs', () => {
    const desc = 'https://example.com/photo.jpg?w=800&amp;h=600';
    const result = extractImage(desc);
    assert.strictEqual(result.image, 'https://example.com/photo.jpg?w=800&h=600');
  });
});

describe('extractImage — edge cases', () => {
  it('returns empty result for null description', () => {
    const result = extractImage(null);
    assert.strictEqual(result.image, null);
    assert.deepStrictEqual(result.images, []);
    assert.strictEqual(result.description, null);
  });

  it('returns empty result for empty string', () => {
    const result = extractImage('');
    assert.strictEqual(result.image, null);
    assert.deepStrictEqual(result.images, []);
  });

  it('returns empty result for description with no URLs', () => {
    const result = extractImage('Just a plain text description');
    assert.strictEqual(result.image, null);
    assert.deepStrictEqual(result.images, []);
    assert.strictEqual(result.description, 'Just a plain text description');
  });

  it('handles multiple calls without state leaking (lastIndex reset)', () => {
    const desc1 = 'A https://drive.google.com/file/d/FIRST/view';
    const desc2 = 'B https://drive.google.com/file/d/SECOND/view';
    const r1 = extractImage(desc1);
    const r2 = extractImage(desc2);
    assert.strictEqual(r1.image, 'https://lh3.googleusercontent.com/d/FIRST');
    assert.strictEqual(r2.image, 'https://lh3.googleusercontent.com/d/SECOND');
  });
});

describe('isDropboxUrl', () => {
  it('matches Dropbox share URL (scl/fi)', () => {
    assert.strictEqual(isDropboxUrl('https://www.dropbox.com/scl/fi/abc/photo.jpg?rlkey=xyz&raw=1'), true);
  });

  it('matches legacy Dropbox share URL (/s/)', () => {
    assert.strictEqual(isDropboxUrl('https://www.dropbox.com/s/abc/photo.jpg?raw=1'), true);
  });

  it('matches dl.dropboxusercontent.com URL', () => {
    assert.strictEqual(isDropboxUrl('https://dl.dropboxusercontent.com/scl/fi/abc/photo.jpg'), true);
  });

  it('returns false for Google Drive URL', () => {
    assert.strictEqual(isDropboxUrl('https://lh3.googleusercontent.com/d/ABC123'), false);
  });

  it('returns false for regular URL', () => {
    assert.strictEqual(isDropboxUrl('https://example.com/photo.jpg'), false);
  });

  it('returns false for null/undefined', () => {
    assert.strictEqual(isDropboxUrl(null), false);
    assert.strictEqual(isDropboxUrl(undefined), false);
  });

  it('returns false for empty string', () => {
    assert.strictEqual(isDropboxUrl(''), false);
  });
});

// --- Magic-byte MIME detection ---

describe('detectMimeType', () => {
  function bufferFrom(bytes) {
    return new Uint8Array(bytes).buffer;
  }

  it('detects JPEG from magic bytes (FF D8 FF)', () => {
    const buf = bufferFrom([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
    assert.strictEqual(detectMimeType(buf, 'https://example.com/unknown'), 'image/jpeg');
  });

  it('detects PNG from magic bytes (89 50 4E 47)', () => {
    const buf = bufferFrom([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    assert.strictEqual(detectMimeType(buf, 'https://example.com/unknown'), 'image/png');
  });

  it('detects GIF from magic bytes (47 49 46 38)', () => {
    const buf = bufferFrom([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    assert.strictEqual(detectMimeType(buf, 'https://example.com/unknown'), 'image/gif');
  });

  it('detects WebP from magic bytes (RIFF....WEBP)', () => {
    // RIFF at 0-3, file size at 4-7, WEBP at 8-11
    const buf = bufferFrom([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    assert.strictEqual(detectMimeType(buf, 'https://example.com/unknown'), 'image/webp');
  });

  it('falls back to URL extension when magic bytes are unrecognized', () => {
    const buf = bufferFrom([0x00, 0x00, 0x00, 0x00]);
    assert.strictEqual(detectMimeType(buf, 'https://example.com/photo.png'), 'image/png');
    assert.strictEqual(detectMimeType(buf, 'https://example.com/photo.gif'), 'image/gif');
  });

  it('falls back to image/jpeg when both magic bytes and extension are unknown', () => {
    const buf = bufferFrom([0x00, 0x00, 0x00, 0x00]);
    assert.strictEqual(detectMimeType(buf, 'https://www.dropbox.com/scl/fi/abc/somefile?rlkey=xyz'), 'image/jpeg');
  });

  it('handles empty buffer gracefully', () => {
    const buf = bufferFrom([]);
    assert.strictEqual(detectMimeType(buf, 'https://example.com/photo.jpg'), 'image/jpeg');
  });
});

// --- fetchImageAsBlob (with mocked browser globals) ---

describe('fetchImageAsBlob', () => {
  let origFetch, origBlob, origCreateObjectURL;

  before(() => {
    origFetch = globalThis.fetch;
    origBlob = globalThis.Blob;
    origCreateObjectURL = globalThis.URL.createObjectURL;
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    globalThis.Blob = origBlob;
    globalThis.URL.createObjectURL = origCreateObjectURL;
  });

  function mockFetchAndBlob(bytes) {
    const arrayBuffer = new Uint8Array(bytes).buffer;
    globalThis.fetch = async (url) => ({
      ok: true,
      arrayBuffer: async () => arrayBuffer,
    });
    let capturedBlobType;
    globalThis.Blob = class MockBlob {
      constructor(parts, opts) { capturedBlobType = opts?.type; }
    };
    globalThis.URL.createObjectURL = (blob) => 'blob:mock-url';
    return { getCapturedType: () => capturedBlobType };
  }

  it('returns a blob URL on success', async () => {
    mockFetchAndBlob([0xFF, 0xD8, 0xFF, 0xE0]);
    const result = await fetchImageAsBlob('https://www.dropbox.com/scl/fi/abc/photo.jpg?rlkey=xyz&raw=1');
    assert.strictEqual(result, 'blob:mock-url');
  });

  it('detects JPEG MIME from magic bytes', async () => {
    const mock = mockFetchAndBlob([0xFF, 0xD8, 0xFF, 0xE0]);
    await fetchImageAsBlob('https://www.dropbox.com/scl/fi/abc/photo.jpg?raw=1');
    assert.strictEqual(mock.getCapturedType(), 'image/jpeg');
  });

  it('detects PNG MIME from magic bytes', async () => {
    const mock = mockFetchAndBlob([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    await fetchImageAsBlob('https://www.dropbox.com/scl/fi/abc/photo.png?raw=1');
    assert.strictEqual(mock.getCapturedType(), 'image/png');
  });

  it('rejects on HTTP error', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 404 });
    await assert.rejects(
      () => fetchImageAsBlob('https://www.dropbox.com/scl/fi/abc/photo.jpg?raw=1'),
      /Dropbox fetch failed: 404/
    );
  });
});

// --- resolveDropboxImages (with mocked browser globals) ---

describe('resolveDropboxImages', () => {
  let resolveDropboxImages;
  let origFetch, origBlob, origCreateObjectURL;

  before(async () => {
    const dataMod = await import('../src/data.js');
    // resolveDropboxImages is not exported, so we test it indirectly
    // via loadData with pre-loaded data that has Dropbox image URLs.
    // We need access to loadData and transformGoogleEvents.
    resolveDropboxImages = null; // tested indirectly below
    origFetch = globalThis.fetch;
    origBlob = globalThis.Blob;
    origCreateObjectURL = globalThis.URL.createObjectURL;
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    globalThis.Blob = origBlob;
    globalThis.URL.createObjectURL = origCreateObjectURL;
  });

  function setupMocks() {
    let blobCounter = 0;
    globalThis.fetch = async (url) => {
      if (url.includes('fail-this')) {
        return { ok: false, status: 500 };
      }
      return {
        ok: true,
        arrayBuffer: async () => new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]).buffer,
      };
    };
    globalThis.Blob = class MockBlob {
      constructor(parts, opts) { this.type = opts?.type; }
    };
    globalThis.URL.createObjectURL = () => `blob:mock-${++blobCounter}`;
  }

  it('replaces Dropbox image URLs with blob URLs in pre-loaded data', async () => {
    setupMocks();
    const { loadData } = await import('../src/data.js');
    const data = await loadData({
      data: {
        events: [{
          title: 'Test Event',
          description: '',
          image: 'https://www.dropbox.com/scl/fi/abc/photo.jpg?rlkey=xyz&raw=1',
          images: ['https://www.dropbox.com/scl/fi/abc/photo.jpg?rlkey=xyz&raw=1'],
          links: [],
          attachments: [],
        }],
      },
    });
    assert.ok(data.events[0].image.startsWith('blob:'));
    assert.ok(data.events[0].images[0].startsWith('blob:'));
  });

  it('removes failed Dropbox images from the array', async () => {
    setupMocks();
    const { loadData } = await import('../src/data.js');
    const data = await loadData({
      data: {
        events: [{
          title: 'Test Event',
          description: '',
          image: 'https://www.dropbox.com/scl/fi/fail-this/photo.jpg?raw=1',
          images: ['https://www.dropbox.com/scl/fi/fail-this/photo.jpg?raw=1'],
          links: [],
          attachments: [],
        }],
      },
    });
    assert.strictEqual(data.events[0].image, null);
    assert.deepStrictEqual(data.events[0].images, []);
  });

  it('leaves non-Dropbox images untouched', async () => {
    setupMocks();
    const { loadData } = await import('../src/data.js');
    const driveUrl = 'https://lh3.googleusercontent.com/d/ABC123';
    const data = await loadData({
      data: {
        events: [{
          title: 'Test Event',
          description: '',
          image: driveUrl,
          images: [driveUrl],
          links: [],
          attachments: [],
        }],
      },
    });
    assert.strictEqual(data.events[0].image, driveUrl);
    assert.strictEqual(data.events[0].images[0], driveUrl);
  });

  it('handles mixed Dropbox and non-Dropbox images', async () => {
    setupMocks();
    const { loadData } = await import('../src/data.js');
    const driveUrl = 'https://lh3.googleusercontent.com/d/ABC123';
    const dropboxUrl = 'https://www.dropbox.com/scl/fi/abc/photo.jpg?rlkey=xyz&raw=1';
    const data = await loadData({
      data: {
        events: [{
          title: 'Test Event',
          description: '',
          image: driveUrl,
          images: [driveUrl, dropboxUrl],
          links: [],
          attachments: [],
        }],
      },
    });
    assert.strictEqual(data.events[0].images.length, 2);
    assert.strictEqual(data.events[0].images[0], driveUrl);
    assert.ok(data.events[0].images[1].startsWith('blob:'));
    assert.strictEqual(data.events[0].image, driveUrl);
  });

  it('updates event.image when first image was Dropbox', async () => {
    setupMocks();
    const { loadData } = await import('../src/data.js');
    const dropboxUrl = 'https://www.dropbox.com/scl/fi/abc/photo.jpg?rlkey=xyz&raw=1';
    const driveUrl = 'https://lh3.googleusercontent.com/d/ABC123';
    const data = await loadData({
      data: {
        events: [{
          title: 'Test Event',
          description: '',
          image: dropboxUrl,
          images: [dropboxUrl, driveUrl],
          links: [],
          attachments: [],
        }],
      },
    });
    assert.ok(data.events[0].image.startsWith('blob:'));
    assert.strictEqual(data.events[0].images[1], driveUrl);
  });
});
