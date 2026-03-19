function handleAt(url) {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, '');
    const handle = path.split('/').filter(Boolean).pop();
    return handle && !handle.includes('.') ? handle : null;
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
  { pattern: /(?:twitter\.com|x\.com)/i, labelFn: (url) => { const h = handleAt(url); return h ? `Follow @${h} on X` : 'View on X'; } },
  { pattern: /reddit\.com/i, labelFn: (url) => { const h = handleAt(url); return h ? `r/${h} on Reddit` : 'View on Reddit'; } },
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

  // Clean up leftover empty <br> pairs
  cleaned = cleaned.replace(/(<br\s*\/?>[\s]*){2,}/gi, '\n\n');
  cleaned = cleaned.trim();

  return { links, description: cleaned };
}
