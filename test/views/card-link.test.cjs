require("../setup-dom.cjs");
const { describe, it, before, afterEach } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { createTestEvent, createComposite } = require("../helpers.cjs");

let renderGridView, renderListView, register;
before(async () => {
  ({ renderGridView } = await import("../../src/views/grid.js"));
  ({ renderListView } = await import("../../src/views/list.js"));
  ({ register } = await import("../../src/registry.js"));
});
afterEach(() => {
  document.body.innerHTML = "";
  window.location.hash = "";
});

const NAMES = ["clean", "compact", "badge", "hero"];
const cfg = (layout, over = {}) => ({
  locale: "en-US",
  i18n: {},
  _theme: { layout, orientation: "vertical", imagePosition: "left" },
  ...over,
});
const grid = (events, config) => {
  const c = document.createElement("div");
  document.body.appendChild(c);
  renderGridView(c, events, "UTC", config);
  return c;
};

// jsdom has no layout, so these presence checks on the stylesheet stand in
// for the browser probes. The text is flattened (runs of whitespace become
// one space, no space after an opening or before a closing parenthesis) so
// a reformat does not fail them: write each selector on one line with
// single spaces.
const css = fs.readFileSync(
  path.join(__dirname, "../../src/styles/base.css"),
  "utf8",
);
const flat = css.replace(/\s+/g, " ").replace(/\( /g, "(").replace(/ \)/g, ")");
const blockFor = (selector) => {
  const start = flat.indexOf(`${selector} {`);
  assert.notStrictEqual(start, -1, `no rule for ${selector}`);
  return flat.slice(start, flat.indexOf("}", start));
};

describe("a card opens through its title link", () => {
  for (const name of NAMES) {
    it(`${name}: the title holds the link, the card is no button`, () => {
      const c = grid(
        [createTestEvent({ id: "e1", title: "Burger Night" })],
        cfg(name),
      );
      const card = c.querySelector(".already-card");
      const link = card.querySelector(
        ".already-card__title > a.already-event-link.already-card__link",
      );
      assert.ok(link, "link inside the title");
      assert.strictEqual(link.getAttribute("href"), "#event/e1");
      assert.strictEqual(link.textContent, "Burger Night");
      assert.strictEqual(card.getAttribute("role"), null);
      assert.strictEqual(card.getAttribute("tabindex"), null);
      assert.ok(card.classList.contains("already-link-host"));
      assert.strictEqual(card.dataset.eventId, "e1");
    });
  }

  it("navigates when the link is clicked, with onEventClick asked first", () => {
    const calls = [];
    const c = grid(
      [createTestEvent({ id: "e1" })],
      cfg("clean", {
        onEventClick: (event, view) => calls.push([event.id, view]),
      }),
    );
    c.querySelector(".already-card__link").click();
    assert.deepStrictEqual(calls, [["e1", "grid"]]);
    assert.strictEqual(window.location.hash, "#event/e1");
  });

  it("list view gives the same link", () => {
    const c = document.createElement("div");
    renderListView(c, [createTestEvent({ id: "e2" })], "UTC", cfg("hero"));
    const link = c.querySelector(".already-card__title > a.already-card__link");
    assert.strictEqual(link.getAttribute("href"), "#event/e2");
    assert.strictEqual(
      c.querySelector(".already-card").getAttribute("role"),
      null,
    );
  });

  it("links a part shown as its own card to its parent when it has no id", () => {
    // A part on another day can be a top-level item; one with no id links to
    // its parent, where it is shown.
    const part = {
      ...createTestEvent({ title: "Late Set" }),
      id: undefined,
      parentId: "p1",
    };
    const c = grid([part], cfg("clean"));
    assert.strictEqual(
      c.querySelector(".already-card__link").getAttribute("href"),
      "#event/p1",
    );
  });

  it("gives an entry with no route no link, and the card stays inert", () => {
    const orphan = { ...createTestEvent({ title: "No id" }), id: undefined };
    const c = grid([orphan], cfg("clean"));
    const card = c.querySelector(".already-card");
    assert.strictEqual(card.querySelector("a.already-event-link"), null);
    assert.ok(!card.classList.contains("already-link-host"));
    assert.strictEqual(card.getAttribute("role"), null);
    assert.strictEqual(card.getAttribute("tabindex"), null);
    card.click();
    assert.strictEqual(window.location.hash, "");
  });

  it("puts already-control on the Badge Details link and on the RSVP row", () => {
    const event = createTestEvent({
      id: "e3",
      rsvp: true,
      htmlLink: "https://cal.example/e3",
    });
    const c = grid(
      [event],
      cfg("badge", { onRsvp: async () => ({ partySize: 1 }) }),
    );
    const details = c.querySelector("a.already-card__action");
    assert.ok(details.classList.contains("already-control"));
    const row = c.querySelector(".already-card__footer--rsvp");
    assert.ok(row.classList.contains("already-control"));
    assert.ok(row.contains(c.querySelector(".already-rsvp__open")));
  });

  it("puts already-control on the RSVP row a layout without a footer gets", () => {
    const event = createTestEvent({ id: "e4", rsvp: true });
    const c = grid(
      [event],
      cfg("clean", { onRsvp: async () => ({ partySize: 1 }) }),
    );
    const row = c.querySelector(".already-card__footer--rsvp");
    assert.ok(row.classList.contains("already-control"));
  });

  it("decorates a composite's card the same way", () => {
    const c = grid(
      [
        createComposite({ id: "night", title: "Burger Night" }, [
          { title: "Act" },
        ]),
      ],
      cfg("clean"),
    );
    const link = c.querySelector(".already-card__title > a.already-card__link");
    assert.strictEqual(link.getAttribute("href"), "#event/night");
    assert.strictEqual(link.textContent, "Burger Night");
  });

  it("gives a custom layout with no title a hidden link, and leaves one whose title is a link alone", () => {
    register("layout", "bare", () => {
      const card = document.createElement("div");
      card.className = "already-card";
      const body = document.createElement("div");
      body.className = "already-card__body";
      body.textContent = "no title here";
      card.appendChild(body);
      return card;
    });
    register("layout", "linked", (event) => {
      const card = document.createElement("div");
      card.className = "already-card";
      const title = document.createElement("a");
      title.className = "already-card__title";
      title.href = "https://x.example/";
      title.textContent = event.title;
      card.appendChild(title);
      return card;
    });
    const bare = grid(
      [createTestEvent({ id: "b1", title: "Bare" })],
      cfg("bare"),
    );
    const hidden = bare.querySelector("a.already-event-link");
    assert.strictEqual(hidden.getAttribute("href"), "#event/b1");
    assert.strictEqual(
      hidden.querySelector(".already-sr-only").textContent,
      "Bare",
    );

    const linked = grid(
      [createTestEvent({ id: "l1", title: "Linked" })],
      cfg("linked"),
    );
    const own = linked.querySelector("a.already-card__title");
    assert.strictEqual(own.getAttribute("href"), "https://x.example/");
    assert.strictEqual(own.querySelector("a"), null);
    assert.strictEqual(
      linked.querySelector("a.already-event-link").getAttribute("href"),
      "#event/l1",
    );
  });

  it("uses the i18n openEvent text for a hidden link when the title is empty", () => {
    register("layout", "bare2", () => {
      const card = document.createElement("div");
      card.className = "already-card";
      return card;
    });
    const c = grid(
      [createTestEvent({ id: "b2", title: "" })],
      cfg("bare2", { i18n: { openEvent: "Abrir" } }),
    );
    assert.strictEqual(
      c.querySelector(".already-sr-only").textContent,
      "Abrir",
    );
  });

  it("gives a built-in layout's card the hidden link when the event has no title", () => {
    for (const name of NAMES) {
      const c = grid([createTestEvent({ id: "nt", title: "" })], cfg(name));
      const card = c.querySelector(".already-card");
      const link = card.querySelector("a.already-event-link");
      assert.ok(link, `${name}: a link exists`);
      assert.strictEqual(
        link.textContent,
        "Open event",
        `${name}: the link is named`,
      );
      assert.strictEqual(
        card.querySelector(".already-card__title a"),
        null,
        `${name}: the empty title holds no link`,
      );
      document.body.innerHTML = "";
    }
  });
});

describe("the stretched link leaves a description's own links reachable", () => {
  it("renders a Badge card's description anchor beside the event link, with no handler on the card", () => {
    const c = grid(
      [
        createTestEvent({
          id: "d1",
          description: 'See <a href="https://example.com/x">the site</a>',
        }),
      ],
      cfg("badge"),
    );
    const card = c.querySelector(".already-card");
    const anchor = card.querySelector(".already-card__description a");
    assert.strictEqual(anchor.getAttribute("href"), "https://example.com/x");
    assert.strictEqual(
      card.querySelector("a.already-card__link").getAttribute("href"),
      "#event/d1",
    );
    anchor.click();
    assert.strictEqual(window.location.hash, "");
  });

  it("lifts a description anchor above the stretch with the same rule as a control", () => {
    const block = blockFor(
      ".already-control, .already-link-host .already-card__description a",
    );
    assert.ok(block.includes("z-index: 1;"));
  });
});

describe("the stylesheet holds its own in a host page", () => {
  it("keeps the event link's colour against a host's descendant anchor rule", () => {
    // `.page a { color }` has one class and one type; this rule enumerates the
    // link states to sit above it.
    const block = blockFor(
      ".already .already-event-link:is(:link, :visited, :hover, :active)",
    );
    assert.ok(block.includes("color: inherit;"));
    assert.ok(block.includes("text-decoration: none;"));
  });

  it("keeps a chip's and a block's colour the same way", () => {
    const block = blockFor(
      ".already :is(.already-month-chip, .already-week-event):is(:link, :visited, :hover, :active)",
    );
    assert.ok(block.includes("color: var(--already-primary-text);"));
    assert.ok(block.includes("text-decoration: none;"));
  });

  it("makes every link host its own stacking context", () => {
    // Without it, a lifted control's z-index resolves against the page and
    // paints through a host overlay that sets no z-index of its own.
    assert.ok(blockFor(".already-link-host").includes("isolation: isolate;"));
  });

  it("takes the hidden event link out of the host's flow, above its positioned content", () => {
    // An in-flow anchor with no visible content is still a flex item, and a
    // day row's gap would push its time column aside.
    const block = blockFor(".already-event-link--hidden");
    assert.ok(block.includes("position: absolute;"));
    assert.ok(block.includes("inset: 0;"));
    assert.ok(block.includes("z-index: 1;"));
  });

  it("lets a click on the popover's chevron fall through to the event link", () => {
    assert.ok(
      blockFor(".already-event-popover__card::after").includes(
        "pointer-events: none;",
      ),
    );
  });

  it("resets the other ways a host underlines a link", () => {
    const link = blockFor(
      ".already .already-event-link:is(:link, :visited, :hover, :active)",
    );
    for (const decl of [
      "background: none;",
      "border-bottom: 0;",
      "box-shadow: none;",
    ]) {
      assert.ok(link.includes(decl), `event link: ${decl}`);
    }
    const chips = blockFor(
      ".already :is(.already-month-chip, .already-week-event):is(:link, :visited, :hover, :active)",
    );
    for (const decl of [
      "background-image: none;",
      "background-color: var(--_already-chip-background, var(--already-primary));",
      "border-bottom: 0;",
      "box-shadow: none;",
    ]) {
      assert.ok(chips.includes(decl), `chip and block: ${decl}`);
    }
  });

  it("prints a chip dark through the variable the link-state rule reads", () => {
    // A plain `background` in the print rule would lose to the link-state
    // rule's specificity for a chip that is a link.
    const print = css.slice(css.indexOf("@media print"));
    const flatPrint = print.replace(/\s+/g, " ");
    const start = flatPrint.indexOf(".already-month-chip {");
    assert.notStrictEqual(start, -1);
    const block = flatPrint.slice(start, flatPrint.indexOf("}", start));
    assert.ok(block.includes("--_already-chip-background: #333;"));
  });

  it("draws the fallback ring at the host's own offset", () => {
    const start = flat.indexOf("@supports not selector(:has(a))");
    assert.notStrictEqual(start, -1);
    const block = flat.slice(start, flat.indexOf("} }", start));
    assert.ok(
      block.includes("outline-offset: var(--_already-link-ring-offset, 2px);"),
    );
  });

  it("lifts a control without deciding how it is positioned", () => {
    // A custom layout's absolutely positioned control must stay where its
    // own rule puts it, whichever stylesheet the host loads last.
    assert.ok(
      blockFor(
        ":where(.already-control, .already-link-host .already-card__description a)",
      ).includes("position: relative;"),
    );
    assert.ok(
      !blockFor(
        ".already-control, .already-link-host .already-card__description a",
      ).includes("position:"),
    );
  });

  it("shows the default cursor on the RSVP row, which opens nothing", () => {
    assert.ok(
      blockFor(".already-card__footer--rsvp").includes("cursor: default;"),
    );
  });
});
