require("./setup-dom.cjs");
const { describe, it, before, after, afterEach } = require("node:test");
const assert = require("node:assert");
const { createTestEvent } = require("./helpers.cjs");

let init;
before(async () => {
  ({ init } = await import("../src/already-cal.js"));
});

let originalTZ;
before(() => {
  originalTZ = process.env.TZ;
  process.env.TZ = "UTC";
});
after(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

const mounted = [];
afterEach(() => {
  for (const { instance, container } of mounted.splice(0)) {
    instance?.destroy?.();
    container.remove();
  }
  for (const el of document.querySelectorAll("meta[property^='og:']")) {
    el.remove();
  }
  window.location.hash = "";
  localStorage.clear();
});

const tick = () => new Promise((r) => setTimeout(r, 10));
const tag = (value) => ({ key: "tag", value });
const HOUR = 3_600_000;

// An instant on today's UTC date. The month, week, and day views open on
// today, so entries they should show are built from this.
function today(hour, minutes = 0) {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      hour,
      minutes,
    ),
  ).toISOString();
}

// A parent with one part, one hidden entry, and one ordinary event.
const entries = () => [
  createTestEvent({
    id: "night",
    title: "Burger Night",
    description: "Burgers. #already:composite",
    start: "2099-06-15T17:00:00Z",
    end: "2099-06-15T21:00:00Z",
  }),
  createTestEvent({
    id: "act",
    title: "The Night Owls",
    description: "#already:tag:music",
    start: "2099-06-15T18:00:00Z",
    end: "2099-06-15T20:00:00Z",
    image: "https://x.example/act.jpg",
  }),
  createTestEvent({
    id: "secret",
    title: "Private Dinner",
    description: "#already:hidden",
    start: "2099-06-15T18:30:00Z",
    end: "2099-06-15T19:00:00Z",
  }),
  createTestEvent({
    id: "solo",
    title: "Market Day",
    start: "2099-06-16T15:00:00Z",
    end: "2099-06-16T18:00:00Z",
  }),
];

async function mount(overrides = {}, events = entries()) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const instance = init({
    el: container,
    data: {
      events,
      calendar: { name: "Test Cal", description: "", timezone: "UTC" },
    },
    defaultView: "list",
    views: ["grid", "list", "month"],
    ...overrides,
  });
  mounted.push({ instance, container });
  await tick();
  return container;
}

const titles = (c) =>
  [...c.querySelectorAll(".already-card__title")].map((el) => el.textContent);

describe("a composite in the widget", () => {
  for (const view of ["list", "grid"]) {
    it(`${view}: shows one card for the parent, with its part listed, and no card for the part or the hidden entry`, async () => {
      const c = await mount({ defaultView: view });
      assert.deepStrictEqual(titles(c), ["Burger Night", "Market Day"]);
      assert.deepStrictEqual(
        [...c.querySelectorAll(".already-card__part")].map(
          (el) => el.textContent,
        ),
        ["6:00 PM The Night Owls"],
      );
    });
  }

  it("changes nothing when no entry carries the flag", async () => {
    const plain = entries().map((e) => ({
      ...e,
      description: e.description.replace("#already:composite", ""),
    }));
    const c = await mount({}, plain);
    assert.deepStrictEqual(titles(c), [
      "Burger Night",
      "The Night Owls",
      "Market Day",
    ]);
    assert.strictEqual(c.querySelector(".already-card--composite"), null);
  });

  it("hands onDataLoad the flat list, with every entry and no composed fields", async () => {
    let seen = null;
    await mount({
      onDataLoad: (data) => {
        seen = data;
      },
    });
    assert.deepStrictEqual(
      seen.events.map((e) => e.id),
      ["night", "act", "secret", "solo"],
    );
    for (const e of seen.events) {
      assert.ok(!("parts" in e));
      assert.ok(!("parentId" in e));
    }
    assert.strictEqual(seen.events[0].composite, true);
  });

  it("opens the composite's detail from a link to a part, marks that part, and tells the host which entry was linked", async () => {
    const clicks = [];
    const c = await mount({
      initialEvent: "act",
      onEventClick: (event, view) => clicks.push({ event, view }),
    });
    assert.strictEqual(
      c.querySelector(".already-detail-title").textContent,
      "Burger Night",
    );
    assert.strictEqual(
      c.querySelector(".already-detail-part--target").dataset.eventId,
      "act",
    );
    assert.strictEqual(clicks.length, 1);
    assert.strictEqual(clicks[0].view, "detail");
    assert.strictEqual(clicks[0].event.id, "act");
    assert.strictEqual(clicks[0].event.parentId, "night");
  });

  it("tells the host about the parent, with its parts, for a link to the parent", async () => {
    const clicks = [];
    await mount({
      initialEvent: "night",
      onEventClick: (event) => clicks.push(event),
    });
    assert.strictEqual(clicks[0].id, "night");
    assert.deepStrictEqual(
      clicks[0].parts.map((p) => p.id),
      ["act"],
    );
    assert.strictEqual(clicks[0].image, null);
  });

  it("still opens a hidden entry from its own link", async () => {
    const c = await mount({ initialEvent: "secret" });
    assert.strictEqual(
      c.querySelector(".already-detail-title").textContent,
      "Private Dinner",
    );
  });

  it("still reports an unknown id as not found", async () => {
    // The default error state prints one fixed line whatever the message, so
    // the message is read through a custom renderer.
    const c = await mount({
      initialEvent: "nope",
      renderError: ({ message }) => `<p class="probe">${message}</p>`,
    });
    assert.strictEqual(
      c.querySelector(".probe").textContent,
      "Event not found.",
    );
  });

  it("sets og:image to the composite's lead image", async () => {
    await mount({ initialEvent: "night" });
    assert.strictEqual(
      document
        .querySelector('meta[property="og:image"]')
        .getAttribute("content"),
      "https://x.example/act.jpg",
    );
  });

  it("offers a part's tag as a filter pill and keeps the composite when it is chosen", async () => {
    const c = await mount();
    const pill = [...c.querySelectorAll(".already-tag-pill")].find(
      (el) => el.textContent === "music",
    );
    assert.ok(pill);
    pill.click();
    assert.deepStrictEqual(titles(c), ["Burger Night"]);
  });
});

// The same four entries on today's date. Views that show them are mounted
// with past events shown, so the hour the suite runs at does not matter.
const todays = () => [
  createTestEvent({
    id: "night",
    title: "Burger Night",
    description: "#already:composite",
    start: today(10),
    end: today(14),
  }),
  createTestEvent({
    id: "act",
    title: "The Night Owls",
    start: today(11),
    end: today(12),
  }),
  createTestEvent({
    id: "secret",
    title: "Private Dinner",
    description: "#already:hidden",
    start: today(12),
    end: today(12, 30),
  }),
  createTestEvent({
    id: "solo",
    title: "Market Day",
    start: today(15),
    end: today(16),
  }),
];
const everyView = {
  views: ["month", "week", "day", "grid", "list"],
  showPastEvents: true,
};
const textsOf = (c, selector) =>
  [...c.querySelectorAll(selector)].map((el) => el.textContent);

describe("no view shows a hidden entry or a part at the top level", () => {
  const cases = [
    ["month", ".already-month-chip"],
    ["week", ".already-week-event"],
    ["grid", ".already-card__title"],
    ["list", ".already-card__title"],
  ];
  for (const [view, selector] of cases) {
    it(`${view}: shows the parent and the ordinary event only`, async () => {
      const c = await mount({ ...everyView, defaultView: view }, todays());
      assert.deepStrictEqual(textsOf(c, selector), [
        "Burger Night",
        "Market Day",
      ]);
    });
  }

  it("day: shows the part as a row under its parent, and no hidden entry", async () => {
    const c = await mount({ ...everyView, defaultView: "day" }, todays());
    assert.deepStrictEqual(textsOf(c, ".already-day-event-title"), [
      "Burger Night",
      "The Night Owls",
      "Market Day",
    ]);
    assert.strictEqual(
      c.querySelectorAll(".already-day-event--part").length,
      1,
    );
  });
});

describe("what onEventClick receives", () => {
  // Returning false stops navigation, so the view under test stays mounted.
  const recorder = () => {
    const clicks = [];
    const onEventClick = (event, view) => {
      clicks.push({ event, view });
      return false;
    };
    return { clicks, onEventClick };
  };

  it("gets the composed parent, with every part, for a click on its card", async () => {
    const { clicks, onEventClick } = recorder();
    const c = await mount({ onEventClick });
    c.querySelector(".already-card").click();
    assert.strictEqual(clicks.length, 1);
    assert.strictEqual(clicks[0].view, "list");
    assert.strictEqual(clicks[0].event.id, "night");
    assert.deepStrictEqual(
      clicks[0].event.parts.map((p) => p.id),
      ["act"],
    );
    // The parent's own tags: the part's `music` tag is not written into them.
    assert.deepStrictEqual(clicks[0].event.tags, []);
  });

  it("gets the part, with parentId, for a click on the part's own row", async () => {
    const { clicks, onEventClick } = recorder();
    const c = await mount(
      { ...everyView, defaultView: "day", onEventClick },
      todays(),
    );
    c.querySelector(".already-day-event--part").click();
    assert.strictEqual(clicks.length, 1);
    assert.strictEqual(clicks[0].view, "day");
    assert.strictEqual(clicks[0].event.id, "act");
    assert.strictEqual(clicks[0].event.parentId, "night");
  });
});

describe("pagination counts composites", () => {
  it("counts a parent and its part as one event", async () => {
    const c = await mount({ pageSize: 1 });
    assert.deepStrictEqual(titles(c), ["Burger Night"]);
    assert.ok(
      c
        .querySelector(".already-load-more")
        .textContent.includes("(1 remaining)"),
    );
  });
});

describe("a part on another day follows its parent", () => {
  // The parent started yesterday at noon and ends tomorrow at noon. Its part
  // started at midnight today and is already over.
  const spanning = () => {
    const midnight = Date.parse(today(0));
    const iso = (ms) => new Date(ms).toISOString();
    return [
      createTestEvent({
        id: "fest",
        title: "Festival",
        composite: true,
        start: iso(midnight - 12 * HOUR),
        end: iso(midnight + 36 * HOUR),
      }),
      createTestEvent({
        id: "late",
        title: "Late Set",
        start: iso(midnight),
        end: iso(midnight + 1),
      }),
    ];
  };

  it("keeps its row, styled as past, while the parent is current", async () => {
    const c = await mount(
      { views: ["day", "list"], defaultView: "day" },
      spanning(),
    );
    const rows = [...c.querySelectorAll(".already-day-event")];
    assert.deepStrictEqual(textsOf(c, ".already-day-event-title"), [
      "Late Set",
    ]);
    assert.ok(rows[0].classList.contains("already-day-event--past"));
  });

  it("loses its row when a tag filter removes the parent", async () => {
    const events = [
      ...spanning(),
      // Market Day starts inside the festival's hours, so it opts out to stay
      // an event of its own.
      createTestEvent({
        id: "solo",
        title: "Market Day",
        standalone: true,
        tags: [tag("outdoor")],
        start: today(0),
        end: today(1),
      }),
    ];
    const c = await mount({ ...everyView, defaultView: "day" }, events);
    assert.deepStrictEqual(textsOf(c, ".already-day-event-title"), [
      "Market Day",
      "Late Set",
    ]);
    [...c.querySelectorAll(".already-tag-pill")]
      .find((el) => el.textContent === "outdoor")
      .click();
    assert.deepStrictEqual(textsOf(c, ".already-day-event-title"), [
      "Market Day",
    ]);
  });
});

describe("past state follows the parent", () => {
  const hours = (n) => new Date(Date.now() + n * HOUR).toISOString();

  it("keeps a finished part on a current parent's card and offers no past toggle for it", async () => {
    const c = await mount({}, [
      createTestEvent({
        id: "night",
        title: "Burger Night",
        composite: true,
        start: hours(-2),
        end: hours(2),
      }),
      createTestEvent({
        id: "act",
        title: "Early Set",
        start: hours(-1.5),
        end: hours(-0.5),
      }),
    ]);
    assert.deepStrictEqual(titles(c), ["Burger Night"]);
    assert.strictEqual(c.querySelectorAll(".already-card__part").length, 1);
    assert.strictEqual(
      c.querySelector(".already-toggle-container").children.length,
      0,
    );
  });
});
