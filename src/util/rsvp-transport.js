/**
 * Build an `onRsvp` function that posts the form's fields as JSON to `url`.
 * Generic on purpose: it knows the widget's field object and nothing else,
 * so a host supplies only a URL and the fetch, status and body handling
 * stay in tested code instead of an inline script.
 *
 * Rejections carry `code` (the server's `error` string when it sent one,
 * else `http_<status>`, `bad_response` or `network_error`) and `status`.
 */
export function rsvpViaFetch(url, fetchImpl = globalThis.fetch) {
  return async function onRsvp(event, fields) {
    let res;
    try {
      res = await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id, ...fields }),
      });
    } catch (cause) {
      throw rsvpError("network_error", 0, cause);
    }
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (!res.ok) {
      const code =
        body && typeof body.error === "string"
          ? body.error
          : `http_${res.status}`;
      throw rsvpError(code, res.status);
    }
    if (!body || typeof body !== "object")
      throw rsvpError("bad_response", res.status);
    return body;
  };
}

function rsvpError(code, status, cause) {
  const err = new Error(`rsvp: ${code}`);
  err.code = code;
  err.status = status;
  if (cause) err.cause = cause;
  return err;
}
