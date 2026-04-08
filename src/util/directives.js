import { cleanupHtml, stripUrl } from './sanitize.js';
import { normalizeImageUrl } from './images.js';

// Directive regex: #ogcal: or #showcal: followed by non-whitespace, non-HTML chars.
// Excludes < and > so the match stops before any wrapping </a> tag.
const DIRECTIVE_PATTERN = /#(?:ogcal|showcal):([^\s<>]+)/gi;

// Map directive platform names to their labels and canonical prefix.
const DIRECTIVE_PLATFORMS = {
  instagram:     { label: (v) => `Follow @${v} on Instagram`, canonicalPrefix: 'instagram' },
  facebook:      { label: (v) => `${v} on Facebook`, canonicalPrefix: 'facebook' },
  x:             { label: (v) => `Follow @${v} on X`, canonicalPrefix: 'x' },
  twitter:       { label: (v) => `Follow @${v} on X`, canonicalPrefix: 'x' },
  reddit:        { label: (v) => `r/${v} on Reddit`, canonicalPrefix: 'reddit' },
  youtube:       { label: () => 'Watch on YouTube', canonicalPrefix: 'youtube' },
  tiktok:        { label: (v) => `@${v} on TikTok`, canonicalPrefix: 'tiktok' },
  linkedin:      { label: () => 'View on LinkedIn', canonicalPrefix: 'linkedin' },
  discord:       { label: () => 'Join Discord', canonicalPrefix: 'discord' },
  zoom:          { label: () => 'Join Zoom', canonicalPrefix: 'zoom' },
  googlemeet:    { label: () => 'Join Google Meet', canonicalPrefix: 'googlemeet' },
  meet:          { label: () => 'Join Google Meet', canonicalPrefix: 'googlemeet' },
  eventbrite:    { label: () => 'RSVP on Eventbrite', canonicalPrefix: 'eventbrite' },
  luma:          { label: () => 'RSVP on Luma', canonicalPrefix: 'luma' },
  mobilize:      { label: () => 'RSVP on Mobilize', canonicalPrefix: 'mobilize' },
  actionnetwork: { label: () => 'Take Action', canonicalPrefix: 'actionnetwork' },
  gofundme:      { label: () => 'Donate on GoFundMe', canonicalPrefix: 'gofundme' },
  partiful:      { label: () => 'RSVP on Partiful', canonicalPrefix: 'partiful' },
  googleforms:   { label: () => 'Fill Out Form', canonicalPrefix: 'googleforms' },
  forms:         { label: () => 'Fill Out Form', canonicalPrefix: 'googleforms' },
  googlemaps:    { label: () => 'View on Map', canonicalPrefix: 'googlemaps' },
  maps:          { label: () => 'View on Map', canonicalPrefix: 'googlemaps' },
};

function parseDirective(body) {
  const colonIdx = body.indexOf(':');
  if (colonIdx === -1) return null;

  const type = body.slice(0, colonIdx).toLowerCase();
  const value = body.slice(colonIdx + 1);
  if (!value) return null;

  // 1. Known platform?
  const platform = DIRECTIVE_PLATFORMS[type];
  if (platform) {
    return {
      canonicalId: `${platform.canonicalPrefix}:${value}`,
      type: 'link',
      source: 'directive',
      url: null,
      label: platform.label(value),
      metadata: {},
    };
  }

  // 2. Image?
  if (type === 'image') {
    const canonicalId = `image:${value}`;
    const url = value.startsWith('http') ? value : null;
    const normalized = url ? normalizeImageUrl(url) : null;
    return {
      canonicalId,
      type: 'image',
      source: 'directive',
      url: normalized || value,
      label: '',
      metadata: {},
    };
  }

  // 3. Scalar tag?
  if (type === 'tag') {
    return {
      canonicalId: `tag:${value}`,
      type: 'tag',
      source: 'directive',
      url: null,
      label: value,
      metadata: { key: 'tag', value },
    };
  }

  // 4. Key-value tag
  return {
    canonicalId: `tag:${type}:${value}`,
    type: 'tag',
    source: 'directive',
    url: value.startsWith('http') ? value : null,
    label: `${type}: ${value}`,
    metadata: { key: type, value },
  };
}

export function extractDirectives(description) {
  if (!description) return { tokens: [], description };

  const tokens = [];
  const seen = new Set();
  let cleaned = description;

  const matches = [...description.matchAll(DIRECTIVE_PATTERN)];
  for (const match of matches) {
    const fullMatch = match[0];
    const body = match[1];

    // Always strip the directive from description, even if malformed
    cleaned = stripUrl(cleaned, fullMatch);

    const token = parseDirective(body);
    if (!token) continue;

    if (!seen.has(token.canonicalId)) {
      seen.add(token.canonicalId);
      tokens.push(token);
    }
  }

  cleaned = cleanupHtml(cleaned);
  return { tokens, description: cleaned };
}
