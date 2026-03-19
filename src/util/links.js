const KNOWN_PLATFORMS = [
  { pattern: /eventbrite\.com/i, label: 'RSVP on Eventbrite' },
  { pattern: /docs\.google\.com\/forms/i, label: 'Fill Out Form' },
  { pattern: /goo\.gl\/maps|maps\.app\.goo\.gl|google\.com\/maps/i, label: 'View on Map' },
  { pattern: /zoom\.us/i, label: 'Join Zoom' },
  { pattern: /meet\.google\.com/i, label: 'Join Google Meet' },
];

const URL_PATTERN = /https?:\/\/[^\s<>"]+/gi;

export function extractLinks(description) {
  if (!description) return { links: [], description };
  const links = [];
  let cleaned = description;

  const urls = description.match(URL_PATTERN) || [];
  for (const url of urls) {
    for (const platform of KNOWN_PLATFORMS) {
      if (platform.pattern.test(url)) {
        links.push({ label: platform.label, url });
        cleaned = cleaned.replace(url, '').trim();
        break;
      }
    }
  }

  return { links, description: cleaned };
}
