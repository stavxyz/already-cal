import { cleanupHtml } from './sanitize.js';

const DEFAULT_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'];

// Core pattern for extracting a Google Drive file ID from various URL formats:
//   /file/d/ID/..., /open?id=ID, /uc?id=ID, /uc?export=view&id=ID
const DRIVE_ID_PATTERN = /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=view&)?id=)([a-zA-Z0-9_-]+)/;

// Full-URL version with protocol and trailing chars, for scanning descriptions.
const DRIVE_URL_PATTERN = new RegExp(
  `https?:\\/\\/${DRIVE_ID_PATTERN.source}[^\\s<>"]*`, 'gi'
);

/**
 * Convert a Google Drive URL to a direct-servable image URL via
 * lh3.googleusercontent.com.  Non-Drive URLs are returned as-is.
 */
export function normalizeImageUrl(url) {
  if (!url) return null;
  const m = url.match(DRIVE_ID_PATTERN);
  if (m) return `https://lh3.googleusercontent.com/d/${m[1]}`;
  return url;
}

function buildImagePattern(extensions) {
  const ext = extensions.join('|');
  // Match image URLs whether bare, inside href="...", or inside >...</a> tags
  return new RegExp(`(https?://[^\\s<>"]+\\.(?:${ext})(?:\\?[^\\s<>"]*)?)`, 'gi');
}

function stripUrl(html, url) {
  const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Remove <a> tags wrapping this URL, then any remaining bare occurrences
  html = html.replace(new RegExp(`<a[^>]*>${escaped}</a>`, 'gi'), '');
  html = html.replace(new RegExp(escaped, 'g'), '');
  return html;
}

export function extractImage(description, config) {
  if (!description) return { image: null, images: [], description };
  const extensions = (config && config.imageExtensions) || DEFAULT_IMAGE_EXTENSIONS;
  const pattern = buildImagePattern(extensions);
  const seen = new Set();
  const images = [];
  // Track original URLs for removal from description
  const originalUrls = [];
  let match;

  // Extract standard image URLs (by extension)
  while ((match = pattern.exec(description)) !== null) {
    const url = match[1];
    if (!seen.has(url)) {
      seen.add(url);
      images.push(url);
      originalUrls.push(url);
    }
  }

  // Extract Google Drive image URLs
  DRIVE_URL_PATTERN.lastIndex = 0;
  while ((match = DRIVE_URL_PATTERN.exec(description)) !== null) {
    const originalUrl = match[0];
    const normalized = normalizeImageUrl(originalUrl);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      images.push(normalized);
      originalUrls.push(originalUrl);
    }
  }

  // Remove image URLs and any <a> tags wrapping them from description
  let cleaned = description;
  for (const url of originalUrls) {
    cleaned = stripUrl(cleaned, url);
  }
  cleaned = cleanupHtml(cleaned);
  return { image: images[0] || null, images, description: cleaned };
}
