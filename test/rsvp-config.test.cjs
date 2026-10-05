require("./setup-dom.cjs");
const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let Already;
before(async () => {
  Already = await import("../src/already-cal.js");
});

describe("rsvp config defaults", () => {
  it("declares rsvpAllEvents false and onRsvp null", () => {
    assert.strictEqual(Already.DEFAULTS.rsvpAllEvents, false);
    assert.strictEqual(Already.DEFAULTS.onRsvp, null);
  });
});
