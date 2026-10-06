require("../setup-dom.cjs");
const { describe, it, before, afterEach } = require("node:test");
const assert = require("node:assert");
const { createTestEvent } = require("../helpers.cjs");

let offersRsvp;
let appendRsvpControl;
let decorateRsvp;
before(async () => {
  ({ offersRsvp, appendRsvpControl, decorateRsvp } = await import(
    "../../src/ui/rsvp-form.js"
  ));
});
afterEach(() => {
  document.body.innerHTML = "";
});

const NOW = new Date("2050-01-01T00:00:00Z");
const i18n = {
  rsvp: "RSVP",
  rsvpName: "Name",
  rsvpEmail: "Email",
  rsvpPartySize: "How many",
  rsvpSubmit: "Send",
  rsvpCancel: "Cancel",
  rsvpDone: "{count} going",
  rsvpInvalid: "Fix it",
  rsvpFailed: "Failed",
};
const cfg = (over = {}) => ({
  onRsvp: async () => ({ partySize: 2 }),
  rsvpAllEvents: false,
  i18n,
  ...over,
});
const flagged = (over = {}) =>
  createTestEvent({ rsvp: true, start: "2099-06-15T10:00:00-05:00", ...over });

function flush() {
  return new Promise((r) => setTimeout(r, 0));
}

describe("offersRsvp", () => {
  it("is false without an onRsvp function", () => {
    assert.strictEqual(
      offersRsvp(flagged(), cfg({ onRsvp: null }), NOW),
      false,
    );
  });
  it("is true for a flagged upcoming event", () => {
    assert.strictEqual(offersRsvp(flagged(), cfg(), NOW), true);
  });
  it("is true for an unflagged event when rsvpAllEvents is on", () => {
    assert.strictEqual(
      offersRsvp(flagged({ rsvp: false }), cfg({ rsvpAllEvents: true }), NOW),
      true,
    );
  });
  it("is false for an unflagged event when the switch is off", () => {
    assert.strictEqual(offersRsvp(flagged({ rsvp: false }), cfg(), NOW), false);
  });
  it("is false once the event has started, even if it has not ended", () => {
    const e = flagged({
      start: "2049-12-31T23:00:00Z",
      end: "2050-01-01T02:00:00Z",
    });
    assert.strictEqual(offersRsvp(e, cfg(), NOW), false);
  });
  it("handles all-day events by date", () => {
    assert.strictEqual(
      offersRsvp(
        flagged({ start: "2050-01-02", end: "2050-01-03", allDay: true }),
        cfg(),
        NOW,
      ),
      true,
    );
    assert.strictEqual(
      offersRsvp(
        flagged({ start: "2049-12-31", end: "2050-01-01", allDay: true }),
        cfg(),
        NOW,
      ),
      false,
    );
  });
  it("is false without a start", () => {
    assert.strictEqual(offersRsvp(flagged({ start: "" }), cfg(), NOW), false);
  });
});

describe("appendRsvpControl", () => {
  it("appends a button that opens the form in place", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const btn = appendRsvpControl(host, flagged(), cfg());
    assert.strictEqual(btn.textContent, "RSVP");
    assert.ok(btn.classList.contains("already-card__action"));
    btn.click();
    const form = host.querySelector("form.already-rsvp");
    assert.ok(form);
    assert.ok(!host.contains(btn));
    assert.strictEqual(
      form.querySelector('input[name="name"]').getAttribute("maxlength"),
      "80",
    );
    assert.strictEqual(form.querySelector('input[name="email"]').type, "email");
    const size = form.querySelector('input[name="partySize"]');
    assert.strictEqual(size.min, "1");
    assert.strictEqual(size.max, "20");
    assert.strictEqual(size.value, "1");
    const hp = form.querySelector('input[name="website"]');
    assert.strictEqual(hp.getAttribute("autocomplete"), "off");
    assert.strictEqual(hp.getAttribute("tabindex"), "-1");
    assert.strictEqual(hp.getAttribute("aria-hidden"), "true");
  });

  it("cancel and Escape restore the button", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    appendRsvpControl(host, flagged(), cfg()).click();
    host.querySelector(".already-rsvp__cancel").click();
    assert.ok(!host.querySelector("form"));
    assert.ok(host.querySelector(".already-rsvp__open"));
    host.querySelector(".already-rsvp__open").click();
    host
      .querySelector("form")
      .dispatchEvent(
        new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    assert.ok(!host.querySelector("form"));
    assert.ok(host.querySelector(".already-rsvp__open"));
  });

  it("stops click and keydown from reaching the card", () => {
    const card = document.createElement("div");
    let reached = 0;
    card.addEventListener("click", () => reached++);
    card.addEventListener("keydown", () => reached++);
    document.body.appendChild(card);
    appendRsvpControl(card, flagged(), cfg()).click();
    const name = card.querySelector('input[name="name"]');
    name.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: " ", bubbles: true }),
    );
    name.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert.strictEqual(reached, 0);
  });

  it("submits the fields to onRsvp and shows the done line with the returned count", async () => {
    let received = null;
    const host = document.createElement("div");
    document.body.appendChild(host);
    const event = flagged();
    appendRsvpControl(
      host,
      event,
      cfg({
        onRsvp: async (e, fields) => {
          received = { e, fields };
          return { partySize: 3 };
        },
      }),
    ).click();
    const form = host.querySelector("form");
    form.querySelector('input[name="name"]').value = "Larry";
    form.querySelector('input[name="email"]').value = "larry@example.com";
    form.querySelector('input[name="partySize"]').value = "3";
    form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    assert.strictEqual(
      form.querySelector(".already-rsvp__submit").disabled,
      true,
    );
    await flush();
    assert.strictEqual(received.e, event);
    assert.deepStrictEqual(received.fields, {
      name: "Larry",
      email: "larry@example.com",
      partySize: 3,
      website: "",
    });
    assert.ok(!host.querySelector("form"));
    assert.strictEqual(
      host.querySelector(".already-rsvp__done").textContent,
      "3 going",
    );
  });

  it("replaces every {count} placeholder in the done line", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    appendRsvpControl(
      host,
      flagged(),
      cfg({
        i18n: { ...i18n, rsvpDone: "{count} and {count}" },
        onRsvp: async () => ({ partySize: 3 }),
      }),
    ).click();
    const form = host.querySelector("form");
    form.querySelector('input[name="name"]').value = "Larry";
    form.querySelector('input[name="email"]').value = "larry@example.com";
    form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await flush();
    assert.strictEqual(
      host.querySelector(".already-rsvp__done").textContent,
      "3 and 3",
    );
  });

  it("disables cancel while onRsvp is pending and re-enables both on rejection", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    let reject;
    appendRsvpControl(
      host,
      flagged(),
      cfg({
        onRsvp: () =>
          new Promise((_resolve, _reject) => {
            reject = _reject;
          }),
      }),
    ).click();
    const form = host.querySelector("form");
    form.querySelector('input[name="name"]').value = "Larry";
    form.querySelector('input[name="email"]').value = "larry@example.com";
    form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await flush();
    assert.strictEqual(
      form.querySelector(".already-rsvp__cancel").disabled,
      true,
    );
    reject(new Error("rsvp: failed"));
    await flush();
    assert.strictEqual(
      form.querySelector(".already-rsvp__submit").disabled,
      false,
    );
    assert.strictEqual(
      form.querySelector(".already-rsvp__cancel").disabled,
      false,
    );
  });

  it("ignores Escape while onRsvp is pending, then closes on it after rejection", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    let reject;
    appendRsvpControl(
      host,
      flagged(),
      cfg({
        onRsvp: () =>
          new Promise((_resolve, _reject) => {
            reject = _reject;
          }),
      }),
    ).click();
    const form = host.querySelector("form");
    form.querySelector('input[name="name"]').value = "Larry";
    form.querySelector('input[name="email"]').value = "larry@example.com";
    form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await flush();
    form.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    assert.ok(host.querySelector("form"));
    reject(new Error("rsvp: failed"));
    await flush();
    form.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    assert.ok(!host.querySelector("form"));
    assert.ok(host.querySelector(".already-rsvp__open"));
  });

  it("shows the error and keeps the values when onRsvp rejects", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    appendRsvpControl(
      host,
      flagged(),
      cfg({
        onRsvp: async () => {
          throw new Error("rsvp: event_started");
        },
      }),
    ).click();
    const form = host.querySelector("form");
    form.querySelector('input[name="name"]').value = "Larry";
    form.querySelector('input[name="email"]').value = "larry@example.com";
    form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await flush();
    assert.ok(host.querySelector("form"));
    assert.strictEqual(form.querySelector('input[name="name"]').value, "Larry");
    const err = form.querySelector(".already-rsvp__error");
    assert.strictEqual(err.hidden, false);
    assert.strictEqual(err.textContent, "Failed");
    assert.strictEqual(
      form.querySelector(".already-rsvp__submit").disabled,
      false,
    );
  });

  it("falls back to the submitted count when onRsvp resolves without one", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    appendRsvpControl(
      host,
      flagged(),
      cfg({
        onRsvp: async () => ({}),
      }),
    ).click();
    const form = host.querySelector("form");
    form.querySelector('input[name="name"]').value = "Larry";
    form.querySelector('input[name="email"]').value = "larry@example.com";
    form.querySelector('input[name="partySize"]').value = "4";
    form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await flush();
    assert.strictEqual(
      host.querySelector(".already-rsvp__done").textContent,
      "4 going",
    );
  });

  it("shows rsvpStarted when onRsvp rejects with an event_started error", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    appendRsvpControl(
      host,
      flagged(),
      cfg({
        i18n: { ...i18n, rsvpStarted: "Started" },
        onRsvp: async () => {
          const err = new Error("rsvp: event_started");
          err.code = "event_started";
          throw err;
        },
      }),
    ).click();
    const form = host.querySelector("form");
    form.querySelector('input[name="name"]').value = "Larry";
    form.querySelector('input[name="email"]').value = "larry@example.com";
    form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await flush();
    const err = form.querySelector(".already-rsvp__error");
    assert.strictEqual(err.hidden, false);
    assert.strictEqual(err.textContent, "Started");
  });

  it("does not call onRsvp with an empty name or a malformed email, and says what to fix", async () => {
    let calls = 0;
    const host = document.createElement("div");
    document.body.appendChild(host);
    appendRsvpControl(
      host,
      flagged(),
      cfg({
        onRsvp: async () => {
          calls++;
          return { partySize: 1 };
        },
      }),
    ).click();
    const form = host.querySelector("form");
    form.querySelector('input[name="email"]').value = "not-an-email";
    form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await flush();
    assert.strictEqual(calls, 0);
    const err = form.querySelector(".already-rsvp__error");
    assert.strictEqual(err.hidden, false);
    assert.strictEqual(err.textContent, "Fix it");
  });

  it("appends nothing and returns null when the event does not offer RSVP", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    assert.strictEqual(
      appendRsvpControl(host, flagged({ rsvp: false }), cfg()),
      null,
    );
    assert.strictEqual(host.children.length, 0);
  });
});

describe("decorateRsvp", () => {
  function card({ body = true, footer = null } = {}) {
    const el = document.createElement("div");
    el.className = "already-card";
    const inner = body ? document.createElement("div") : el;
    if (body) {
      inner.className = "already-card__body";
      el.appendChild(inner);
    }
    if (footer) {
      const f = document.createElement("div");
      f.className = "already-card__footer";
      f.innerHTML = footer;
      inner.appendChild(f);
    }
    return el;
  }
  it("mounts beside an existing action in the footer and marks it", () => {
    const el = card({
      footer: '<a class="already-card__action" href="#">Details</a>',
    });
    decorateRsvp(el, flagged(), cfg());
    const footers = el.querySelectorAll(".already-card__footer");
    assert.strictEqual(footers.length, 1);
    assert.ok(footers[0].classList.contains("already-card__footer--rsvp"));
    assert.ok(footers[0].querySelector(".already-rsvp__open"));
  });
  it("leaves a footer with no action alone and adds its own row to the body", () => {
    const el = card({ footer: "<span>Somewhere</span>" });
    decorateRsvp(el, flagged(), cfg());
    const row = el.querySelector(".already-card__body > .already-card__rsvp");
    assert.ok(row.classList.contains("already-card__footer"));
    assert.ok(row.classList.contains("already-card__footer--rsvp"));
    assert.ok(row.querySelector(".already-rsvp__open"));
    assert.strictEqual(el.querySelectorAll(".already-rsvp__open").length, 1);
  });
  it("adds the row to the card itself when there is no body", () => {
    const el = card({ body: false });
    decorateRsvp(el, flagged(), cfg());
    assert.ok(
      el.querySelector(":scope > .already-card__rsvp .already-rsvp__open"),
    );
  });
  it("adds nothing when the event does not offer RSVP", () => {
    const el = card({
      footer: '<a class="already-card__action" href="#">Details</a>',
    });
    decorateRsvp(el, flagged({ rsvp: false }), cfg());
    assert.strictEqual(el.querySelector(".already-rsvp__open"), null);
    assert.strictEqual(el.querySelector(".already-card__rsvp"), null);
    assert.strictEqual(el.querySelector(".already-card__footer--rsvp"), null);
  });
});

describe("RSVP rejection messages", () => {
  const messages = {
    ...i18n,
    rsvpStarted: "Started",
    rsvpInvalid: "Fix it",
    rsvpClosed: "Closed",
    rsvpFailed: "Failed",
  };
  async function rejectWith(err, over = {}) {
    const host = document.createElement("div");
    document.body.appendChild(host);
    appendRsvpControl(
      host,
      flagged(),
      cfg({
        i18n: messages,
        onRsvp: async () => {
          throw err;
        },
        ...over,
      }),
    ).click();
    const form = host.querySelector("form");
    form.querySelector('input[name="name"]').value = "Larry";
    form.querySelector('input[name="email"]').value = "larry@example.com";
    form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await flush();
    return form.querySelector(".already-rsvp__error").textContent;
  }
  const coded = (code) => Object.assign(new Error(`rsvp: ${code}`), { code });

  for (const [code, expected] of [
    ["event_started", "Started"],
    ["invalid_field", "Fix it"],
    ["rsvp_unavailable", "Closed"],
    ["event_not_found", "Closed"],
    ["http_500", "Failed"],
  ]) {
    it(`${code} shows ${expected}`, async () => {
      assert.strictEqual(await rejectWith(coded(code)), expected);
    });
  }

  it("a rejection without a code shows the generic message", async () => {
    assert.strictEqual(await rejectWith(new Error("boom")), "Failed");
  });

  it("uses the default closed text when i18n omits rsvpClosed", async () => {
    const { rsvpClosed: _omit, ...rest } = messages;
    assert.strictEqual(
      await rejectWith(coded("rsvp_unavailable"), { i18n: rest }),
      "This event is not taking RSVPs.",
    );
  });
});
