require("./setup-dom.cjs");
const { describe, it, before, afterEach } = require("node:test");
const assert = require("node:assert");

let eventHref, parseHash;
before(async () => {
  ({ eventHref, parseHash } = await import("../src/router.js"));
});
afterEach(() => {
  window.location.hash = "";
});

describe("eventHref", () => {
  it("links an entry by its id", () => {
    assert.strictEqual(eventHref({ id: "abc" }), "#event/abc");
  });

  it("links a part with no id of its own to its parent", () => {
    assert.strictEqual(eventHref({ parentId: "p1" }), "#event/p1");
    assert.strictEqual(
      eventHref({ id: undefined, parentId: "p1" }),
      "#event/p1",
    );
  });

  it("prefers the entry's own id over its parent's", () => {
    assert.strictEqual(eventHref({ id: "a", parentId: "p" }), "#event/a");
  });

  it("returns null for an entry with neither id nor parent id", () => {
    assert.strictEqual(eventHref({}), null);
    assert.strictEqual(eventHref({ id: null }), null);
    assert.strictEqual(eventHref(null), null);
  });

  it("writes the id as parseHash reads it, reserved characters included", () => {
    // Characters a Google event id or a host's id can carry, none of which
    // the URL fragment encodes.
    const id = "evt/2026?x=1&y=2:z@w";
    window.location.hash = eventHref({ id });
    assert.deepStrictEqual(parseHash(), { view: "detail", eventId: id });
  });
});
