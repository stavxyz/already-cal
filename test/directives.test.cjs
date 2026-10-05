const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let extractDirectives;
let extractImageTokens;

before(async () => {
  const mod = await import("../src/util/directives.js");
  extractDirectives = mod.extractDirectives;
  const imgMod = await import("../src/util/images.js");
  extractImageTokens = imgMod.extractImageTokens;
});

describe("extractDirectives — platform link directives", () => {
  it("parses #already:instagram:handle into a link token with URL", () => {
    const result = extractDirectives("#already:instagram:savebigbend");
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].type, "link");
    assert.strictEqual(result.tokens[0].canonicalId, "instagram:savebigbend");
    assert.strictEqual(
      result.tokens[0].label,
      "Follow @savebigbend on Instagram",
    );
    assert.strictEqual(
      result.tokens[0].url,
      "https://instagram.com/savebigbend",
    );
    assert.strictEqual(result.tokens[0].source, "directive");
    assert.strictEqual(result.description.trim(), "");
  });

  it("is case-insensitive for the prefix (#ALREADY)", () => {
    const result = extractDirectives("#ALREADY:instagram:foo");
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].canonicalId, "instagram:foo");
  });

  it("parses #already:zoom:meetingid", () => {
    const result = extractDirectives("#already:zoom:123456789");
    assert.strictEqual(result.tokens[0].type, "link");
    assert.strictEqual(result.tokens[0].canonicalId, "zoom:123456789");
    assert.strictEqual(result.tokens[0].label, "Join Zoom");
    assert.strictEqual(result.tokens[0].url, "https://zoom.us/j/123456789");
  });

  it("parses #already:discord:invitecode", () => {
    const result = extractDirectives("#already:discord:AbCdEf");
    assert.strictEqual(result.tokens[0].canonicalId, "discord:AbCdEf");
    assert.strictEqual(result.tokens[0].label, "Join Discord");
    assert.strictEqual(result.tokens[0].url, "https://discord.gg/AbCdEf");
  });

  it("parses #already:eventbrite:12345", () => {
    const result = extractDirectives("#already:eventbrite:12345");
    assert.strictEqual(result.tokens[0].canonicalId, "eventbrite:12345");
    assert.strictEqual(result.tokens[0].label, "RSVP on Eventbrite");
    assert.strictEqual(result.tokens[0].url, "https://eventbrite.com/e/12345");
  });
});

describe("extractDirectives — image directives", () => {
  it("parses #already:image:url with normalized canonical ID", () => {
    const result = extractDirectives(
      "#already:image:https://example.com/flyer.png",
    );
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].type, "image");
    assert.strictEqual(result.tokens[0].url, "https://example.com/flyer.png");
    assert.strictEqual(result.tokens[0].source, "directive");
    assert.strictEqual(
      result.tokens[0].canonicalId,
      "image:example.com/flyer.png",
    );
  });

  it("produces canonical IDs that match URL-extracted images", () => {
    const directive = extractDirectives(
      "#already:image:https://example.com/photo.jpg",
    );
    const extracted = extractImageTokens(
      "Check out https://example.com/photo.jpg",
      { imageExtensions: ["jpg"] },
    );
    assert.strictEqual(
      directive.tokens[0].canonicalId,
      extracted.tokens[0].canonicalId,
    );
  });

  it("parses #already:image:drive:ABC123 into a direct lh3 URL", () => {
    const result = extractDirectives("#already:image:drive:ABC123");
    assert.strictEqual(result.tokens[0].type, "image");
    assert.strictEqual(result.tokens[0].canonicalId, "image:drive:ABC123");
    assert.strictEqual(
      result.tokens[0].url,
      "https://lh3.googleusercontent.com/d/ABC123",
    );
  });

  it("deduplicates full Drive URL directive with URL-extracted Drive image", () => {
    const directive = extractDirectives(
      "#already:image:https://drive.google.com/file/d/XYZ789/view",
    );
    const extracted = extractImageTokens(
      "See https://drive.google.com/file/d/XYZ789/view",
      { imageExtensions: ["png"] },
    );
    assert.strictEqual(directive.tokens[0].canonicalId, "image:drive:XYZ789");
    assert.strictEqual(
      directive.tokens[0].canonicalId,
      extracted.tokens[0].canonicalId,
    );
  });

  it("normalizes Dropbox directive images to match URL-extracted canonical IDs", () => {
    const result = extractDirectives(
      "#already:image:https://www.dropbox.com/scl/fi/abc123/photo.png?dl=0",
    );
    assert.strictEqual(
      result.tokens[0].canonicalId,
      "image:dropbox:abc123/photo.png",
    );
  });

  it("uses raw value as canonical ID for non-URL image directives", () => {
    const result = extractDirectives("#already:image:flyer.png");
    assert.strictEqual(result.tokens[0].canonicalId, "image:flyer.png");
    assert.strictEqual(result.tokens[0].url, "flyer.png");
  });
});

describe("extractDirectives — scalar tag directives", () => {
  it("parses #already:tag:fundraiser as scalar tag", () => {
    const result = extractDirectives("#already:tag:fundraiser");
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].type, "tag");
    assert.strictEqual(result.tokens[0].canonicalId, "tag:fundraiser");
    assert.strictEqual(result.tokens[0].metadata.key, "tag");
    assert.strictEqual(result.tokens[0].metadata.value, "fundraiser");
  });

  it("parses #already:tag:outdoor", () => {
    const result = extractDirectives("#already:tag:outdoor");
    assert.strictEqual(result.tokens[0].canonicalId, "tag:outdoor");
    assert.strictEqual(result.tokens[0].metadata.value, "outdoor");
  });
});

describe("extractDirectives — key-value tag directives", () => {
  it("parses #already:cost:$25 as key-value tag", () => {
    const result = extractDirectives("#already:cost:$25");
    assert.strictEqual(result.tokens[0].type, "tag");
    assert.strictEqual(result.tokens[0].canonicalId, "tag:cost:$25");
    assert.strictEqual(result.tokens[0].metadata.key, "cost");
    assert.strictEqual(result.tokens[0].metadata.value, "$25");
  });

  it("parses #already:rsvp:https://form.com as key-value tag with URL value", () => {
    const result = extractDirectives("#already:rsvp:https://form.com");
    assert.strictEqual(
      result.tokens[0].canonicalId,
      "tag:rsvp:https://form.com",
    );
    assert.strictEqual(result.tokens[0].metadata.key, "rsvp");
    assert.strictEqual(result.tokens[0].metadata.value, "https://form.com");
  });

  it("parses #already:capacity:50", () => {
    const result = extractDirectives("#already:capacity:50");
    assert.strictEqual(result.tokens[0].metadata.key, "capacity");
    assert.strictEqual(result.tokens[0].metadata.value, "50");
  });
});

describe("extractDirectives — description stripping", () => {
  it("strips directive from description", () => {
    const result = extractDirectives(
      "Join us! #already:tag:fundraiser See you there",
    );
    assert.ok(!result.description.includes("#already"));
    assert.ok(result.description.includes("Join us!"));
    assert.ok(result.description.includes("See you there"));
  });

  it("strips multiple directives", () => {
    const result = extractDirectives(
      "#already:tag:outdoor #already:cost:$25 Event info",
    );
    assert.strictEqual(result.tokens.length, 2);
    assert.ok(!result.description.includes("#already"));
    assert.ok(result.description.includes("Event info"));
  });

  it("strips directive wrapped in HTML <a> tag", () => {
    const result = extractDirectives(
      'Info <a href="#">#already:tag:fundraiser</a> here',
    );
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].metadata.value, "fundraiser");
    assert.ok(!result.description.includes("#already"));
    assert.ok(!result.description.includes("</a>"), "no orphaned closing tag");
  });

  it("deduplicates identical directives", () => {
    const result = extractDirectives(
      "#already:tag:outdoor #already:tag:outdoor",
    );
    assert.strictEqual(result.tokens.length, 1);
    assert.ok(!result.description.includes("#already"));
  });

  it("deduplicates identical directives across occurrences", () => {
    const result = extractDirectives(
      "#already:tag:outdoor #already:tag:outdoor",
    );
    assert.strictEqual(result.tokens.length, 1);
    assert.ok(!result.description.includes("#already"));
  });
});

describe("extractDirectives — platform aliases", () => {
  it("maps twitter to x canonical prefix", () => {
    const result = extractDirectives("#already:twitter:handle");
    assert.strictEqual(result.tokens[0].canonicalId, "x:handle");
  });

  it("maps meet to googlemeet canonical prefix", () => {
    const result = extractDirectives("#already:meet:abc-defg-hij");
    assert.strictEqual(result.tokens[0].canonicalId, "googlemeet:abc-defg-hij");
  });

  it("maps forms to googleforms canonical prefix", () => {
    const result = extractDirectives("#already:forms:abc123");
    assert.strictEqual(result.tokens[0].canonicalId, "googleforms:abc123");
  });

  it("maps maps to googlemaps canonical prefix", () => {
    const result = extractDirectives("#already:maps:abc123");
    assert.strictEqual(result.tokens[0].canonicalId, "googlemaps:abc123");
  });
});

describe("extractDirectives — edge cases", () => {
  it("returns empty tokens for null description", () => {
    const result = extractDirectives(null);
    assert.deepStrictEqual(result.tokens, []);
    assert.strictEqual(result.description, null);
  });

  it("returns empty tokens for description with no directives", () => {
    const result = extractDirectives("Just a plain description");
    assert.deepStrictEqual(result.tokens, []);
    assert.strictEqual(result.description, "Just a plain description");
  });

  it("ignores malformed directive without value", () => {
    const result = extractDirectives("#already:tag");
    assert.deepStrictEqual(result.tokens, []);
  });

  it("strips malformed directive from description even when unparseable", () => {
    const result = extractDirectives("Event info #already:tag more text");
    assert.deepStrictEqual(result.tokens, []);
    assert.ok(!result.description.includes("#already"));
    assert.ok(result.description.includes("Event info"));
    assert.ok(result.description.includes("more text"));
  });

  it("decodes &amp; entities before parsing directives", () => {
    const result = extractDirectives("Info #already:tag:free&amp;open");
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].metadata.value, "free&open");
  });

  it("does not consume HTML closing tags in directive match", () => {
    const result = extractDirectives('<a href="#">#already:tag:outdoor</a>');
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].metadata.value, "outdoor");
    assert.ok(!result.description.includes("#already"));
    assert.ok(!result.description.includes("</a>"));
  });

  // Stripping must not compile a RegExp from the matched directive text,
  // which throws "Regular expression too large" for a long enough directive.
  it("strips a 64,000-character directive without throwing", () => {
    const directive = `#already:tag:${"x".repeat(64000)}`;
    const result = extractDirectives(`before ${directive} after`);
    assert.strictEqual(result.description, "before  after");
    assert.strictEqual(result.tokens.length, 1);
  });

  // Each directive must be removed at its matched position, not by string
  // everywhere it occurs; removing "#already:tag" by string would also cut
  // the front off "#already:tag:food" and leave ":food" behind.
  it("strips a directive that is a prefix of a later directive cleanly", () => {
    const result = extractDirectives("a #already:tag b #already:tag:food c");
    assert.strictEqual(result.description, "a  b  c");
    assert.strictEqual(result.tokens.length, 1);
  });

  it("strips an anchor-wrapped directive when the tag name is uppercase", () => {
    const result = extractDirectives(
      'x <A HREF="#">#already:tag:outdoor</A> y',
    );
    assert.strictEqual(result.description, "x  y");
  });
});

describe("extractDirectives: auto-linked values", () => {
  const link = (href, text = href) => `<a href="${href}">${text}</a>`;
  const shape = (t) => ({
    type: t.type,
    url: t.url,
    label: t.label,
    canonicalId: t.canonicalId,
  });

  it("reads an auto-linked image URL from the href", () => {
    const href = "https://lh3.googleusercontent.com/pw/abc=w1600";
    const result = extractDirectives(`#already:image:${link(href)}`);
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].type, "image");
    assert.strictEqual(result.tokens[0].url, href);
    assert.ok(!result.description.includes("#already"));
    assert.ok(!result.description.includes("<a"));
  });

  it("reads a linked preorder like the plain form", () => {
    const url = "https://example.com/burgers";
    const linked = extractDirectives(`#already:preorder:${link(url)}`);
    const plain = extractDirectives(`#already:preorder:${url}`);
    assert.strictEqual(linked.tokens.length, 1);
    assert.deepStrictEqual(shape(linked.tokens[0]), shape(plain.tokens[0]));
  });

  it("reads a linked platform directive like the plain form", () => {
    const url = "https://www.eventbrite.com/e/123";
    const linked = extractDirectives(`#already:eventbrite:${link(url)}`);
    const plain = extractDirectives(`#already:eventbrite:${url}`);
    assert.strictEqual(linked.tokens.length, 1);
    assert.deepStrictEqual(shape(linked.tokens[0]), shape(plain.tokens[0]));
  });

  it("uses the href when the link text differs", () => {
    const result = extractDirectives(
      `#already:image:${link("https://cdn.example/a.jpg", "photo")}`,
    );
    assert.strictEqual(result.tokens[0].url, "https://cdn.example/a.jpg");
    assert.ok(!result.description.includes("photo"));
  });

  it("decodes &amp; inside the href", () => {
    const result = extractDirectives(
      `#already:image:${link("https://cdn.example/a.jpg?a=1&amp;b=2")}`,
    );
    assert.strictEqual(
      result.tokens[0].url,
      "https://cdn.example/a.jpg?a=1&b=2",
    );
  });

  it("handles the shuffle flag with <br>-separated linked images", () => {
    const a = "https://cdn.example/a.jpg";
    const b = "https://cdn.example/b.jpg";
    const result = extractDirectives(
      `#already:image-shuffle<br>#already:image:${link(a)}<br>#already:image:${link(b)}`,
    );
    assert.strictEqual(result.imageShuffle, true);
    assert.deepStrictEqual(
      result.tokens.map((t) => t.url),
      [a, b],
    );
  });

  it("leaves anchors elsewhere in the description alone", () => {
    const result = extractDirectives(
      `<a href="https://x.example/">site</a> #already:image:${link("https://cdn.example/a.jpg")}`,
    );
    assert.ok(result.description.includes('<a href="https://x.example/">'));
  });

  const URL_VALUE = "https://cdn.example/a.jpg";
  const anchorVariants = [
    ["single-quoted href", `<a href='${URL_VALUE}'>${URL_VALUE}</a>`],
    ["uppercase tag and attribute", `<A HREF="${URL_VALUE}">${URL_VALUE}</A>`],
    [
      "attributes before href",
      `<a target="_blank" rel="noopener" href="${URL_VALUE}">${URL_VALUE}</a>`,
    ],
    [
      "attributes after href",
      `<a href="${URL_VALUE}" target="_blank">${URL_VALUE}</a>`,
    ],
    [
      "data-href before the real href",
      `<a data-href="https://wrong.example/" href="${URL_VALUE}">${URL_VALUE}</a>`,
    ],
    ["whitespace around =", `<a href = "${URL_VALUE}">${URL_VALUE}</a>`],
    ["entities in the link text", `<a href="${URL_VALUE}">a &amp; b</a>`],
  ];

  for (const [name, anchor] of anchorVariants) {
    it(`unwraps an anchor with ${name}`, () => {
      const result = extractDirectives(`#already:image:${anchor}`);
      assert.strictEqual(result.tokens[0].type, "image");
      assert.strictEqual(result.tokens[0].url, URL_VALUE);
      assert.ok(!result.description.includes("<a"));
      assert.ok(!result.description.includes("</a>"));
      assert.ok(!result.description.includes("#already"));
    });
  }

  it("leaves an anchor with no href as written", () => {
    const result = extractDirectives('#already:image:<a name="n">x</a>');
    assert.ok(result.description.includes('<a name="n">x</a>'));
  });

  it("leaves an anchor with nested markup in the link text as written", () => {
    const result = extractDirectives(
      `#already:image:<a href="${URL_VALUE}"><b>x</b></a>`,
    );
    assert.ok(result.description.includes(`<a href="${URL_VALUE}">`));
  });
});
