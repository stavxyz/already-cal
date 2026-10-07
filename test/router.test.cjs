require("./setup-dom.cjs");
const { describe, it, before, after, afterEach } = require("node:test");
const assert = require("node:assert");

let eventHref, parseHash, onHashChange;
before(async () => {
  ({ eventHref, parseHash, onHashChange } = await import("../src/router.js"));
});
afterEach(() => {
  // replaceState, not `location.hash = ""`: the latter leaves a trailing `#`
  // and queues a hashchange task that would reach a later async test.
  window.history.replaceState({}, "", window.location.pathname);
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

  it("treats an empty id as missing", () => {
    assert.strictEqual(eventHref({ id: "", parentId: "p1" }), "#event/p1");
    assert.strictEqual(eventHref({ id: "" }), null);
  });

  it("is a relative fragment when the page has no base element", () => {
    // The browser resolves it against the page's current URL each time, so
    // it cannot go stale when a host changes the path or the query.
    assert.strictEqual(document.querySelector("base"), null);
    assert.strictEqual(eventHref({ id: "abc" }), "#event/abc");
  });

  it("is the page's absolute URL when the document has a base element", () => {
    // A relative `#event/x` would resolve against <base href>, sending a
    // middle click or a new tab to the wrong page.
    const base = document.createElement("base");
    base.setAttribute("href", "/elsewhere/");
    document.head.appendChild(base);
    try {
      assert.strictEqual(
        eventHref({ id: "abc" }),
        "http://localhost/#event/abc",
      );
    } finally {
      base.remove();
    }
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
    window.location.hash = new URL(
      eventHref({ id }),
      window.location.href,
    ).hash;
    assert.deepStrictEqual(parseHash(), { view: "detail", eventId: id });
  });
});

describe("parseHash on a page whose path is an event deep link", () => {
  // A host with server-side routing serves the calendar page at
  // /event/<id> too, and share links use that form. Every route the widget
  // writes afterwards is a hash; the path never changes.
  before(() => {
    window.history.replaceState({}, "", "/cal/event/abc");
  });
  after(() => {
    window.history.replaceState({}, "", "/");
  });

  it("opens the path's event when the hash names no route", () => {
    window.location.hash = "";
    assert.deepStrictEqual(parseHash(), { view: "detail", eventId: "abc" });
    window.location.hash = "#nonsense";
    assert.deepStrictEqual(parseHash(), { view: "detail", eventId: "abc" });
  });

  it("lets a view in the hash win over the path, so Back leaves the event", () => {
    window.location.hash = "#grid";
    assert.deepStrictEqual(parseHash(), { view: "grid" });
    window.location.hash = "#day/2026-04-04";
    assert.deepStrictEqual(parseHash(), { view: "day", date: "2026-04-04" });
  });

  it("lets another event in the hash win over the path", () => {
    window.location.hash = "#event/xyz";
    assert.deepStrictEqual(parseHash(), { view: "detail", eventId: "xyz" });
  });

  it("treats an empty day in the hash as no route", () => {
    window.location.hash = "#day/";
    assert.deepStrictEqual(parseHash(), { view: "detail", eventId: "abc" });
  });

  it("treats an empty event id in the hash as no route", () => {
    window.location.hash = "#event/";
    assert.deepStrictEqual(parseHash(), { view: "detail", eventId: "abc" });
  });

  it("ignores a hash that names no route, including the empty one a host link makes", async () => {
    // A hash the widget does not know (#main, a skip link) names no route,
    // and so does the bare `#` an <a href="#"> leaves behind; neither may
    // pull the visitor back into the path's event they just left.
    const tick = () => new Promise((r) => setTimeout(r, 10));
    // jsdom queues one hashchange task per assignment the synchronous tests
    // before this one made; let that backlog pass before listening.
    await tick();
    const seen = [];
    const off = onHashChange((state) => seen.push(state));
    try {
      window.location.hash = "#grid";
      await tick();
      window.location.hash = "#main";
      await tick();
      const top = document.createElement("a");
      top.href = "#";
      document.body.appendChild(top);
      top.click();
      await tick();
      assert.strictEqual(
        window.location.href,
        "http://localhost/cal/event/abc#",
      );
      assert.deepStrictEqual(seen, [{ view: "grid" }]);
      top.remove();
    } finally {
      off();
    }
  });

  it("reopens the path's event when the browser's Back returns to the arrival entry", async () => {
    const tick = () => new Promise((r) => setTimeout(r, 10));
    // jsdom queues one hashchange task per assignment the synchronous tests
    // before this one made; let that backlog pass before listening.
    await tick();
    const seen = [];
    const off = onHashChange((state) => seen.push(state));
    try {
      window.location.hash = "#grid";
      await tick();
      window.history.back();
      await tick();
      assert.strictEqual(
        window.location.href,
        "http://localhost/cal/event/abc",
      );
      assert.deepStrictEqual(seen, [
        { view: "grid" },
        { view: "detail", eventId: "abc" },
      ]);
    } finally {
      off();
    }
  });

  it("reads the arrival entry like the first load even when it carries an unknown hash", async () => {
    // A shared link can carry a fragment the widget does not know
    // (/event/abc#main). Back to it must give what arriving there gave.
    const tick = () => new Promise((r) => setTimeout(r, 10));
    // jsdom queues one hashchange task per assignment the synchronous tests
    // before this one made; let that backlog pass before listening.
    await tick();
    window.history.replaceState({}, "", "/cal/event/abc#main");
    const seen = [];
    const off = onHashChange((state) => seen.push(state));
    try {
      window.location.hash = "#grid";
      await tick();
      window.history.back();
      await tick();
      assert.strictEqual(window.location.hash, "#main");
      assert.deepStrictEqual(seen, [
        { view: "grid" },
        { view: "detail", eventId: "abc" },
      ]);
    } finally {
      off();
    }
  });
});

describe("parseHash with an empty event id and no event path", () => {
  it("names no route", () => {
    window.location.hash = "#event/";
    assert.strictEqual(parseHash(), null);
  });
});
