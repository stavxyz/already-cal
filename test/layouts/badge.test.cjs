require("../setup-dom.cjs");
const { describe, it, before } = require("node:test");
const assert = require("node:assert");
const { createTestEvent } = require("../helpers.cjs");

let render;

before(async () => {
  const mod = await import("../../src/layouts/badge/badge.js");
  render = mod.render;
});

const baseOptions = {
  orientation: "vertical",
  imagePosition: "left",
  index: 0,
  timezone: "UTC",
  locale: "en-US",
  config: {},
};

describe("badge layout", () => {
  it("returns a .already-card--badge element", () => {
    const el = render(createTestEvent(), baseOptions);
    assert.ok(el.classList.contains("already-card--badge"));
  });

  it("includes date badge overlay on image", () => {
    const el = render(
      createTestEvent({ image: "https://example.com/img.jpg" }),
      baseOptions,
    );
    const badge = el.querySelector(".already-card__badge");
    assert.ok(badge);
    assert.ok(el.querySelector(".already-card__badge-day"));
    assert.ok(el.querySelector(".already-card__badge-month"));
  });

  it("includes date badge even without image", () => {
    const el = render(createTestEvent({ image: null }), baseOptions);
    assert.ok(el.querySelector(".already-card__badge"));
  });

  it("(regression already.events#217) badge survives broken image — moved inline into body so it doesn't get hidden with the image wrapper", () => {
    // Repro: any event with an image URL that 404s / blocks (e.g. a
    // Google Drive shared-link image where the owner didn't enable
    // "anyone with the link can view") triggers img.onerror, which
    // previously did `wrapper.style.display = "none"` and hid the
    // badge as collateral damage — the badge layout appends its date
    // badge INSIDE the image wrapper for overlay positioning.
    //
    // The fix in src/layouts/helpers.js rescues the badge from
    // inside the wrapper BEFORE hiding it: moves it to the card's
    // body with the --inline modifier, so it renders as a sibling
    // of the title (same shape as the no-image code path).
    const el = render(
      createTestEvent({ image: "https://example.com/not-a-real-image.jpg" }),
      baseOptions,
    );
    // Pre-error state: badge is inside the image wrapper.
    const wrapper = el.querySelector(".already-card__image");
    assert.ok(wrapper, "image wrapper should exist");
    assert.ok(
      wrapper.querySelector(".already-card__badge"),
      "badge should start inside the image wrapper (overlay positioning)",
    );

    // Trigger the failure path that real Google Drive 404s hit.
    const img = wrapper.querySelector("img");
    img.onerror();

    // Post-error state:
    //   - badge has been rescued OUT of the wrapper and into the body
    //   - badge has the --inline modifier so it renders correctly
    //   - wrapper is hidden (display: none) so no broken-image icon
    const body = el.querySelector(".already-card__body");
    const rescuedBadge = body.querySelector(".already-card__badge");
    assert.ok(rescuedBadge, "badge should be moved into the body");
    assert.ok(
      rescuedBadge.classList.contains("already-card__badge--inline"),
      "rescued badge should have the --inline modifier",
    );
    assert.strictEqual(
      wrapper.querySelector(".already-card__badge"),
      null,
      "badge should NOT remain inside the hidden wrapper",
    );
    assert.strictEqual(
      wrapper.style.display,
      "none",
      "image wrapper should be hidden",
    );
  });

  it("includes full date and time", () => {
    const el = render(createTestEvent(), baseOptions);
    assert.ok(el.querySelector(".already-card__meta"));
  });

  it("includes location with icon prefix", () => {
    const el = render(createTestEvent({ location: "The Venue" }), baseOptions);
    const loc = el.querySelector(".already-card__location");
    assert.ok(loc);
    assert.ok(loc.textContent.includes("The Venue"));
  });

  it("includes description preview", () => {
    const el = render(
      createTestEvent({ description: "A great event" }),
      baseOptions,
    );
    assert.ok(el.querySelector(".already-card__description"));
  });

  // The `renders ...description...` cases below pin the contract that
  // badge layouts route through renderDescription. The same suite lives in
  // test/layouts/hero.test.cjs — keep them in sync. If a new layout adopts
  // the renderDescription pattern, lift this into a shared helper.

  it("renders plain-text description as escaped HTML round-trip", () => {
    const el = render(
      createTestEvent({ description: "A simple description" }),
      baseOptions,
    );
    const descEl = el.querySelector(".already-card__description");
    assert.ok(descEl, "missing .already-card__description");
    assert.strictEqual(descEl.innerHTML, "A simple description");
    assert.strictEqual(descEl.textContent, "A simple description");
  });

  it("renders HTML description as sanitized HTML", () => {
    const el = render(
      createTestEvent({
        description:
          '<strong>Bold</strong> and <a href="https://example.com">link</a>',
      }),
      baseOptions,
    );
    const descEl = el.querySelector(".already-card__description");
    assert.ok(descEl, "missing .already-card__description");
    assert.ok(
      descEl.innerHTML.includes("<strong>Bold</strong>"),
      `expected sanitized <strong>, got: ${descEl.innerHTML}`,
    );
    assert.strictEqual(
      descEl.querySelector("a")?.getAttribute("href"),
      "https://example.com",
    );
  });

  it("renders Markdown description through marked parser", () => {
    const el = render(
      createTestEvent({ description: "**Bold** text" }),
      baseOptions,
    );
    const descEl = el.querySelector(".already-card__description");
    assert.ok(descEl, "missing .already-card__description");
    assert.ok(
      descEl.innerHTML.includes("<strong>Bold</strong>"),
      `expected markdown-parsed <strong>, got: ${descEl.innerHTML}`,
    );
  });

  it("strips disallowed tags like <script>", () => {
    const el = render(
      createTestEvent({ description: "<script>alert(1)</script>safe" }),
      baseOptions,
    );
    const descEl = el.querySelector(".already-card__description");
    assert.ok(descEl, "missing .already-card__description");
    assert.ok(
      !descEl.innerHTML.includes("<script"),
      `<script> tag should be stripped, got: ${descEl.innerHTML}`,
    );
    assert.strictEqual(
      descEl.querySelector("script"),
      null,
      "no <script> element should remain in the DOM",
    );
    assert.ok(
      descEl.innerHTML.includes("safe"),
      `safe content should remain, got: ${descEl.innerHTML}`,
    );
    assert.ok(
      !descEl.textContent.includes("alert(1)"),
      "script body should not leak as text",
    );
  });

  it("omits description block when whitespace-only", () => {
    const el = render(createTestEvent({ description: "   \n  " }), baseOptions);
    assert.strictEqual(el.querySelector(".already-card__description"), null);
  });

  it("renders tag pills when tags are present", () => {
    const el = render(
      createTestEvent({ tags: ["Outdoor", "Family"] }),
      baseOptions,
    );
    const tags = el.querySelectorAll(".already-card__tag");
    assert.strictEqual(tags.length, 2);
    assert.strictEqual(tags[0].textContent, "Outdoor");
    assert.strictEqual(tags[1].textContent, "Family");
  });

  it("omits tag container when no tags", () => {
    const el = render(createTestEvent({ tags: [] }), baseOptions);
    assert.strictEqual(el.querySelector(".already-card__tags"), null);
  });

  it("renders action footer with RSVP link when htmlLink present", () => {
    const el = render(
      createTestEvent({ htmlLink: "https://calendar.google.com/event/abc" }),
      baseOptions,
    );
    const actions = el.querySelectorAll(".already-card__action");
    assert.ok(actions.length > 0);
  });

  it("omits action footer when no htmlLink", () => {
    const el = render(createTestEvent({ htmlLink: "" }), baseOptions);
    assert.strictEqual(el.querySelector(".already-card__footer"), null);
  });

  it("shows only date (no middot or time) for allDay events", () => {
    const el = render(
      createTestEvent({ start: "2026-04-15T00:00:00Z", allDay: true }),
      baseOptions,
    );
    const meta = el.querySelector(".already-card__meta");
    assert.ok(meta);
    assert.ok(
      !meta.textContent.includes("\u00b7"),
      "allDay should not contain middot",
    );
  });

  it("includes end time range when end is present", () => {
    const el = render(
      createTestEvent({
        start: "2026-04-15T14:00:00Z",
        end: "2026-04-15T16:00:00Z",
        allDay: false,
      }),
      baseOptions,
    );
    const meta = el.querySelector(".already-card__meta");
    assert.ok(meta);
    assert.ok(
      meta.textContent.includes("\u2013"),
      "should contain en-dash for time range",
    );
  });

  it("applies horizontal orientation class", () => {
    const el = render(createTestEvent(), {
      ...baseOptions,
      orientation: "horizontal",
    });
    assert.ok(el.classList.contains("already-card--horizontal"));
  });
});
