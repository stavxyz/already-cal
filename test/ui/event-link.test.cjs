require("../setup-dom.cjs");
const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let linkTitle, eventAnchor;
before(async () => {
  ({ linkTitle, eventAnchor } = await import("../../src/ui/event-link.js"));
});

const LINK_HOST_CLASS = "already-link-host";

const opts = {
  titleSelector: ".card__title",
  linkClass: "card__link",
  fallbackText: "Open event",
};

function hostWithTitle(titleHtml) {
  const host = document.createElement("div");
  host.className = "card";
  host.innerHTML = `<div class="card__title">${titleHtml}</div><div class="card__meta">10:00</div>`;
  return host;
}

describe("linkTitle", () => {
  it("moves the title's text into a link appended to the title element", () => {
    const host = hostWithTitle("Burger Night");
    const link = linkTitle(host, "#event/e1", opts);
    const title = host.querySelector(".card__title");
    assert.strictEqual(title.childNodes.length, 1);
    assert.strictEqual(title.firstChild, link);
    assert.strictEqual(link.tagName, "A");
    assert.strictEqual(link.getAttribute("href"), "#event/e1");
    assert.strictEqual(link.textContent, "Burger Night");
    assert.strictEqual(title.textContent, "Burger Night");
  });

  it("gives the link both classes and marks the host", () => {
    const host = hostWithTitle("Burger Night");
    const link = linkTitle(host, "#event/e1", opts);
    assert.ok(link.classList.contains("already-event-link"));
    assert.ok(link.classList.contains("card__link"));
    assert.ok(host.classList.contains(LINK_HOST_CLASS));
  });

  it("moves every child node of the title, in order", () => {
    const host = hostWithTitle(
      '<span class="icon">*</span> Burger <em>Night</em>',
    );
    const link = linkTitle(host, "#event/e1", opts);
    assert.strictEqual(link.childNodes.length, 3);
    assert.strictEqual(link.querySelector(".icon").textContent, "*");
    assert.strictEqual(link.querySelector("em").textContent, "Night");
    assert.strictEqual(link.textContent, "* Burger Night");
  });

  it("appends a hidden link with the fallback text when there is no title", () => {
    const host = document.createElement("div");
    host.innerHTML = '<div class="card__meta">10:00</div>';
    const link = linkTitle(host, "#event/e1", opts);
    assert.strictEqual(host.lastChild, link);
    assert.strictEqual(link.getAttribute("href"), "#event/e1");
    const hidden = link.querySelector("span.already-sr-only");
    assert.ok(hidden);
    assert.strictEqual(hidden.textContent, "Open event");
    assert.strictEqual(link.textContent, "Open event");
    assert.ok(host.classList.contains(LINK_HOST_CLASS));
  });

  it("leaves a title that is already a link alone, with the hidden link beside it", () => {
    const host = document.createElement("div");
    host.innerHTML =
      '<a class="card__title" href="https://x.example/">Burger Night</a>';
    const link = linkTitle(host, "#event/e1", opts);
    const own = host.querySelector("a.card__title");
    assert.strictEqual(own.getAttribute("href"), "https://x.example/");
    assert.strictEqual(own.querySelector("a"), null);
    assert.strictEqual(host.lastChild, link);
    assert.ok(link.querySelector(".already-sr-only"));
  });

  it("leaves a title that contains a button alone, with the hidden link beside it", () => {
    const host = hostWithTitle(
      'Burger Night <button type="button">Pin</button>',
    );
    const link = linkTitle(host, "#event/e1", opts);
    const title = host.querySelector(".card__title");
    assert.strictEqual(title.querySelector("a"), null);
    assert.ok(title.querySelector("button"));
    assert.strictEqual(host.lastChild, link);
  });

  it("does nothing for an entry with no route", () => {
    const host = hostWithTitle("Burger Night");
    const before = host.innerHTML;
    assert.strictEqual(linkTitle(host, null, opts), null);
    assert.strictEqual(host.innerHTML, before);
    assert.ok(!host.classList.contains(LINK_HOST_CLASS));
  });
});

describe("eventAnchor", () => {
  it("is an anchor with the href when the entry has a route", () => {
    const el = eventAnchor("#event/e1", "chip chip--featured");
    assert.strictEqual(el.tagName, "A");
    assert.strictEqual(el.getAttribute("href"), "#event/e1");
    assert.strictEqual(el.className, "chip chip--featured");
  });

  it("is a plain div when the entry has no route", () => {
    const el = eventAnchor(null, "chip");
    assert.strictEqual(el.tagName, "DIV");
    assert.strictEqual(el.hasAttribute("href"), false);
    assert.strictEqual(el.className, "chip");
  });
});
