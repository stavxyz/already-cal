const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let extractDirectives;
let enrichEvent;
let enrichGoogleEvent;

before(async () => {
  ({ extractDirectives } = await import("../src/util/directives.js"));
  ({ enrichEvent, enrichGoogleEvent } = await import("../src/data.js"));
});

describe("extractDirectives rsvp flag", () => {
  it("sets rsvp for a bare #already:rsvp and strips it", () => {
    const result = extractDirectives("Doors at 7 #already:rsvp");
    assert.strictEqual(result.rsvp, true);
    assert.strictEqual(result.featured, false);
    assert.deepStrictEqual(result.tokens, []);
    assert.ok(!result.description.includes("#already"));
    assert.ok(result.description.includes("Doors at 7"));
  });

  it("is case-insensitive", () => {
    assert.strictEqual(extractDirectives("#ALREADY:RSVP").rsvp, true);
  });

  it("leaves #already:rsvp:<url> as a link tag, not a flag", () => {
    const result = extractDirectives(
      "#already:rsvp:https://forms.example.com/x",
    );
    assert.strictEqual(result.rsvp, false);
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].type, "tag");
    assert.strictEqual(result.tokens[0].metadata.key, "rsvp");
  });

  it("does not match a longer keyword", () => {
    assert.strictEqual(extractDirectives("#already:rsvpx").rsvp, false);
  });

  it("returns rsvp false for an empty description", () => {
    assert.strictEqual(extractDirectives("").rsvp, false);
  });
});

describe("enrichEvent rsvp", () => {
  it("carries the flag onto the event", () => {
    const e = enrichEvent(
      { id: "1", title: "T", description: "#already:rsvp" },
      {},
    );
    assert.strictEqual(e.rsvp, true);
  });
  it("defaults to false", () => {
    assert.strictEqual(
      enrichEvent({ id: "1", title: "T", description: "" }, {}).rsvp,
      false,
    );
  });
  it("reaches the server-side entry point", () => {
    const e = enrichGoogleEvent(
      {
        id: "1",
        summary: "T",
        description: "see you #already:rsvp",
        start: { date: "2099-01-01" },
      },
      {},
    );
    assert.strictEqual(e.rsvp, true);
  });
});
