require("../setup-dom.cjs");
const { describe, it, before, afterEach } = require("node:test");
const assert = require("node:assert");
const { createTestEvent } = require("../helpers.cjs");

let renderGridView, renderListView, register;

before(async () => {
  const reg = await import("../../src/registry.js");

  // Import layout registry (triggers defineType + registerBuiltIn for "layout")
  await import("../../src/layouts/registry.js");

  register = reg.register;

  const grid = await import("../../src/views/grid.js");
  renderGridView = grid.renderGridView;
  const list = await import("../../src/views/list.js");
  renderListView = list.renderListView;
});

afterEach(() => {
  window.location.hash = "";
});

describe("custom layout — grid view", () => {
  it("renders a custom layout", () => {
    const container = document.createElement("div");
    register("layout", "test-layout", (event, _options) => {
      const card = document.createElement("div");
      card.className = "already-card already-card--test-layout";
      const title = document.createElement("div");
      title.className = "already-card__title";
      title.textContent = event.title;
      card.appendChild(title);
      return card;
    });
    const events = [createTestEvent({ title: "Custom Card" })];
    renderGridView(container, events, "UTC", {
      _theme: {
        layout: "test-layout",
        orientation: "vertical",
        imagePosition: "left",
      },
    });
    assert.ok(container.querySelector(".already-card--test-layout"));
    assert.strictEqual(
      container.querySelector(".already-card__title").textContent,
      "Custom Card",
    );
  });

  it("renders error card when custom layout throws", () => {
    const container = document.createElement("div");
    register("layout", "throws-layout", () => {
      throw new Error("intentional failure");
    });
    const events = [createTestEvent({ title: "Broken Event" })];
    renderGridView(container, events, "UTC", {
      _theme: {
        layout: "throws-layout",
        orientation: "vertical",
        imagePosition: "left",
      },
    });
    const errorCard = container.querySelector(".already-card--error");
    assert.ok(errorCard, "error card should be rendered");
    assert.ok(
      errorCard.textContent.includes("Broken Event"),
      "error card should include event title",
    );
  });

  it("renders error card when layout returns non-HTMLElement", () => {
    const container = document.createElement("div");
    register("layout", "bad-return", () => "not an element");
    const events = [createTestEvent({ title: "Bad Return" })];
    renderGridView(container, events, "UTC", {
      _theme: {
        layout: "bad-return",
        orientation: "vertical",
        imagePosition: "left",
      },
    });
    assert.ok(container.querySelector(".already-card--error"));
  });
});

describe("custom layout — list view", () => {
  it("renders a custom layout in list view", () => {
    const container = document.createElement("div");
    register("layout", "list-custom", (event) => {
      const card = document.createElement("div");
      card.className = "already-card already-card--list-custom";
      const title = document.createElement("div");
      title.className = "already-card__title";
      title.textContent = event.title;
      card.appendChild(title);
      return card;
    });
    const events = [createTestEvent({ title: "List Card" })];
    renderListView(container, events, "UTC", {
      _theme: {
        layout: "list-custom",
        orientation: "horizontal",
        imagePosition: "left",
      },
    });
    assert.ok(container.querySelector(".already-card--list-custom"));
  });

  it("renders error card when list view layout throws", () => {
    const container = document.createElement("div");
    register("layout", "list-throws", () => {
      throw new Error("list failure");
    });
    const events = [createTestEvent({ title: "List Error" })];
    renderListView(container, events, "UTC", {
      _theme: {
        layout: "list-throws",
        orientation: "horizontal",
        imagePosition: "left",
      },
    });
    assert.ok(container.querySelector(".already-card--error"));
  });
});

describe("custom layout — error card behavior", () => {
  it("error card does not receive modifier classes or click handler", () => {
    const container = document.createElement("div");
    register("layout", "err-mods", () => {
      throw new Error("fail");
    });
    const events = [
      createTestEvent({
        title: "Past Featured",
        start: "2020-01-01T10:00:00Z",
        featured: true,
      }),
    ];
    renderGridView(container, events, "UTC", {
      _theme: {
        layout: "err-mods",
        orientation: "vertical",
        imagePosition: "left",
      },
    });
    const errorCard = container.querySelector(".already-card--error");
    assert.ok(errorCard, "error card should be rendered");
    assert.ok(
      !errorCard.classList.contains("already-card--past"),
      "error card should not have --past class",
    );
    assert.ok(
      !errorCard.classList.contains("already-card--featured"),
      "error card should not have --featured class",
    );
    assert.strictEqual(
      errorCard.dataset.eventId,
      undefined,
      "error card should not have data-event-id",
    );
    assert.strictEqual(
      errorCard.getAttribute("role"),
      null,
      "error card should not have role=button",
    );
  });

  it("shows 'Unknown Event' when event title is missing", () => {
    const container = document.createElement("div");
    register("layout", "err-no-title", () => {
      throw new Error("fail");
    });
    const events = [createTestEvent({ title: "" })];
    renderGridView(container, events, "UTC", {
      _theme: {
        layout: "err-no-title",
        orientation: "vertical",
        imagePosition: "left",
      },
    });
    const errorCard = container.querySelector(".already-card--error");
    assert.ok(
      errorCard.textContent.includes("Unknown Event"),
      "should fall back to 'Unknown Event'",
    );
  });

  it("renders error card when layout returns a DocumentFragment", () => {
    const container = document.createElement("div");
    register("layout", "frag-return", () => {
      const frag = document.createDocumentFragment();
      frag.appendChild(document.createElement("div"));
      return frag;
    });
    const events = [createTestEvent({ title: "Fragment Event" })];
    renderGridView(container, events, "UTC", {
      _theme: {
        layout: "frag-return",
        orientation: "vertical",
        imagePosition: "left",
      },
    });
    assert.ok(
      container.querySelector(".already-card--error"),
      "DocumentFragment return should produce error card",
    );
  });
});

describe("custom layout — registerLayout public API", () => {
  let registerLayout;
  before(async () => {
    const mod = await import("../../src/already-cal.js");
    registerLayout = mod.registerLayout;
  });

  it("registers a layout via the public API", () => {
    const container = document.createElement("div");
    registerLayout("public-api-test", (event) => {
      const card = document.createElement("div");
      card.className = "already-card already-card--public-api";
      card.textContent = event.title;
      return card;
    });
    const events = [createTestEvent({ title: "Public API" })];
    renderGridView(container, events, "UTC", {
      _theme: {
        layout: "public-api-test",
        orientation: "vertical",
        imagePosition: "left",
      },
    });
    assert.ok(container.querySelector(".already-card--public-api"));
  });
});

describe("custom layout — resolveTheme integration", () => {
  let resolveTheme;
  before(async () => {
    const mod = await import("../../src/theme.js");
    resolveTheme = mod.resolveTheme;
  });

  it("accepts a registered custom layout name", () => {
    register("layout", "theme-test", () => document.createElement("div"));
    const result = resolveTheme({ layout: "theme-test" });
    assert.strictEqual(result.layout, "theme-test");
  });

  it("accepts string shorthand for a registered custom layout", () => {
    register("layout", "shorthand-test", () => document.createElement("div"));
    const result = resolveTheme("shorthand-test");
    assert.strictEqual(result.layout, "shorthand-test");
  });
});

describe("custom layout — getLayout integration", () => {
  let getLayout;
  before(async () => {
    const mod = await import("../../src/layouts/registry.js");
    getLayout = mod.getLayout;
  });

  it("returns registered custom layout function", () => {
    const fn = () => document.createElement("div");
    register("layout", "direct-lookup", fn);
    assert.strictEqual(getLayout("direct-lookup"), fn);
  });
});
