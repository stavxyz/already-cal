const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let rsvpViaFetch;
before(async () => {
  ({ rsvpViaFetch } = await import("../../src/util/rsvp-transport.js"));
});

const event = { id: "evt_1" };
const fields = {
  name: "Larry",
  email: "larry@example.com",
  partySize: 2,
  website: "",
};

function fakeFetch(status, body, { reject = false } = {}) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    if (reject) throw new Error("offline");
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => {
        if (body === undefined) throw new Error("no json");
        return body;
      },
    };
  };
  fn.calls = calls;
  return fn;
}

describe("rsvpViaFetch", () => {
  it("posts eventId plus the fields as JSON and resolves with the body", async () => {
    const f = fakeFetch(200, { ok: true, partySize: 2 });
    const result = await rsvpViaFetch("/v/x/_rsvp", f)(event, fields);
    assert.deepStrictEqual(result, { ok: true, partySize: 2 });
    assert.strictEqual(f.calls[0].url, "/v/x/_rsvp");
    assert.strictEqual(f.calls[0].init.method, "POST");
    assert.strictEqual(
      f.calls[0].init.headers["Content-Type"],
      "application/json",
    );
    assert.deepStrictEqual(JSON.parse(f.calls[0].init.body), {
      eventId: "evt_1",
      ...fields,
    });
  });

  it("rejects with the server's error code and the status on a non-2xx", async () => {
    await assert.rejects(
      rsvpViaFetch("/x", fakeFetch(409, { error: "event_started" }))(
        event,
        fields,
      ),
      (err) => err.code === "event_started" && err.status === 409,
    );
  });

  it("rejects with http_<status> when the error body is not JSON", async () => {
    await assert.rejects(
      rsvpViaFetch("/x", fakeFetch(429))(event, fields),
      (err) => err.code === "http_429" && err.status === 429,
    );
  });

  it("rejects with bad_response on a 2xx without a JSON object", async () => {
    await assert.rejects(
      rsvpViaFetch("/x", fakeFetch(200))(event, fields),
      (err) => err.code === "bad_response",
    );
  });

  it("rejects with network_error when fetch throws", async () => {
    await assert.rejects(
      rsvpViaFetch("/x", fakeFetch(0, undefined, { reject: true }))(
        event,
        fields,
      ),
      (err) => err.code === "network_error",
    );
  });
});
