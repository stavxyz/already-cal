import { decodeAmp } from "./html-entities.js";
import { imageCanonicalId, normalizeImageUrl } from "./images.js";
import { cleanupHtml, stripMatches } from "./sanitize.js";

// Directive regex: #already: followed by non-whitespace, non-HTML chars.
// Excludes < and > so the match stops before any wrapping </a> tag.
const DIRECTIVE_PATTERN = /#already:([^\s<>]+)/gi;

// Google Calendar's editor turns a pasted URL into a link, which puts a `<`
// right where the directive's value starts. Read the href as the value. The
// attribute scan stops at the next `<` or `>`, so a description that never
// closes the tag costs one pass per directive instead of one per character
// (see #79 for this repo's history with super-linear patterns on untrusted
// text). The href is read from the attribute string separately; `(?:^|\s)`
// keeps `data-href` from matching.
const LINKED_VALUE = /(#already:[a-z0-9-]+:)<a\b([^<>]*)>[^<]*<\/a>/gi;
const LINKED_HREF = /(?:^|\s)href\s*=\s*(["'])([^"']*)\1/i;

// Map directive platform names to their labels, canonical prefix, and URL builder.
// The url function constructs a real link from the directive value so that
// directive-sourced tokens can be rendered as clickable buttons.
const DIRECTIVE_PLATFORMS = {
  instagram: {
    label: (v) => `Follow @${v} on Instagram`,
    canonicalPrefix: "instagram",
    url: (v) => `https://instagram.com/${v}`,
  },
  facebook: {
    label: (v) => `${v} on Facebook`,
    canonicalPrefix: "facebook",
    url: (v) => `https://facebook.com/${v}`,
  },
  x: {
    label: (v) => `Follow @${v} on X`,
    canonicalPrefix: "x",
    url: (v) => `https://x.com/${v}`,
  },
  twitter: {
    label: (v) => `Follow @${v} on X`,
    canonicalPrefix: "x",
    url: (v) => `https://x.com/${v}`,
  },
  reddit: {
    label: (v) => `r/${v} on Reddit`,
    canonicalPrefix: "reddit",
    url: (v) => `https://reddit.com/r/${v}`,
  },
  youtube: {
    label: () => "Watch on YouTube",
    canonicalPrefix: "youtube",
    url: (v) => `https://youtube.com/${v}`,
  },
  tiktok: {
    label: (v) => `@${v} on TikTok`,
    canonicalPrefix: "tiktok",
    url: (v) => `https://tiktok.com/@${v}`,
  },
  linkedin: {
    label: () => "View on LinkedIn",
    canonicalPrefix: "linkedin",
    url: (v) => `https://linkedin.com/in/${v}`,
  },
  discord: {
    label: () => "Join Discord",
    canonicalPrefix: "discord",
    url: (v) => `https://discord.gg/${v}`,
  },
  zoom: {
    label: () => "Join Zoom",
    canonicalPrefix: "zoom",
    url: (v) => `https://zoom.us/j/${v}`,
  },
  googlemeet: {
    label: () => "Join Google Meet",
    canonicalPrefix: "googlemeet",
    url: (v) => `https://meet.google.com/${v}`,
  },
  meet: {
    label: () => "Join Google Meet",
    canonicalPrefix: "googlemeet",
    url: (v) => `https://meet.google.com/${v}`,
  },
  eventbrite: {
    label: () => "RSVP on Eventbrite",
    canonicalPrefix: "eventbrite",
    url: (v) => `https://eventbrite.com/e/${v}`,
  },
  luma: {
    label: () => "RSVP on Luma",
    canonicalPrefix: "luma",
    url: (v) => `https://lu.ma/${v}`,
  },
  mobilize: {
    label: () => "RSVP on Mobilize",
    canonicalPrefix: "mobilize",
    url: (v) => `https://mobilize.us/${v}`,
  },
  actionnetwork: {
    label: () => "Take Action",
    canonicalPrefix: "actionnetwork",
    url: (v) => `https://actionnetwork.org/${v}`,
  },
  gofundme: {
    label: () => "Donate on GoFundMe",
    canonicalPrefix: "gofundme",
    url: (v) => `https://gofundme.com/f/${v}`,
  },
  partiful: {
    label: () => "RSVP on Partiful",
    canonicalPrefix: "partiful",
    url: (v) => `https://partiful.com/e/${v}`,
  },
  googleforms: {
    label: () => "Fill Out Form",
    canonicalPrefix: "googleforms",
    url: (v) => `https://docs.google.com/forms/d/e/${v}/viewform`,
  },
  forms: {
    label: () => "Fill Out Form",
    canonicalPrefix: "googleforms",
    url: (v) => `https://docs.google.com/forms/d/e/${v}/viewform`,
  },
  googlemaps: {
    label: () => "View on Map",
    canonicalPrefix: "googlemaps",
    url: (v) => `https://maps.google.com/?q=${v}`,
  },
  maps: {
    label: () => "View on Map",
    canonicalPrefix: "googlemaps",
    url: (v) => `https://maps.google.com/?q=${v}`,
  },
};

function parseDirective(body) {
  const colonIdx = body.indexOf(":");
  if (colonIdx === -1) return null;

  const type = body.slice(0, colonIdx).toLowerCase();
  const value = body.slice(colonIdx + 1);
  if (!value) return null;

  // 1. Known platform?
  const platform = DIRECTIVE_PLATFORMS[type];
  if (platform) {
    return {
      canonicalId: `${platform.canonicalPrefix}:${value}`,
      type: "link",
      source: "directive",
      url: platform.url(value),
      label: platform.label(value),
      metadata: {},
    };
  }

  // 2. Image?
  if (type === "image") {
    // Handle drive:ID shorthand → lh3.googleusercontent.com direct URL
    const driveMatch = value.match(/^drive:(.+)$/);
    if (driveMatch) {
      const driveId = driveMatch[1];
      return {
        canonicalId: `image:drive:${driveId}`,
        type: "image",
        source: "directive",
        url: `https://lh3.googleusercontent.com/d/${driveId}`,
        label: "",
        metadata: {},
      };
    }
    const isUrl = value.startsWith("http://") || value.startsWith("https://");
    const url = isUrl ? normalizeImageUrl(value) : null;
    return {
      canonicalId: isUrl ? imageCanonicalId(value) : `image:${value}`,
      type: "image",
      source: "directive",
      url: url || value,
      label: "",
      metadata: {},
    };
  }

  // 3. Scalar tag?
  if (type === "tag") {
    return {
      canonicalId: `tag:${value}`,
      type: "tag",
      source: "directive",
      url: null,
      label: value,
      metadata: { key: "tag", value },
    };
  }

  // 4. Key-value tag
  return {
    canonicalId: `tag:${type}:${value}`,
    type: "tag",
    source: "directive",
    url: value.startsWith("http") ? value : null,
    label: `${type}: ${value}`,
    metadata: { key: type, value },
  };
}

/** Extract #already: directives from description text, returning tokens and cleaned description. */
export function extractDirectives(description) {
  if (!description)
    return {
      tokens: [],
      description,
      featured: false,
      hidden: false,
      imageShuffle: false,
    };
  description = decodeAmp(description).replace(
    LINKED_VALUE,
    (m, key, attrs) => {
      const href = LINKED_HREF.exec(attrs);
      return href ? key + href[2] : m;
    },
  );

  const tokens = [];
  const seen = new Set();
  let featured = false;
  let hidden = false;
  let imageShuffle = false;

  const matches = [...description.matchAll(DIRECTIVE_PATTERN)];
  for (const match of matches) {
    const body = match[1];

    // Intercept featured/hidden/image-shuffle flags before parseDirective
    // (they have no colon in body)
    const bodyLower = body.toLowerCase();
    if (bodyLower === "featured") {
      featured = true;
      continue;
    }
    if (bodyLower === "hidden") {
      hidden = true;
      continue;
    }
    if (bodyLower === "image-shuffle") {
      imageShuffle = true;
      continue;
    }

    const token = parseDirective(body);
    if (!token) continue;

    if (!seen.has(token.canonicalId)) {
      seen.add(token.canonicalId);
      tokens.push(token);
    }
  }

  // Always strip every directive from the description, even a malformed one.
  const cleaned = cleanupHtml(
    stripMatches(
      description,
      matches.map((m) => ({ index: m.index, text: m[0] })),
    ),
  );
  return { tokens, description: cleaned, featured, hidden, imageShuffle };
}
