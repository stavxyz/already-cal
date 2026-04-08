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
