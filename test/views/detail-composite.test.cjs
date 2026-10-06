require("../setup-dom.cjs");
const { describe, it, before, after, afterEach } = require("node:test");
const assert = require("node:assert");
const { createTestEvent, createComposite } = require("../helpers.cjs");

let renderDetailView;

before(async () => {
  ({ renderDetailView } = await import("../../src/views/detail.js"));
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
afterEach(() => {
  document.body.innerHTML = "";
});

const config = (over = {}) => ({ locale: "en-US", i18n: {}, ...over });
const tag = (value) => ({ key: "tag", value });
const night = (parts, over = {}) =>
  createComposite(
    {
      title: "Burger Night",
      start: "2099-06-15T17:00:00Z",
      end: "2099-06-15T21:00:00Z",
      location: "The Grocer",
      description: "Burgers every Friday.",
      ...over,
    },
    parts,
  );
const act = (over = {}) => ({
  title: "John Cavender",
  start: "2099-06-15T18:00:00Z",
  end: "2099-06-15T20:00:00Z",
  location: "The Grocer",
  ...over,
});
const render = (event, cfg = config(), options) => {
  const c = document.createElement("div");
  document.body.appendChild(c);
  renderDetailView(c, event, "UTC", () => {}, cfg, options);
  return c;
};
const items = (c) => [...c.querySelectorAll(".already-detail-part")];

describe("detail view of an ordinary event", () => {
  it("has no parts list", () => {
    const c = render(createTestEvent({ title: "Solo", description: "Text" }));
    assert.strictEqual(c.querySelector(".already-detail-parts"), null);
    assert.strictEqual(
      c.querySelector(".already-detail-description").textContent,
      "Text",
    );
  });
});

describe("detail view of a composite", () => {
  it("lists each part after the parent's own content", () => {
    const c = render(night([act(), act({ title: "Hank Woji" })]));
    const list = c.querySelector(".already-detail-parts");
    assert.strictEqual(list.getAttribute("role"), "group");
    assert.strictEqual(list.getAttribute("aria-label"), "Schedule");
    assert.strictEqual(items(c).length, 2);
    assert.strictEqual(
      c.querySelector(".already-detail-title").textContent,
      "Burger Night",
    );
    const description = c.querySelector(".already-detail-description");
    assert.ok(
      description.compareDocumentPosition(list) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("takes the list's label from i18n.compositeParts", () => {
    const c = render(
      night([act()]),
      config({ i18n: { compositeParts: "Lineup" } }),
    );
    assert.strictEqual(
      c.querySelector(".already-detail-parts").getAttribute("aria-label"),
      "Lineup",
    );
  });

  it("shows a part's time and title", () => {
    const item = items(render(night([act()])))[0];
    // The dash in the expected text is the date formatter's own output.
    assert.strictEqual(
      item.querySelector(".already-detail-part-time").textContent,
      "6:00 – 8:00 PM",
    );
    assert.strictEqual(
      item.querySelector(".already-detail-part-title").textContent,
      "John Cavender",
    );
    assert.strictEqual(item.dataset.eventId, "part-1");
  });

  it("omits the title of a second listing and keeps its time", () => {
    const item = items(render(night([act({ title: "BURGER NIGHT!" })])))[0];
    assert.strictEqual(item.querySelector(".already-detail-part-title"), null);
    assert.ok(item.querySelector(".already-detail-part-time"));
  });

  it("renders no title element for an untitled part", () => {
    const item = items(render(night([act({ title: "" })])))[0];
    assert.ok(item.querySelector(".already-detail-part-time"));
    assert.strictEqual(item.querySelector(".already-detail-part-title"), null);
    const head = item.querySelector(".already-detail-part-head").textContent;
    assert.strictEqual(head, head.trim());
  });

  it("omits the time when it equals the parent's", () => {
    const item = items(
      render(
        night([
          act({ start: "2099-06-15T17:00:00Z", end: "2099-06-15T21:00:00Z" }),
        ]),
      ),
    )[0];
    assert.strictEqual(item.querySelector(".already-detail-part-time"), null);
    assert.ok(item.querySelector(".already-detail-part-title"));
  });

  it("renders no heading line for a second listing at the parent's time", () => {
    const item = items(
      render(
        night([
          act({
            title: "burger night",
            start: "2099-06-15T17:00:00Z",
            end: "2099-06-15T21:00:00Z",
            description: "From the other calendar.",
          }),
        ]),
      ),
    )[0];
    assert.strictEqual(item.querySelector(".already-detail-part-head"), null);
    assert.strictEqual(
      item.querySelector(".already-detail-description").textContent,
      "From the other calendar.",
    );
  });

  it("shows a part's location only when it differs from the parent's", () => {
    const c = render(night([act(), act({ location: "The Patio" })]));
    const [same, other] = items(c);
    assert.strictEqual(
      same.querySelector(".already-detail-part-location"),
      null,
    );
    assert.strictEqual(
      other.querySelector(".already-detail-part-location").textContent,
      "The Patio",
    );
  });

  it("renders each part's description, links, and attachments with that part", () => {
    const c = render(
      night([
        act({
          description: "Songs of the border.",
          links: [{ label: "Listen", url: "https://x.example/listen" }],
          attachments: [
            { label: "Set list", url: "https://x.example/s.pdf", type: "pdf" },
          ],
          tags: [{ key: "tickets", value: "https://x.example/t" }],
        }),
      ]),
    );
    const item = items(c)[0];
    assert.strictEqual(
      item.querySelector(".already-detail-description").textContent,
      "Songs of the border.",
    );
    const linkLabels = [...item.querySelectorAll(".already-detail-link")].map(
      (a) => a.textContent,
    );
    assert.deepStrictEqual(linkLabels, ["Listen", "Tickets"]);
    assert.strictEqual(
      item.querySelector(".already-detail-attachment").textContent,
      "Set list",
    );
    // The parent's own link row has none of them.
    const parentLinks = [...c.querySelectorAll(".already-detail-link")].filter(
      (a) => !item.contains(a),
    );
    assert.strictEqual(parentLinks.length, 0);
  });

  it("mounts an RSVP control inside the part it belongs to", () => {
    const cfg = config({ onRsvp: async () => ({ partySize: 1 }) });
    const c = render(
      night([act({ rsvp: true }), act({ title: "No RSVP" })]),
      cfg,
    );
    const [withRsvp, without] = items(c);
    assert.ok(withRsvp.querySelector(".already-rsvp__open"));
    assert.strictEqual(without.querySelector(".already-rsvp__open"), null);
    assert.strictEqual(c.querySelectorAll(".already-rsvp__open").length, 1);
  });

  it("shows the composite's images and tags as one", () => {
    const c = render(
      night([act({ image: "https://x.example/1.jpg", tags: [tag("music")] })], {
        tags: [tag("food")],
      }),
    );
    assert.strictEqual(
      c.querySelector(".already-detail-gallery-img").getAttribute("src"),
      "https://x.example/1.jpg",
    );
    const pills = [...c.querySelectorAll(".already-detail-tag")].map(
      (el) => el.textContent,
    );
    assert.deepStrictEqual(pills, ["food", "music"]);
  });

  it("shows a tag pill that only a part carries", () => {
    const c = render(night([act({ tags: [tag("music")] })]));
    const pills = [...c.querySelectorAll(".already-detail-tag")].map(
      (el) => el.textContent,
    );
    assert.deepStrictEqual(pills, ["music"]);
  });

  it("groups parts under day headings when they fall on more than one day", () => {
    const c = render(
      night(
        [
          act(),
          act({
            title: "Day Two",
            start: "2099-06-16T18:00:00Z",
            end: "2099-06-16T19:00:00Z",
          }),
        ],
        { end: "2099-06-16T21:00:00Z" },
      ),
    );
    const headings = [...c.querySelectorAll(".already-detail-parts-day")].map(
      (el) => el.textContent,
    );
    assert.deepStrictEqual(headings, [
      "Monday, June 15, 2099",
      "Tuesday, June 16, 2099",
    ]);
  });

  it("renders no day heading when every part is on the parent's start day", () => {
    const c = render(night([act(), act({ title: "Second" })]));
    assert.strictEqual(c.querySelector(".already-detail-parts-day"), null);
  });

  it("heads a lone part with its day when that is not the parent's start day", () => {
    const c = render(
      night(
        [
          act({
            title: "Day Two",
            start: "2099-06-16T18:00:00Z",
            end: "2099-06-16T19:00:00Z",
          }),
        ],
        { end: "2099-06-16T21:00:00Z" },
      ),
    );
    const headings = [...c.querySelectorAll(".already-detail-parts-day")];
    assert.deepStrictEqual(
      headings.map((el) => el.textContent),
      ["Tuesday, June 16, 2099"],
    );
    assert.strictEqual(headings[0].getAttribute("role"), "heading");
  });

  it("makes each part's title a level 3 heading when there are no day headings", () => {
    const c = render(night([act(), act({ title: "Second" })]));
    const titles = [...c.querySelectorAll(".already-detail-part-title")];
    assert.strictEqual(titles.length, 2);
    for (const title of titles) {
      assert.strictEqual(title.getAttribute("role"), "heading");
      assert.strictEqual(title.getAttribute("aria-level"), "3");
    }
  });

  it("makes each part's title a level 4 heading under the day headings", () => {
    const c = render(
      night(
        [
          act(),
          act({
            title: "Day Two",
            start: "2099-06-16T18:00:00Z",
            end: "2099-06-16T19:00:00Z",
          }),
        ],
        { end: "2099-06-16T21:00:00Z" },
      ),
    );
    const titles = [...c.querySelectorAll(".already-detail-part-title")];
    assert.strictEqual(titles.length, 2);
    for (const title of titles) {
      assert.strictEqual(title.getAttribute("role"), "heading");
      assert.strictEqual(title.getAttribute("aria-level"), "4");
    }
    const days = [...c.querySelectorAll(".already-detail-parts-day")];
    assert.strictEqual(days.length, 2);
    for (const day of days) {
      assert.strictEqual(day.getAttribute("aria-level"), "3");
    }
  });

  it("marks the part a link named", () => {
    const c = render(night([act(), act({ title: "Second" })]), config(), {
      focusPartId: "part-2",
    });
    const targets = c.querySelectorAll(".already-detail-part--target");
    assert.strictEqual(targets.length, 1);
    assert.strictEqual(targets[0].dataset.eventId, "part-2");
    // Only the class would give a screen reader no cue which part was named.
    const current = c.querySelectorAll("[aria-current]");
    assert.strictEqual(current.length, 1);
    assert.strictEqual(current[0], targets[0]);
    assert.strictEqual(current[0].getAttribute("aria-current"), "true");
  });

  it("marks no part without an id when the link named the parent", () => {
    const c = render(night([act({ id: undefined })]));
    assert.strictEqual(c.querySelector(".already-detail-part--target"), null);
    assert.strictEqual(items(c)[0].hasAttribute("data-event-id"), false);
  });

  it("marks no part when the link names an unknown part", () => {
    const c = render(night([act({ id: undefined })]), config(), {
      focusPartId: "nope",
    });
    assert.strictEqual(c.querySelector(".already-detail-part--target"), null);
  });

  it("marks no part when called without options", () => {
    const c = document.createElement("div");
    document.body.appendChild(c);
    renderDetailView(
      c,
      night([act(), act({ title: "Second" })]),
      "UTC",
      () => {},
      config(),
    );
    assert.strictEqual(items(c).length, 2);
    assert.strictEqual(c.querySelector(".already-detail-part--target"), null);
  });

  it("does not treat a host's own parts field as a composite", () => {
    const c = render(
      createTestEvent({ id: "host", parts: [{ id: "tier", title: "VIP" }] }),
    );
    assert.strictEqual(c.querySelector(".already-detail-parts"), null);
  });
});
