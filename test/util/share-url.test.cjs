const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let buildShareUrl;
before(async () => {
  ({ buildShareUrl } = await import("../../src/util/share-url.js"));
});

describe("buildShareUrl", () => {
  it("event target → path form with encoded id", () => {
    assert.strictEqual(
      buildShareUrl("https://ex.com/cal", {
        kind: "event",
        eventId: "abc 123",
      }),
      "https://ex.com/cal/event/abc%20123",
    );
  });

  it("calendar target → hash form per view", () => {
    assert.strictEqual(
      buildShareUrl("https://ex.com/cal", { kind: "calendar", view: "month" }),
      "https://ex.com/cal#month",
    );
  });

  it("normalizes trailing slash + drops existing query/hash", () => {
    assert.strictEqual(
      buildShareUrl("https://ex.com/cal/?x=1#old", {
        kind: "calendar",
        view: "week",
      }),
      "https://ex.com/cal#week",
    );
  });

  it("calendar with no view → bare normalized base (defensive)", () => {
    assert.strictEqual(
      buildShareUrl("https://ex.com/cal", { kind: "calendar" }),
      "https://ex.com/cal",
    );
  });

  it("ignores target.date today (forward-compat contract)", () => {
    assert.strictEqual(
      buildShareUrl("https://ex.com/cal", {
        kind: "calendar",
        view: "month",
        date: "2026-08",
      }),
      "https://ex.com/cal#month",
    );
  });

  it("root path base normalizes cleanly", () => {
    assert.strictEqual(
      buildShareUrl("https://ex.com/", { kind: "event", eventId: "e1" }),
      "https://ex.com/event/e1",
    );
  });

  // Regression: when the base is itself an event deep-link (the canonical page
  // URL a host emits, or the window.location fallback, while viewing an event),
  // the trailing `/event/<id>` must collapse to the view root before the suffix
  // is appended — otherwise the share button doubles it into
  // `…/event/<id>/event/<id>`, which the router can't resolve.
  it("event target whose base is already a deep-link → no doubled /event/", () => {
    assert.strictEqual(
      buildShareUrl("https://ex.com/cal/event/abc", {
        kind: "event",
        eventId: "abc",
      }),
      "https://ex.com/cal/event/abc",
    );
  });

  it("deep-link base re-targets a different event cleanly", () => {
    assert.strictEqual(
      buildShareUrl("https://ex.com/cal/event/abc", {
        kind: "event",
        eventId: "xyz",
      }),
      "https://ex.com/cal/event/xyz",
    );
  });

  it("calendar target from a deep-link base → view root (no stale /event/)", () => {
    assert.strictEqual(
      buildShareUrl("https://ex.com/cal/event/abc", {
        kind: "calendar",
        view: "month",
      }),
      "https://ex.com/cal#month",
    );
  });

  it("deep-link base with trailing slash also collapses", () => {
    assert.strictEqual(
      buildShareUrl("https://ex.com/cal/event/abc/", {
        kind: "event",
        eventId: "abc",
      }),
      "https://ex.com/cal/event/abc",
    );
  });

  it("deep-link base with a percent-encoded id still collapses", () => {
    assert.strictEqual(
      buildShareUrl("https://ex.com/cal/event/abc%20123", {
        kind: "event",
        eventId: "abc 123",
      }),
      "https://ex.com/cal/event/abc%20123",
    );
  });

  it("deep-link base carrying query/hash collapses (query + hash dropped)", () => {
    assert.strictEqual(
      buildShareUrl("https://ex.com/cal/event/abc?utm=x#frag", {
        kind: "event",
        eventId: "abc",
      }),
      "https://ex.com/cal/event/abc",
    );
  });
});
