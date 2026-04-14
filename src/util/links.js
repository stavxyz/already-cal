import { cleanupHtml, stripUrl, URL_PATTERN } from './sanitize.js';
import { normalizeUrl } from './tokens.js';

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
function pathSegments(url) {
  try {
    return new URL(url).pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  } catch { return []; }
}

export function handleAt(url) {
  try {
    const segments = pathSegments(url);
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
  {
    pattern: /eventbrite\.com/i,
    label: 'RSVP on Eventbrite',
    canonicalize(url) {
      // Extract trailing numeric ID from slug like /e/some-title-12345
      const segs = pathSegments(url);
      const slug = segs[segs.length - 1] || '';
      const m = slug.match(/(\d+)$/);
      return `eventbrite:${m ? m[1] : slug}`;
    },
  },
  {
    pattern: /docs\.google\.com\/forms/i,
    label: 'Fill Out Form',
    canonicalize(url) {
      // /forms/d/e/<id>/viewform → googleforms:<id>
      const segs = pathSegments(url);
      const eIdx = segs.indexOf('e');
      const id = eIdx !== -1 ? segs[eIdx + 1] : segs[segs.length - 1];
      return `googleforms:${id || ''}`;
    },
  },
  {
    pattern: /goo\.gl\/maps|maps\.app\.goo\.gl|google\.com\/maps/i,
    label: 'View on Map',
    canonicalize(url) {
      const segs = pathSegments(url);
      if (/maps\.app\.goo\.gl/.test(url)) {
        return `googlemaps:${segs[0] || ''}`;
      }
      return `googlemaps:${segs.join('/')}`;
    },
  },
  {
    pattern: /zoom\.us/i,
    label: 'Join Zoom',
    canonicalize(url) {
      // /j/<meetingId>
      const segs = pathSegments(url);
      const jIdx = segs.indexOf('j');
      const id = jIdx !== -1 ? segs[jIdx + 1] : segs[segs.length - 1];
      return `zoom:${id || ''}`;
    },
  },
  {
    pattern: /meet\.google\.com/i,
    label: 'Join Google Meet',
    canonicalize(url) {
      const segs = pathSegments(url);
      return `googlemeet:${segs[0] || ''}`;
    },
  },
  {
    pattern: /instagram\.com/i,
    labelFn: (url) => { const h = handleAt(url); return h ? `Follow @${h} on Instagram` : 'View on Instagram'; },
    canonicalize(url) {
      const segs = pathSegments(url);
      if (segs.length === 0) return 'instagram:';
      if (segs.length === 1) return `instagram:${segs[0].replace(/^@/, '')}`;
      return `instagram:${segs.join('/')}`;
    },
  },
  {
    pattern: /facebook\.com|fb\.com/i,
    labelFn: (url) => { const h = handleAt(url); return h ? `${h} on Facebook` : 'View on Facebook'; },
    canonicalize(url) {
      const segs = pathSegments(url);
      return `facebook:${segs.join('/')}`;
    },
  },
  {
    pattern: /(?:twitter\.com|(?:^|\/\/)(?:www\.)?x\.com)/i,
    labelFn: (url) => { const h = handleAt(url); return h ? `Follow @${h} on X` : 'View on X'; },
    canonicalize(url) {
      const segs = pathSegments(url);
      return `x:${segs.join('/')}`;
    },
  },
  {
    pattern: /reddit\.com/i,
    labelFn: (url) => { const h = handleAt(url); return h ? `${h} on Reddit` : 'View on Reddit'; },
    canonicalize(url) {
      const segs = pathSegments(url);
      return `reddit:${segs.join('/')}`;
    },
  },
  {
    pattern: /youtube\.com|youtu\.be/i,
    label: 'Watch on YouTube',
    canonicalize(url) {
      try {
        const parsed = new URL(url);
        // youtu.be/<id>
        if (/youtu\.be/.test(url)) {
          const segs = pathSegments(url);
          return `youtube:${segs[0] || ''}`;
        }
        // youtube.com/watch?v=<id>
        const v = parsed.searchParams.get('v');
        if (v) return `youtube:${v}`;
        // fallback: path
        const segs = pathSegments(url);
        return `youtube:${segs.join('/')}`;
      } catch { return 'youtube:'; }
    },
  },
  {
    pattern: /tiktok\.com/i,
    labelFn: (url) => { const h = handleAt(url); return h ? `@${h} on TikTok` : 'View on TikTok'; },
    canonicalize(url) {
      const segs = pathSegments(url);
      if (segs.length === 0) return 'tiktok:';
      return `tiktok:${segs[0].replace(/^@/, '')}`;
    },
  },
  {
    pattern: /linkedin\.com/i,
    label: 'View on LinkedIn',
    canonicalize(url) {
      const segs = pathSegments(url);
      return `linkedin:${segs.join('/')}`;
    },
  },
  {
    pattern: /discord\.gg|discord\.com/i,
    label: 'Join Discord',
    canonicalize(url) {
      const segs = pathSegments(url);
      // discord.gg/<code> → segs[0]
      // discord.com/invite/<code> → segs[1]
      if (/discord\.gg/.test(url)) return `discord:${segs[0] || ''}`;
      const invIdx = segs.indexOf('invite');
      if (invIdx !== -1) return `discord:${segs[invIdx + 1] || ''}`;
      return `discord:${segs.join('/')}`;
    },
  },
  {
    pattern: /lu\.ma/i,
    label: 'RSVP on Luma',
    canonicalize(url) {
      const segs = pathSegments(url);
      return `luma:${segs[0] || ''}`;
    },
  },
  {
    pattern: /mobilize\.us/i,
    label: 'RSVP on Mobilize',
    canonicalize(url) {
      const segs = pathSegments(url);
      return `mobilize:${segs.join('/')}`;
    },
  },
  {
    pattern: /actionnetwork\.org/i,
    label: 'Take Action',
    canonicalize(url) {
      const segs = pathSegments(url);
      return `actionnetwork:${segs.join('/')}`;
    },
  },
  {
    pattern: /gofundme\.com/i,
    label: 'Donate on GoFundMe',
    canonicalize(url) {
      // /f/<slug>
      const segs = pathSegments(url);
      const fIdx = segs.indexOf('f');
      const slug = fIdx !== -1 ? segs[fIdx + 1] : segs[segs.length - 1];
      return `gofundme:${slug || ''}`;
    },
  },
  {
    pattern: /partiful\.com/i,
    label: 'RSVP on Partiful',
    canonicalize(url) {
      // /e/<id>
      const segs = pathSegments(url);
      const eIdx = segs.indexOf('e');
      const id = eIdx !== -1 ? segs[eIdx + 1] : segs[segs.length - 1];
      return `partiful:${id || ''}`;
    },
  },
];

/** Extract platform links from description, returning link objects and cleaned description. */
export function extractLinks(description, config) {
  if (!description) return { links: [], description };
  const { tokens, description: cleaned } = extractLinkTokens(description, config);
  const links = tokens.map(t => ({ label: t.label, url: t.url }));
  return { links, description: cleaned };
}

/** Extract platform link tokens from description for deduplication via TokenSet. */
export function extractLinkTokens(description, config) {
  if (!description) return { tokens: [], description };
  description = description.replace(/&amp;/g, '&');
  const platforms = (config && config.knownPlatforms) || DEFAULT_PLATFORMS;
  const tokens = [];
  let cleaned = description;
  const seen = new Set();

  URL_PATTERN.lastIndex = 0;
  const urls = description.match(URL_PATTERN) || [];
  for (const url of urls) {
    const normalized = normalizeUrl(url);
    for (const platform of platforms) {
      if (platform.pattern.test(url)) {
        const canonicalId = platform.canonicalize ? platform.canonicalize(normalized) : null;
        if (canonicalId && seen.has(canonicalId)) {
          cleaned = stripUrl(cleaned, url);
          break;
        }
        if (canonicalId) seen.add(canonicalId);
        const label = platform.labelFn ? platform.labelFn(url) : platform.label;
        tokens.push({
          canonicalId: canonicalId || `link:${normalized}`,
          type: 'link',
          source: 'url',
          url,
          label,
          metadata: {},
        });
        cleaned = stripUrl(cleaned, url);
        break;
      }
    }
  }

  cleaned = cleanupHtml(cleaned);
  return { tokens, description: cleaned };
}
