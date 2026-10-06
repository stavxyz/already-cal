const { describe, it, before } = require("node:test");
const assert = require("node:assert");
const { createTestEvent, createComposite } = require("./helpers.cjs");

let isSecondListing,
  compositeImages,
  compositeLeadImage,
  compositeTags,
  partsOf;

before(async () => {
  ({
    isSecondListing,
    compositeImages,
    compositeLeadImage,
    compositeTags,
    partsOf,
  } = await import("../src/composite.js"));
});

const tag = (value) => ({ key: "tag", value });

describe("isSecondListing", () => {
  const titled = (title) => ({ title });

  it("matches titles that differ only in case, punctuation, and emoji", () => {
    assert.strictEqual(
      isSecondListing(
        titled("John Prine Night (7th Annual)"),
        titled("JOHN PRINE NIGHT 🌭 - 7TH ANNUAL"),
      ),
      true,
    );
  });

  it("does not match different titles", () => {
    assert.strictEqual(
      isSecondListing(titled("John Cavender @ BURGS"), titled("burger nite")),
      false,
    );
  });

  it("never matches when a title has no letters or digits", () => {
    assert.strictEqual(isSecondListing(titled("🌭🌭"), titled("🎵")), false);
    assert.strictEqual(isSecondListing(titled(""), titled("")), false);
    assert.strictEqual(isSecondListing({}, {}), false);
  });

  it("gives the same answer for a copy of the part", () => {
    const parent = titled("Harvest Dinner");
    const part = titled("harvest dinner!");
    assert.strictEqual(isSecondListing({ ...part }, parent), true);
  });

  it("treats an accented letter as its base letter", () => {
    assert.strictEqual(
      isSecondListing(titled("Café Night"), titled("CAFE NIGHT")),
      true,
    );
  });

  it("sets aside accents, emoji variation selectors, keycaps, and character width", () => {
    const pairs = [
      ["Caf\u00e9 Night", "cafe night"],
      ["Summer Party \u2600\ufe0f", "summer party"],
      ["Stage 1\ufe0f\u20e3", "stage 1"],
      // Halfwidth and fullwidth katakana for the same word.
      ["\uff76\uff9e\uff77", "\u30ac\u30ad"],
    ];
    for (const [a, b] of pairs) {
      assert.strictEqual(isSecondListing(titled(a), titled(b)), true, a);
    }
  });

  it("tells titles apart by a vowel or voicing mark in scripts that use them", () => {
    const pairs = [
      // Thai: two different vowel marks on the same consonants.
      ["\u0e01\u0e34\u0e19", "\u0e01\u0e38\u0e19"],
      // Devanagari: two different vowel signs on the same consonants.
      ["\u0915\u093f\u0928", "\u0915\u0941\u0928"],
      // Japanese hiragana: a voicing mark makes a different syllable.
      ["\u304b\u304d", "\u304c\u304d"],
    ];
    for (const [a, b] of pairs) {
      assert.strictEqual(isSecondListing(titled(a), titled(b)), false, a);
    }
  });
});

describe("accessors on an event without parts", () => {
  it("return the event's own values", () => {
    const tags = [tag("food")];
    const images = ["https://x.example/a.jpg", "https://x.example/b.jpg"];
    const event = createTestEvent({ image: images[0], images, tags });
    assert.strictEqual(compositeImages(event), images);
    assert.strictEqual(compositeLeadImage(event), images[0]);
    assert.strictEqual(compositeTags(event), tags);
  });

  it("fall back to the single image when the list is empty", () => {
    const event = createTestEvent({ image: "https://x.example/a.jpg" });
    assert.deepStrictEqual(compositeImages(event), ["https://x.example/a.jpg"]);
  });

  it("return empty values for an event with nothing", () => {
    const event = createTestEvent({ tags: undefined });
    assert.deepStrictEqual(compositeImages(event), []);
    assert.strictEqual(compositeLeadImage(event), null);
    assert.deepStrictEqual(compositeTags(event), []);
  });

  it("keep an ordinary event without a lead image even when its list has images", () => {
    // A host's eventTransform can clear `image` to suppress the card image
    // while leaving `images` for the detail gallery. Without parts the lead
    // image is the event's own `image` and nothing else, as it is today.
    const event = createTestEvent({
      image: null,
      images: ["https://x.example/a.jpg"],
    });
    assert.strictEqual(compositeLeadImage(event), null);
  });
});

describe("accessors on a composed parent", () => {
  it("combine images in order and drop exact duplicates", () => {
    const event = createComposite(
      { image: "https://x.example/p.jpg", images: ["https://x.example/p.jpg"] },
      [
        {
          image: "https://x.example/1.jpg",
          images: ["https://x.example/1.jpg"],
        },
        {
          image: "https://x.example/p.jpg",
          images: ["https://x.example/p.jpg", "https://x.example/2.jpg"],
        },
      ],
    );
    assert.deepStrictEqual(compositeImages(event), [
      "https://x.example/p.jpg",
      "https://x.example/1.jpg",
      "https://x.example/2.jpg",
    ]);
  });

  it("lead with the parent's own image when it has one", () => {
    const event = createComposite({ image: "https://x.example/p.jpg" }, [
      { image: "https://x.example/1.jpg" },
    ]);
    assert.strictEqual(compositeLeadImage(event), "https://x.example/p.jpg");
  });

  it("lead with a part's image when the parent has none", () => {
    const event = createComposite({}, [{ image: "https://x.example/1.jpg" }]);
    assert.strictEqual(compositeLeadImage(event), "https://x.example/1.jpg");
  });

  it("combine tags and skip a label the parent already has", () => {
    const event = createComposite({ tags: [tag("food")] }, [
      { tags: [tag("music"), tag("food")] },
      { tags: [{ key: "cost", value: "$5" }] },
    ]);
    assert.deepStrictEqual(compositeTags(event), [
      tag("food"),
      tag("music"),
      { key: "cost", value: "$5" },
    ]);
  });

  it("leave the parent's own fields as they were", () => {
    const tags = [tag("food")];
    const event = createComposite({ tags }, [
      { tags: [tag("music")], image: "https://x.example/1.jpg" },
    ]);
    compositeTags(event);
    compositeImages(event);
    assert.strictEqual(event.tags, tags);
    assert.strictEqual(event.image, null);
    assert.deepStrictEqual(event.images, []);
  });
});

describe("a host's own field named parts", () => {
  it("is not a composite", () => {
    const event = createTestEvent({
      id: "host",
      image: "https://x.example/own.jpg",
      parts: [{ id: "ticket-tier", image: "https://x.example/other.jpg" }],
    });
    assert.deepStrictEqual(partsOf(event), []);
    assert.deepStrictEqual(compositeImages(event), [
      "https://x.example/own.jpg",
    ]);
  });

  it("is not a composite when it is not a list", () => {
    assert.deepStrictEqual(partsOf(createTestEvent({ parts: "two" })), []);
    assert.deepStrictEqual(partsOf(null), []);
  });
});
