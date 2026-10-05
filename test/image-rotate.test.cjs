const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let extractDirectives, enrichEvent;

before(async () => {
  const dirMod = await import("../src/util/directives.js");
  extractDirectives = dirMod.extractDirectives;
  const dataMod = await import("../src/data.js");
  enrichEvent = dataMod.enrichEvent;
});

// --- extractDirectives flag tests ---

describe("extractDirectives — image-rotate flag", () => {
  it("extracts imageRotate from #already:image-rotate", () => {
    const result = extractDirectives("Event info #already:image-rotate");
    assert.strictEqual(result.imageRotate, true);
    assert.ok(!result.description.includes("#already"));
    assert.ok(result.description.includes("Event info"));
  });

  it("is case-insensitive for the keyword", () => {
    const result = extractDirectives("#already:IMAGE-ROTATE");
    assert.strictEqual(result.imageRotate, true);
  });

  it("coexists with image directives without consuming them", () => {
    const result = extractDirectives(
      "#already:image-rotate #already:image:https://example.com/a.png",
    );
    assert.strictEqual(result.imageRotate, true);
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].type, "image");
  });

  it("returns false for plain description", () => {
    const result = extractDirectives("Just text");
    assert.strictEqual(result.imageRotate, false);
  });

  it("returns false for null description", () => {
    const result = extractDirectives(null);
    assert.strictEqual(result.imageRotate, false);
  });
});

// --- enrichEvent propagation + rotation tests ---

describe("enrichEvent — image-rotate propagation", () => {
  const baseEvent = {
    id: "1",
    title: "Test",
    start: "2026-04-15T10:00:00Z",
    end: "2026-04-15T11:00:00Z",
  };

  const threeImageDescription =
    "#already:image-rotate " +
    "#already:image:https://example.com/a.png " +
    "#already:image:https://example.com/b.png " +
    "#already:image:https://example.com/c.png";

  it("sets event.imageRotate from #already:image-rotate directive", () => {
    const event = enrichEvent(
      { ...baseEvent, description: "#already:image-rotate" },
      {},
    );
    assert.strictEqual(event.imageRotate, true);
  });

  it("defaults imageRotate to false when absent", () => {
    const event = enrichEvent({ ...baseEvent, description: "Plain text" }, {});
    assert.strictEqual(event.imageRotate, false);
  });

  it("two occurrences with the same id get the same image", () => {
    const a = enrichEvent(
      { ...baseEvent, id: "occurrence-A", description: threeImageDescription },
      {},
    );
    const b = enrichEvent(
      { ...baseEvent, id: "occurrence-A", description: threeImageDescription },
      {},
    );
    assert.strictEqual(a.image, b.image);
  });

  it("six occurrences with different ids pick at least two distinct images", () => {
    const images = ["a", "b", "c", "d", "e", "f"].map(
      (id) =>
        enrichEvent(
          { ...baseEvent, id, description: threeImageDescription },
          {},
        ).image,
    );
    const distinct = new Set(images);
    assert.ok(
      distinct.size >= 2,
      `expected at least 2 distinct images, got ${[...distinct]}`,
    );
  });

  it("the chosen image is images[0], and the other two follow in order", () => {
    const event = enrichEvent(
      { ...baseEvent, id: "occurrence-B", description: threeImageDescription },
      {},
    );
    assert.strictEqual(event.image, event.images[0]);
    assert.strictEqual(event.images.length, 3);
    const all = [
      "https://example.com/a.png",
      "https://example.com/b.png",
      "https://example.com/c.png",
    ];
    assert.deepStrictEqual(new Set(event.images), new Set(all));
  });

  it("with one image, rotation has nothing to do and the result is that image", () => {
    const event = enrichEvent(
      {
        ...baseEvent,
        id: "occurrence-C",
        description:
          "#already:image-rotate #already:image:https://example.com/only.png",
      },
      {},
    );
    assert.strictEqual(event.image, "https://example.com/only.png");
    assert.deepStrictEqual(event.images, ["https://example.com/only.png"]);
  });

  it("without the flag, the first directive's image stays first", () => {
    const description =
      "#already:image:https://example.com/a.png " +
      "#already:image:https://example.com/b.png " +
      "#already:image:https://example.com/c.png";
    const event = enrichEvent(
      { ...baseEvent, id: "occurrence-D", description },
      {},
    );
    assert.strictEqual(event.image, "https://example.com/a.png");
    assert.deepStrictEqual(event.images, [
      "https://example.com/a.png",
      "https://example.com/b.png",
      "https://example.com/c.png",
    ]);
  });

  it("an event with an explicit image field keeps it despite image-rotate", () => {
    const event = enrichEvent(
      {
        ...baseEvent,
        id: "occurrence-E",
        image: "https://example.com/explicit.png",
        description: threeImageDescription,
      },
      {},
    );
    assert.strictEqual(event.image, "https://example.com/explicit.png");
  });
});
