const { describe, it } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

// Runs the built bundle, not the source, with no DOM globals, which is how
// server-side consumers such as Cloudflare Workers load it.
describe("dist/already-cal-core.mjs", () => {
  it("has no reference to document/window/DOMParser as a DOM-access call (static check)", () => {
    // Complements the runtime-import test below: that test proves the
    // module doesn't NEED a DOM at import/call time, but a code path that's
    // merely unreached by this one call (e.g. inside an error branch) could
    // still reference `document`/`window`/`DOMParser` without tripping it.
    // This regexes the bundle text directly. `\b(document|window|DOMParser)\s*[.(]`
    // matches an actual property access or call (`document.createElement`,
    // `window(`) but not an unrelated bare use of the word, such as the
    // string "document" inside `mimeType.includes("document")`, which has
    // no `.` or `(` immediately after "document".
    const bundle = fs.readFileSync(
      path.join(__dirname, "../dist/already-cal-core.mjs"),
      "utf8",
    );
    const match = bundle.match(/\b(document|window|DOMParser)\s*[.(]/);
    assert.strictEqual(
      match,
      null,
      `found a DOM-access-shaped reference: ${match?.[0]}`,
    );
  });

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
