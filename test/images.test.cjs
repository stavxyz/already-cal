const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let normalizeImageUrl;
let extractImage;

before(async () => {
  const mod = await import("../src/util/images.js");
  normalizeImageUrl = mod.normalizeImageUrl;
  extractImage = mod.extractImage;
});

describe("normalizeImageUrl", () => {
  it("converts file/d/ID/view URL", () => {
    const url =
      "https://drive.google.com/file/d/1U4O-W2gz2jvfvQX_WEm6_H8hdwPzD2ID/view";
    assert.strictEqual(
      normalizeImageUrl(url),
      "https://lh3.googleusercontent.com/d/1U4O-W2gz2jvfvQX_WEm6_H8hdwPzD2ID",
    );
  });

  it("converts file/d/ID/view?usp=sharing URL", () => {
    const url =
      "https://drive.google.com/file/d/1U4O-W2gz2jvfvQX_WEm6_H8hdwPzD2ID/view?usp=sharing";
    assert.strictEqual(
      normalizeImageUrl(url),
      "https://lh3.googleusercontent.com/d/1U4O-W2gz2jvfvQX_WEm6_H8hdwPzD2ID",
    );
  });

  it("converts open?id=ID URL", () => {
    const url = "https://drive.google.com/open?id=abc123_XYZ-def";
    assert.strictEqual(
      normalizeImageUrl(url),
      "https://lh3.googleusercontent.com/d/abc123_XYZ-def",
    );
  });

  it("converts uc?id=ID URL", () => {
    const url = "https://drive.google.com/uc?id=abc123";
    assert.strictEqual(
      normalizeImageUrl(url),
      "https://lh3.googleusercontent.com/d/abc123",
    );
  });

  it("converts uc?export=view&id=ID URL", () => {
    const url = "https://drive.google.com/uc?export=view&id=abc123";
    assert.strictEqual(
      normalizeImageUrl(url),
      "https://lh3.googleusercontent.com/d/abc123",
    );
  });

  it("returns non-Drive URLs unchanged", () => {
    const url = "https://example.com/photo.jpg";
    assert.strictEqual(normalizeImageUrl(url), url);
  });

  it("returns null for null input", () => {
    assert.strictEqual(normalizeImageUrl(null), null);
  });

  it("returns null for empty string", () => {
    assert.strictEqual(normalizeImageUrl(""), null);
  });

  it("normalizes Dropbox scl/fi URL with dl=0 to raw=1", () => {
    const url =
      "https://www.dropbox.com/scl/fi/abc123hash/photo.jpg?rlkey=xyz789&dl=0";
    assert.strictEqual(
      normalizeImageUrl(url),
      "https://www.dropbox.com/scl/fi/abc123hash/photo.jpg?rlkey=xyz789&raw=1",
    );
  });

  it("normalizes Dropbox scl/fi URL without dl param — appends &raw=1", () => {
    const url =
      "https://www.dropbox.com/scl/fi/abc123hash/photo.jpg?rlkey=xyz789";
    assert.strictEqual(
      normalizeImageUrl(url),
      "https://www.dropbox.com/scl/fi/abc123hash/photo.jpg?rlkey=xyz789&raw=1",
    );
  });

  it("normalizes legacy Dropbox /s/ URL with dl=0", () => {
    const url = "https://www.dropbox.com/s/abc123/flyer.png?dl=0";
    assert.strictEqual(
      normalizeImageUrl(url),
      "https://www.dropbox.com/s/abc123/flyer.png?raw=1",
    );
  });

  it("normalizes legacy Dropbox /s/ URL without query string — appends ?raw=1", () => {
    const url = "https://www.dropbox.com/s/abc123/flyer.png";
    assert.strictEqual(
      normalizeImageUrl(url),
      "https://www.dropbox.com/s/abc123/flyer.png?raw=1",
    );
  });

  it("passes through dl.dropboxusercontent.com URLs unchanged", () => {
    const url = "https://dl.dropboxusercontent.com/s/abc123/photo.jpg";
    assert.strictEqual(normalizeImageUrl(url), url);
  });
});

describe("extractImage — Drive URLs", () => {
  it("extracts a file/d/ Drive URL from description", () => {
    const desc = "Join us! https://drive.google.com/file/d/ABC123/view";
    const result = extractImage(desc);
    assert.strictEqual(
      result.image,
      "https://lh3.googleusercontent.com/d/ABC123",
    );
    assert.deepStrictEqual(result.images, [
      "https://lh3.googleusercontent.com/d/ABC123",
    ]);
    assert.ok(!result.description.includes("drive.google.com"));
  });

  it("extracts a Drive URL with ?usp=sharing", () => {
    const desc =
      "Event https://drive.google.com/file/d/XYZ/view?usp=sharing details";
    const result = extractImage(desc);
    assert.strictEqual(result.image, "https://lh3.googleusercontent.com/d/XYZ");
    assert.ok(!result.description.includes("drive.google.com"));
    assert.ok(result.description.includes("Event"));
    assert.ok(result.description.includes("details"));
  });

  it("extracts an open?id= Drive URL", () => {
    const desc = "See https://drive.google.com/open?id=DEF456 for the flyer";
    const result = extractImage(desc);
    assert.strictEqual(
      result.image,
      "https://lh3.googleusercontent.com/d/DEF456",
    );
  });

  it("extracts a uc?id= Drive URL", () => {
    const desc = "Poster: https://drive.google.com/uc?id=GHI789";
    const result = extractImage(desc);
    assert.strictEqual(
      result.image,
      "https://lh3.googleusercontent.com/d/GHI789",
    );
  });

  it("strips Drive URL wrapped in an <a> tag", () => {
    const url = "https://drive.google.com/file/d/ABC123/view";
    const desc = `Check <a href="${url}">${url}</a> out`;
    const result = extractImage(desc);
    assert.strictEqual(
      result.image,
      "https://lh3.googleusercontent.com/d/ABC123",
    );
    assert.ok(!result.description.includes("drive.google.com"));
  });

  it("strips all occurrences of a duplicated Drive URL", () => {
    const url = "https://drive.google.com/file/d/DUP/view";
    const desc = `First: ${url} Second: ${url}`;
    const result = extractImage(desc);
    assert.strictEqual(result.images.length, 1);
    assert.ok(!result.description.includes("drive.google.com"));
  });

  it("extracts both a standard image URL and a Drive URL", () => {
    const desc =
      "Photo: https://example.com/img.png and https://drive.google.com/file/d/MIX/view";
    const result = extractImage(desc);
    assert.strictEqual(result.images.length, 2);
    assert.strictEqual(result.images[0], "https://example.com/img.png");
    assert.strictEqual(
      result.images[1],
      "https://lh3.googleusercontent.com/d/MIX",
    );
    assert.strictEqual(result.image, "https://example.com/img.png");
  });

  it("deduplicates when same Drive URL appears in different formats", () => {
    // Two different formats pointing to the same file ID
    const desc =
      "https://drive.google.com/file/d/SAME/view https://drive.google.com/open?id=SAME";
    const result = extractImage(desc);
    assert.strictEqual(result.images.length, 1);
    assert.strictEqual(
      result.images[0],
      "https://lh3.googleusercontent.com/d/SAME",
    );
  });
});

describe("extractImage — standard image URLs", () => {
  it("extracts a .png URL", () => {
    const desc = "Event https://example.com/flyer.png info";
    const result = extractImage(desc);
    assert.strictEqual(result.image, "https://example.com/flyer.png");
    assert.ok(!result.description.includes("flyer.png"));
  });

  it("extracts a .jpg URL with query string", () => {
    const desc = "See https://cdn.example.com/photo.jpg?w=800 here";
    const result = extractImage(desc);
    assert.strictEqual(result.image, "https://cdn.example.com/photo.jpg?w=800");
  });

  it("does not extract non-image URLs", () => {
    const desc = "Visit https://example.com/page for info";
    const result = extractImage(desc);
    assert.strictEqual(result.image, null);
    assert.deepStrictEqual(result.images, []);
  });
});

describe("extractImage — Dropbox URLs", () => {
  it("extracts a Dropbox scl/fi image URL with rlkey", () => {
    const url =
      "https://www.dropbox.com/scl/fi/abc123/poster.jpg?rlkey=xyz&dl=0";
    const desc = `Check out the flyer: ${url}`;
    const result = extractImage(desc);
    assert.strictEqual(
      result.image,
      "https://www.dropbox.com/scl/fi/abc123/poster.jpg?rlkey=xyz&raw=1",
    );
    assert.strictEqual(result.images.length, 1);
    assert.ok(!result.description.includes("dropbox.com"));
  });

  it("extracts a legacy Dropbox /s/ image URL", () => {
    const desc = "Poster: https://www.dropbox.com/s/abc123/flyer.png?dl=0";
    const result = extractImage(desc);
    assert.strictEqual(
      result.image,
      "https://www.dropbox.com/s/abc123/flyer.png?raw=1",
    );
    assert.ok(!result.description.includes("dropbox.com"));
  });

  it("extracts dl.dropboxusercontent.com URL unchanged", () => {
    const url = "https://dl.dropboxusercontent.com/s/abc123/photo.jpg";
    const desc = `Image: ${url}`;
    const result = extractImage(desc);
    assert.strictEqual(result.image, url);
    assert.ok(!result.description.includes("dropboxusercontent.com"));
  });

  it("skips Dropbox URL with non-image extension (.pdf) but strips it from description", () => {
    const desc =
      "Download: https://www.dropbox.com/scl/fi/abc123/report.pdf?rlkey=xyz&dl=0";
    const result = extractImage(desc);
    assert.strictEqual(result.image, null);
    assert.deepStrictEqual(result.images, []);
    assert.ok(!result.description.includes("dropbox.com"));
  });

  it("skips Dropbox URL with .docx extension but strips it from description", () => {
    const desc =
      "Doc: https://www.dropbox.com/scl/fi/abc123/notes.docx?rlkey=xyz&dl=0";
    const result = extractImage(desc);
    assert.strictEqual(result.image, null);
    assert.deepStrictEqual(result.images, []);
    assert.ok(!result.description.includes("dropbox.com"));
  });

  it("extracts image and strips non-image from mixed Dropbox URLs", () => {
    const desc =
      "https://www.dropbox.com/scl/fi/img1/photo.jpg?rlkey=r1&dl=0 and https://www.dropbox.com/scl/fi/doc1/report.pdf?rlkey=r2&dl=0";
    const result = extractImage(desc);
    assert.strictEqual(result.images.length, 1);
    assert.ok(result.images[0].includes("photo.jpg"));
    assert.ok(!result.description.includes("dropbox.com"));
  });

  it("extracts extensionless Dropbox URL optimistically", () => {
    const desc =
      "Photo: https://www.dropbox.com/scl/fi/abc123hash/somefile?rlkey=xyz&dl=0";
    const result = extractImage(desc);
    assert.strictEqual(result.images.length, 1);
    assert.ok(!result.description.includes("dropbox.com"));
  });

  it("extracts multiple Dropbox image URLs", () => {
    const desc =
      "https://www.dropbox.com/scl/fi/a/one.jpg?rlkey=r1&dl=0 and https://www.dropbox.com/scl/fi/b/two.png?rlkey=r2&dl=0";
    const result = extractImage(desc);
    assert.strictEqual(result.images.length, 2);
  });

  it("strips Dropbox URL wrapped in <a> tag", () => {
    const url = "https://www.dropbox.com/scl/fi/abc/pic.jpg?rlkey=xyz&dl=0";
    const desc = `See <a href="${url}">${url}</a> here`;
    const result = extractImage(desc);
    assert.strictEqual(result.images.length, 1);
    assert.ok(!result.description.includes("dropbox.com"));
  });

  it("deduplicates same Dropbox URL appearing twice", () => {
    const url = "https://www.dropbox.com/scl/fi/abc/pic.jpg?rlkey=xyz&dl=0";
    const desc = `First: ${url} Second: ${url}`;
    const result = extractImage(desc);
    assert.strictEqual(result.images.length, 1);
    assert.ok(!result.description.includes("dropbox.com"));
  });
});

describe("extractImage — HTML entity decoding", () => {
  it("decodes &amp; in Dropbox URLs from HTML descriptions", () => {
    const desc =
      '<a href="https://www.dropbox.com/scl/fi/abc/photo.jpg?rlkey=xyz&amp;dl=0">https://www.dropbox.com/scl/fi/abc/photo.jpg?rlkey=xyz&amp;dl=0</a>';
    const result = extractImage(desc);
    assert.strictEqual(
      result.image,
      "https://www.dropbox.com/scl/fi/abc/photo.jpg?rlkey=xyz&raw=1",
    );
    assert.ok(!result.image.includes("&amp;"));
  });

  it("decodes &amp; in standard image URLs", () => {
    const desc = "https://example.com/photo.jpg?w=800&amp;h=600";
    const result = extractImage(desc);
    assert.strictEqual(
      result.image,
      "https://example.com/photo.jpg?w=800&h=600",
    );
  });
});

describe("extractImage — edge cases", () => {
  it("returns empty result for null description", () => {
    const result = extractImage(null);
    assert.strictEqual(result.image, null);
    assert.deepStrictEqual(result.images, []);
    assert.strictEqual(result.description, null);
  });

  it("returns empty result for empty string", () => {
    const result = extractImage("");
    assert.strictEqual(result.image, null);
    assert.deepStrictEqual(result.images, []);
  });

  it("returns empty result for description with no URLs", () => {
    const result = extractImage("Just a plain text description");
    assert.strictEqual(result.image, null);
    assert.deepStrictEqual(result.images, []);
    assert.strictEqual(result.description, "Just a plain text description");
  });

  it("handles multiple calls without state leaking (lastIndex reset)", () => {
    const desc1 = "A https://drive.google.com/file/d/FIRST/view";
    const desc2 = "B https://drive.google.com/file/d/SECOND/view";
    const r1 = extractImage(desc1);
    const r2 = extractImage(desc2);
    assert.strictEqual(r1.image, "https://lh3.googleusercontent.com/d/FIRST");
    assert.strictEqual(r2.image, "https://lh3.googleusercontent.com/d/SECOND");
  });
});
