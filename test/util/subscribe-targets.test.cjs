const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let buildSubscribeTargets, googleCalIdToCid;
before(async () => {
  ({ buildSubscribeTargets, googleCalIdToCid } = await import(
    "../../src/util/subscribe-targets.js"
  ));
});

const GFEED =
  "webcal://calendar.google.com/calendar/ical/" +
  "c_abc%40group.calendar.google.com/public/basic.ics";

describe("googleCalIdToCid", () => {
  it("base64-encodes the id and strips padding", () => {
    // btoa("c_abc@group.calendar.google.com") ends in '=' padding
    assert.strictEqual(googleCalIdToCid("a"), "YQ"); // btoa('a') === 'YQ=='
    assert.ok(!googleCalIdToCid("c_abc@group.calendar.google.com").endsWith("="));
  });
});

describe("buildSubscribeTargets", () => {
  it("returns null for empty / non-webcal-or-https input", () => {
    assert.strictEqual(buildSubscribeTargets(""), null);
    assert.strictEqual(buildSubscribeTargets(null), null);
    assert.strictEqual(buildSubscribeTargets("javascript:alert(1)"), null);
    assert.strictEqual(buildSubscribeTargets("ftp://x/y.ics"), null);
    assert.strictEqual(buildSubscribeTargets("not a url"), null);
  });

  it("maps a Google public webcal feed to four targets", () => {
    const t = buildSubscribeTargets(GFEED);
    assert.deepStrictEqual(
      t.map((x) => x.id),
      ["apple", "google", "outlook", "copy"]
    );
    const by = Object.fromEntries(t.map((x) => [x.id, x]));
    // Apple: the webcal:// feed unchanged
    assert.strictEqual(by.apple.url, GFEED);
    assert.strictEqual(by.apple.kind, "link");
    // Google: native cid form (base64 of the DECODED id), path is r?cid= (no /u/0)
    assert.strictEqual(
      by.google.url,
      "https://calendar.google.com/calendar/r?cid=" +
        googleCalIdToCid("c_abc@group.calendar.google.com")
    );
    // Outlook: addfromweb with the encoded webcal feed
    assert.strictEqual(
      by.outlook.url,
      "https://outlook.office.com/calendar/0/addfromweb?url=" +
        encodeURIComponent(GFEED)
    );
    // Copy: the https form of the feed
    assert.strictEqual(by.copy.kind, "copy");
    assert.strictEqual(
      by.copy.url,
      "https://calendar.google.com/calendar/ical/" +
        "c_abc%40group.calendar.google.com/public/basic.ics"
    );
  });

  it("accepts an https feed input and derives the webcal Apple URL", () => {
    const https =
      "https://calendar.google.com/calendar/ical/" +
      "c_abc%40group.calendar.google.com/public/basic.ics";
    const by = Object.fromEntries(
      buildSubscribeTargets(https).map((x) => [x.id, x])
    );
    assert.ok(by.apple.url.startsWith("webcal://"));
    assert.strictEqual(by.copy.url, https);
  });

  it("does not throw on a malformed-percent Google ICS URL and returns 4 targets", () => {
    const malformed =
      "webcal://calendar.google.com/calendar/ical/%E0%A4%A/public/basic.ics";
    let targets;
    assert.doesNotThrow(() => {
      targets = buildSubscribeTargets(malformed);
    });
    assert.strictEqual(targets.length, 4);
    assert.deepStrictEqual(
      targets.map((x) => x.id),
      ["apple", "google", "outlook", "copy"]
    );
    const by = Object.fromEntries(targets.map((x) => [x.id, x]));
    assert.strictEqual(
      by.google.url,
      "https://calendar.google.com/calendar/r?cid=" +
        encodeURIComponent(malformed)
    );
  });

  it("uses the feed-form Google cid for a non-Google feed", () => {
    const feed = "webcal://example.com/cal/feed.ics";
    const by = Object.fromEntries(
      buildSubscribeTargets(feed).map((x) => [x.id, x])
    );
    assert.strictEqual(
      by.google.url,
      "https://calendar.google.com/calendar/r?cid=" +
        encodeURIComponent("webcal://example.com/cal/feed.ics")
    );
    assert.strictEqual(by.apple.url, "webcal://example.com/cal/feed.ics");
    assert.strictEqual(by.copy.url, "https://example.com/cal/feed.ics");
  });
});
