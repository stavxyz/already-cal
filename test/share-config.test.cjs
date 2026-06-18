// test/share-config.test.cjs
require("./setup-dom.cjs");
const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let DEFAULTS;
before(async () => {
  ({ DEFAULTS } = await import("../src/already-cal.js"));
});

describe("share config defaults", () => {
  it("exposes shareUrl: null in DEFAULTS", () => {
    assert.ok("shareUrl" in DEFAULTS);
    assert.strictEqual(DEFAULTS.shareUrl, null);
  });
});
