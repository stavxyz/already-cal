require("../setup-dom.cjs");
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const { createTestEvent, createComposite } = require("../helpers.cjs");

const NAMES = ["clean", "compact", "badge", "hero"];
const layouts = {};

before(async () => {
  for (const name of NAMES) {
    const mod = await import(`../../src/layouts/${name}/${name}.js`);
    layouts[name] = mod.render;
  }
});

// Card dates render in the viewer's zone. Pin it so the cards are the same on
// every machine.
let originalTZ;
before(() => {
  originalTZ = process.env.TZ;
  process.env.TZ = "UTC";
});
after(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

const options = {
  orientation: "vertical",
  imagePosition: "left",
  index: 0,
  timezone: "UTC",
  locale: "en-US",
  config: {},
};
const tag = (value) => ({ key: "tag", value });
const classOf = (el) => (el ? el.className : null);

describe("parts slot", () => {
  for (const name of NAMES) {
    it(`${name}: renders no slot for an event without parts`, () => {
      const card = layouts[name](
        createTestEvent({ location: "Here", description: "Text" }),
        options,
      );
      assert.strictEqual(card.querySelector(".already-card__parts"), null);
    });

    it(`${name}: renders one empty slot for a composed parent`, () => {
      const card = layouts[name](
        createComposite({ location: "Here", description: "Text" }),
        options,
      );
      const slots = card.querySelectorAll(".already-card__parts");
      assert.strictEqual(slots.length, 1);
      assert.strictEqual(slots[0].childNodes.length, 0);
    });
  }

  it("clean: puts the slot at the end of the body, after the location", () => {
    const card = layouts.clean(createComposite({ location: "Here" }), options);
    const slot = card.querySelector(".already-card__parts");
    assert.strictEqual(slot.parentElement.className, "already-card__body");
    assert.strictEqual(
      classOf(slot.previousElementSibling),
      "already-card__location",
    );
    assert.strictEqual(slot.nextElementSibling, null);
  });

  it("compact: puts the slot at the end of the info column, after the location", () => {
    const card = layouts.compact(
      createComposite({ location: "Here" }),
      options,
    );
    const slot = card.querySelector(".already-card__parts");
    assert.strictEqual(
      slot.parentElement.className,
      "already-card__compact-info",
    );
    assert.strictEqual(
      classOf(slot.previousElementSibling),
      "already-card__location",
    );
    assert.strictEqual(slot.nextElementSibling, null);
  });

  it("badge: puts the slot after the location and before the tag pills", () => {
    const card = layouts.badge(
      createComposite({ location: "Here", tags: [tag("food")] }),
      options,
    );
    const slot = card.querySelector(".already-card__parts");
    assert.strictEqual(
      classOf(slot.previousElementSibling),
      "already-card__location",
    );
    assert.strictEqual(classOf(slot.nextElementSibling), "already-card__tags");
  });

  it("hero: puts the slot after the title and before the description", () => {
    const card = layouts.hero(
      createComposite({ description: "Text" }),
      options,
    );
    const slot = card.querySelector(".already-card__parts");
    assert.strictEqual(
      classOf(slot.previousElementSibling),
      "already-card__title",
    );
    assert.strictEqual(
      classOf(slot.nextElementSibling),
      "already-card__description",
    );
  });
});

describe("card image of a composite", () => {
  const src = (card) =>
    card.querySelector(".already-card__image img").getAttribute("src");

  it("uses a part's image when the parent has none", () => {
    const card = layouts.clean(
      createComposite({}, [{ image: "https://x.example/1.jpg" }]),
      options,
    );
    assert.strictEqual(src(card), "https://x.example/1.jpg");
  });

  it("keeps the parent's own image when it has one", () => {
    const card = layouts.clean(
      createComposite({ image: "https://x.example/p.jpg" }, [
        { image: "https://x.example/1.jpg" },
      ]),
      options,
    );
    assert.strictEqual(src(card), "https://x.example/p.jpg");
  });

  it("badge draws one date badge when the only image comes from a part", () => {
    const card = layouts.badge(
      createComposite({}, [{ image: "https://x.example/1.jpg" }]),
      options,
    );
    assert.strictEqual(card.querySelectorAll(".already-card__badge").length, 1);
    assert.strictEqual(
      card.querySelectorAll(".already-card__badge--inline").length,
      0,
    );
  });

  it("badge still draws the inline date badge when nothing has an image", () => {
    const card = layouts.badge(createComposite(), options);
    assert.strictEqual(
      card.querySelectorAll(".already-card__badge--inline").length,
      1,
    );
  });
});

describe("tag pills of a composite", () => {
  const labels = (card) =>
    [...card.querySelectorAll(".already-card__tag")].map(
      (el) => el.textContent,
    );

  for (const name of ["badge", "compact"]) {
    it(`${name}: shows a part's tag beside the parent's`, () => {
      const card = layouts[name](
        createComposite({ tags: [tag("food")] }, [{ tags: [tag("music")] }]),
        options,
      );
      assert.deepStrictEqual(labels(card), ["food", "music"]);
    });

    it(`${name}: shows a tag that only a part carries`, () => {
      const card = layouts[name](
        createComposite({}, [{ tags: [tag("music")] }]),
        options,
      );
      assert.deepStrictEqual(labels(card), ["music"]);
    });
  }

  it("badge: shows only its own tags for an event without parts", () => {
    const card = layouts.badge(
      createTestEvent({ tags: [tag("food")] }),
      options,
    );
    assert.deepStrictEqual(labels(card), ["food"]);
  });

  it("badge: renders no tag row when there are no category tags", () => {
    const card = layouts.badge(createTestEvent(), options);
    assert.strictEqual(card.querySelector(".already-card__tags"), null);
  });
});
