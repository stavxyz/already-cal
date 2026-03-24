import { cleanupHtml } from './sanitize.js';

// Two-segment path prefixes that represent profile-like destinations,
// not individual content.  Keyed by the first segment.
const PROFILE_PREFIXES = new Set(['r', 'u', 'groups']);

/**
 * Extract a social-media handle or community name from a URL.
 * Returns null for non-profile URLs (posts, reels, status pages, etc.)
 * so the caller falls back to a generic "View on …" label.
 *
 * Single-segment paths (/<handle>) are treated as profiles.
 * Two-segment paths are only treated as profiles when the first segment
 * is a known prefix (e.g. /r/subreddit, /u/username, /groups/name).
 */
export function handleAt(url) {
  try {
    const segments = new URL(url).pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    if (segments.length === 0) return null;

    // Two-segment profile-like paths: /r/subreddit, /u/username, /groups/name
    if (segments.length === 2 && PROFILE_PREFIXES.has(segments[0])) {
      return `${segments[0]}/${segments[1]}`;
    }

    // Single-segment path = profile handle
    // Strip leading @ (TikTok uses /@handle in the path)
    // Allow dots (e.g. mill.scale) but reject file extensions (e.g. photo.jpg)
    if (segments.length === 1) {
      const seg = segments[0].replace(/^@/, '');
      if (/\.(jpg|jpeg|png|gif|webp|pdf|html|js|css|php)$/i.test(seg)) return null;
      return seg;
    }

    return null;
  } catch { return null; }
}

export const DEFAULT_PLATFORMS = [
  { pattern: /eventbrite\.com/i, label: 'RSVP on Eventbrite' },
  { pattern: /docs\.google\.com\/forms/i, label: 'Fill Out Form' },
  { pattern: /goo\.gl\/maps|maps\.app\.goo\.gl|google\.com\/maps/i, label: 'View on Map' },
  { pattern: /zoom\.us/i, label: 'Join Zoom' },
  { pattern: /meet\.google\.com/i, label: 'Join Google Meet' },
  { pattern: /instagram\.com/i, labelFn: (url) => { const h = handleAt(url); return h ? `Follow @${h} on Instagram` : 'View on Instagram'; } },
  { pattern: /facebook\.com|fb\.com/i, labelFn: (url) => { const h = handleAt(url); return h ? `${h} on Facebook` : 'View on Facebook'; } },
  { pattern: /(?:twitter\.com|(?:^|\/\/)(?:www\.)?x\.com)/i, labelFn: (url) => { const h = handleAt(url); return h ? `Follow @${h} on X` : 'View on X'; } },
  { pattern: /reddit\.com/i, labelFn: (url) => { const h = handleAt(url); return h ? `${h} on Reddit` : 'View on Reddit'; } },
  { pattern: /youtube\.com|youtu\.be/i, label: 'Watch on YouTube' },
  { pattern: /tiktok\.com/i, labelFn: (url) => { const h = handleAt(url); return h ? `@${h} on TikTok` : 'View on TikTok'; } },
  { pattern: /linkedin\.com/i, label: 'View on LinkedIn' },
  { pattern: /discord\.gg|discord\.com/i, label: 'Join Discord' },
  { pattern: /lu\.ma/i, label: 'RSVP on Luma' },
  { pattern: /mobilize\.us/i, label: 'RSVP on Mobilize' },
  { pattern: /actionnetwork\.org/i, label: 'Take Action' },
  { pattern: /gofundme\.com/i, label: 'Donate on GoFundMe' },
  { pattern: /partiful\.com/i, label: 'RSVP on Partiful' },
];

const URL_PATTERN = /https?:\/\/[^\s<>"]+/gi;

export function extractLinks(description, config) {
  if (!description) return { links: [], description };
  description = description.replace(/&amp;/g, '&');
  const platforms = (config && config.knownPlatforms) || DEFAULT_PLATFORMS;
  const links = [];
  let cleaned = description;
  const seen = new Set();

  const urls = description.match(URL_PATTERN) || [];
  for (const url of urls) {
    if (seen.has(url)) continue;
    for (const platform of platforms) {
      if (platform.pattern.test(url)) {
        seen.add(url);
        const label = platform.labelFn ? platform.labelFn(url) : platform.label;
        links.push({ label, url });
        // Remove <a> tag wrapping the URL if present, then the bare URL
        const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        cleaned = cleaned.replace(new RegExp(`<a[^>]*>${escapedUrl}</a>`, 'gi'), '');
        cleaned = cleaned.replace(url, '');
        break;
      }
    }
  }

  cleaned = cleanupHtml(cleaned);

  return { links, description: cleaned };
}
