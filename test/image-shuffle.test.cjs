const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let extractDirectives, enrichEvent, enrichGoogleEvent, stableIndex;

before(async () => {
  const dirMod = await import("../src/util/directives.js");
  extractDirectives = dirMod.extractDirectives;
  const dataMod = await import("../src/data.js");
  enrichEvent = dataMod.enrichEvent;
  enrichGoogleEvent = dataMod.enrichGoogleEvent;
  stableIndex = (await import("../src/util/hash.js")).stableIndex;
});

// --- extractDirectives flag tests ---

describe("extractDirectives: image-shuffle flag", () => {
  it("extracts imageShuffle from #already:image-shuffle", () => {
    const result = extractDirectives("Event info #already:image-shuffle");
    assert.strictEqual(result.imageShuffle, true);
    assert.ok(!result.description.includes("#already"));
    assert.ok(result.description.includes("Event info"));
  });

  it("is case-insensitive for the keyword", () => {
    const result = extractDirectives("#already:IMAGE-SHUFFLE");
    assert.strictEqual(result.imageShuffle, true);
  });

  it("coexists with image directives without consuming them", () => {
    const result = extractDirectives(
      "#already:image-shuffle #already:image:https://example.com/a.png",
    );
    assert.strictEqual(result.imageShuffle, true);
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].type, "image");
  });

  it("returns false for plain description", () => {
    const result = extractDirectives("Just text");
    assert.strictEqual(result.imageShuffle, false);
  });

  it("returns false for null description", () => {
    const result = extractDirectives(null);
    assert.strictEqual(result.imageShuffle, false);
  });
});

// --- enrichEvent propagation + shuffle tests ---

describe("enrichEvent: image-shuffle propagation", () => {
  const baseEvent = {
    id: "1",
    title: "Test",
    start: "2026-04-15T10:00:00Z",
    end: "2026-04-15T11:00:00Z",
  };

  const threeImageDescription =
    "#already:image-shuffle " +
    "#already:image:https://example.com/a.png " +
    "#already:image:https://example.com/b.png " +
    "#already:image:https://example.com/c.png";

  it("sets event.imageShuffle from #already:image-shuffle directive", () => {
    const event = enrichEvent(
      { ...baseEvent, description: "#already:image-shuffle" },
      {},
    );
    assert.strictEqual(event.imageShuffle, true);
  });

  it("defaults imageShuffle to false when absent", () => {
    const event = enrichEvent({ ...baseEvent, description: "Plain text" }, {});
    assert.strictEqual(event.imageShuffle, false);
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

  it("across 30 ids, every one of the three images is chosen at least once", () => {
    const chosen = new Set();
    for (let n = 1; n <= 30; n++) {
      chosen.add(
        enrichEvent(
          { ...baseEvent, id: `occ-${n}`, description: threeImageDescription },
          {},
        ).image,
      );
    }
    assert.strictEqual(chosen.size, 3, `only chose ${[...chosen]}`);
  });

  it("the chosen image leads and the other two follow in original order", () => {
    const id = "occurrence-B";
    const event = enrichEvent(
      { ...baseEvent, id, description: threeImageDescription },
      {},
    );
    const all = [
      "https://example.com/a.png",
      "https://example.com/b.png",
      "https://example.com/c.png",
    ];
    const i = stableIndex(id, all.length);
    assert.deepStrictEqual(event.images, [
      all[i],
      ...all.slice(0, i),
      ...all.slice(i + 1),
    ]);
    assert.strictEqual(event.image, all[i]);
  });

  it("with one image, shuffling has nothing to do and the result is that image", () => {
    const event = enrichEvent(
      {
        ...baseEvent,
        id: "occurrence-C",
        description:
          "#already:image-shuffle #already:image:https://example.com/only.png",
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

  it("an event with an explicit image field keeps it despite image-shuffle", () => {
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

  const three = [
    "https://example.com/a.png",
    "https://example.com/b.png",
    "https://example.com/c.png",
  ];
  const shuffled = (id) => {
    const i = stableIndex(id, three.length);
    return [three[i], ...three.slice(0, i), ...three.slice(i + 1)];
  };

  it("shuffles a host-supplied images array", () => {
    const event = enrichEvent(
      {
        ...baseEvent,
        id: "host-1",
        description: "",
        images: [...three],
        imageShuffle: true,
      },
      {},
    );
    assert.deepStrictEqual(event.images, shuffled("host-1"));
    assert.strictEqual(event.image, event.images[0]);
  });

  it("shuffles attachment images combined with the directive", () => {
    const description =
      "#already:image-shuffle #already:image:https://example.com/a.png";
    const event = enrichEvent(
      {
        ...baseEvent,
        id: "att-1",
        description,
        attachments: [
          { mimeType: "image/png", url: "https://example.com/b.png" },
          { mimeType: "image/png", url: "https://example.com/c.png" },
        ],
      },
      {},
    );
    assert.deepStrictEqual(event.images, shuffled("att-1"));
    assert.strictEqual(event.image, event.images[0]);
  });

  it("enriching an already-enriched shuffled event leaves image and images unchanged", () => {
    const once = enrichEvent(
      { ...baseEvent, id: "twice-1", description: threeImageDescription },
      {},
    );
    const twice = enrichEvent(once, {});
    assert.strictEqual(twice.image, once.image);
    assert.deepStrictEqual(twice.images, once.images);
  });

  it("keeps the original images order when an explicit image is set", () => {
    const event = enrichEvent(
      {
        ...baseEvent,
        id: "explicit-1",
        image: "https://example.com/explicit.png",
        images: [...three],
        imageShuffle: true,
      },
      {},
    );
    assert.deepStrictEqual(event.images, three);
    assert.strictEqual(event.image, "https://example.com/explicit.png");
  });

  it("does not throw when the event has no id, and treats it as an empty id", () => {
    const { id: _id, ...noId } = baseEvent;
    const event = enrichEvent(
      { ...noId, description: threeImageDescription },
      {},
    );
    assert.deepStrictEqual(event.images, shuffled(""));
    assert.strictEqual(event.image, event.images[0]);
  });

  it("enrichGoogleEvent applies the directive and shuffles", () => {
    const event = enrichGoogleEvent(
      {
        id: "g-1",
        summary: "Weekly",
        description:
          "#already:image-shuffle " +
          "#already:image:https://example.com/a.png " +
          "#already:image:https://example.com/b.png " +
          "#already:image:https://example.com/c.png",
        start: { dateTime: "2026-04-04T16:00:00-05:00" },
        end: { dateTime: "2026-04-04T19:00:00-05:00" },
      },
      {},
    );
    assert.strictEqual(event.imageShuffle, true);
    assert.deepStrictEqual(event.images, shuffled("g-1"));
    assert.strictEqual(event.image, event.images[0]);
  });
});

describe("enrichEvent: Google auto-linked image directives", () => {
  it("collects every linked image and picks a lead image", () => {
    const urls = [1, 2, 3].map(
      (n) => `https://lh3.googleusercontent.com/pw/img${n}=w1600`,
    );
    const description =
      "Hello<br>#already:image-shuffle<br>" +
      urls
        .map((u, i) => `#already:image:<a href="${u}">photo ${i + 1}</a>`)
        .join("<br>");
    const event = enrichEvent(
      {
        id: "g1",
        title: "Test",
        start: "2026-04-15T10:00:00Z",
        end: "2026-04-15T11:00:00Z",
        description,
      },
      {},
    );
    assert.deepStrictEqual(event.images, urls);
    assert.ok(urls.includes(event.image));
    assert.ok(!event.description.includes("photo"));
    assert.ok(!event.description.includes("#already"));
    assert.ok(!event.description.includes("<a"));
  });
});
