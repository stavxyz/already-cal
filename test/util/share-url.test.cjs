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
});
