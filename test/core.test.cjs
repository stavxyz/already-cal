const { describe, it } = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

// Runs the built bundle, not the source, with no DOM globals, which is how
// server-side consumers such as Cloudflare Workers load it.
describe("dist/already-cal-core.mjs", () => {
  it("exports exactly the core API and enriches an event without a DOM", async () => {
    assert.strictEqual(typeof globalThis.document, "undefined");
    const mod = await import(
      pathToFileURL(path.join(__dirname, "../dist/already-cal-core.mjs")).href
    );
    assert.deepStrictEqual(Object.keys(mod).sort(), [
      "CONTENT_DEFAULTS",
      "enrichGoogleEvent",
      "plainTextDescription",
    ]);
    const e = mod.enrichGoogleEvent(
      {
        id: "e1",
        summary: "X",
        description:
          "**Big** day\nhttps://drive.google.com/file/d/ABC123/view\n#already:tag:food",
        start: { date: "2026-10-01" },
      },
      {},
    );
    assert.strictEqual(e.image, "https://lh3.googleusercontent.com/d/ABC123");
    assert.strictEqual(mod.plainTextDescription(e), "Big day");
  });
});
