// Build the per-app "subscribe / add to calendar" targets for a calendar feed.
// Pure (no DOM). Given the feed URL the widget receives (a webcal:// or https
// ICS feed, or a configured override), return the targets each calendar
// ecosystem understands — or null when the URL isn't a webcal/https feed.

const GCAL_ICAL_RE =
  /^https?:\/\/calendar\.google\.com\/calendar\/ical\/([^/]+)\/public\/basic\.ics/i;

// Google-calendar-id -> the base64, no-padding `cid` value used by the
// "add this Google calendar" deep link. One definition of the rule; header.js
// consumes this too, so the encoding lives in exactly one place.
export function googleCalIdToCid(calendarId) {
  return btoa(calendarId).replace(/=+$/, "");
}

function swapScheme(url, scheme) {
  return url.replace(/^[a-z]+:/i, scheme);
}

export function buildSubscribeTargets(subscribeUrl) {
  if (typeof subscribeUrl !== "string" || subscribeUrl === "") return null;
  let scheme;
  try {
    scheme = new URL(subscribeUrl).protocol; // "webcal:" | "https:" | ...
  } catch {
    return null;
  }
  if (scheme !== "webcal:" && scheme !== "https:") return null;

  const webcalUrl = swapScheme(subscribeUrl, "webcal:");
  const httpsUrl = swapScheme(subscribeUrl, "https:");

  // Native Google form when the feed is a public Google calendar ICS URL;
  // otherwise subscribe Google to the external feed (cid carries webcal://).
  const m = httpsUrl.match(GCAL_ICAL_RE);
  let googleCid;
  if (m) {
    try {
      googleCid = googleCalIdToCid(decodeURIComponent(m[1]));
    } catch {
      // malformed percent-encoding in the calendar id — fall back to the feed-form cid
      googleCid = encodeURIComponent(webcalUrl);
    }
  } else {
    googleCid = encodeURIComponent(webcalUrl);
  }

  return [
    { id: "apple", kind: "link", url: webcalUrl },
    {
      id: "google",
      kind: "link",
      url: `https://calendar.google.com/calendar/r?cid=${googleCid}`,
    },
    {
      id: "outlook",
      kind: "link",
      url:
        "https://outlook.office.com/calendar/0/addfromweb?url=" +
        encodeURIComponent(webcalUrl),
    },
    { id: "copy", kind: "copy", url: httpsUrl },
  ];
}
