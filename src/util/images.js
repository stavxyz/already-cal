import { cleanupHtml, stripUrl } from './sanitize.js';

// Single source of truth for supported image formats.
// Keys are canonical extensions; values are MIME types.
const IMAGE_FORMATS = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

const DEFAULT_IMAGE_EXTENSIONS = Object.keys(IMAGE_FORMATS);


// Core pattern for extracting a Google Drive file ID from various URL formats:
//   /file/d/ID/..., /open?id=ID, /uc?id=ID, /uc?export=view&id=ID
export const DRIVE_ID_PATTERN = /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=view&)?id=)([a-zA-Z0-9_-]+)/;

// Full-URL version with protocol and trailing chars, for scanning descriptions.
const DRIVE_URL_PATTERN = new RegExp(
  `https?:\\/\\/${DRIVE_ID_PATTERN.source}[^\\s<>"]*`, 'gi'
);

// Dropbox share URL patterns: /scl/fi/ (current) and /s/ (legacy)
const DROPBOX_PATTERN = /(?:www\.)?dropbox\.com\/(?:scl\/fi|s)\//;

// dl.dropboxusercontent.com is already direct-serve
const DROPBOX_DIRECT_PATTERN = /dl\.dropboxusercontent\.com/;

// Known non-image extensions — these are left for attachment extraction
const NON_IMAGE_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'zip', 'txt'
]);

// Full-URL Dropbox pattern for scanning descriptions
const DROPBOX_URL_PATTERN = /https?:\/\/(?:(?:www\.)?dropbox\.com\/(?:scl\/fi|s)\/|dl\.dropboxusercontent\.com\/)[^\s<>"]+/gi;

/**
 * Extract the file extension from a URL's path (last segment before query string).
 * Returns lowercase extension without dot, or null if none found.
 */
function getPathExtension(url) {
  try {
    const pathname = new URL(url).pathname;
    const lastSegment = pathname.split('/').pop();
    const dotIdx = lastSegment.lastIndexOf('.');
    if (dotIdx === -1) return null;
    return lastSegment.slice(dotIdx + 1).toLowerCase();
  } catch { return null; }
}

/**
 * Convert a Google Drive URL to a direct-servable image URL via
 * lh3.googleusercontent.com.  Dropbox share URLs are normalized to raw=1.
 * Non-Drive, non-Dropbox URLs are returned as-is.
 */
export function normalizeImageUrl(url) {
  if (!url) return null;

  // Google Drive → lh3.googleusercontent.com
  const m = url.match(DRIVE_ID_PATTERN);
  if (m) return `https://lh3.googleusercontent.com/d/${m[1]}`;

  // Dropbox direct URLs — already servable
  if (DROPBOX_DIRECT_PATTERN.test(url)) return url;

  // Dropbox share URLs — normalize to raw=1
  if (DROPBOX_PATTERN.test(url)) {
    if (url.includes('dl=0')) return url.replace('dl=0', 'raw=1');
    if (url.includes('?')) return url + '&raw=1';
    return url + '?raw=1';
  }

  return url;
}

function buildImagePattern(extensions) {
  const ext = extensions.join('|');
  // Match image URLs whether bare, inside href="...", or inside >...</a> tags
  return new RegExp(`(https?://[^\\s<>"]+\\.(?:${ext})(?:\\?[^\\s<>"]*)?)`, 'gi');
}

export { getPathExtension, NON_IMAGE_EXTENSIONS };

/**
 * Check if a URL points to Dropbox-hosted content.
 * @param {string} url
 * @returns {boolean}
 */
export function isDropboxUrl(url) {
  return !!url && (DROPBOX_PATTERN.test(url) || DROPBOX_DIRECT_PATTERN.test(url));
}

/**
 * Detect image MIME type from the first bytes of an ArrayBuffer using magic
 * byte signatures.  Falls back to URL extension, then 'image/jpeg'.
 * @param {ArrayBuffer} buf
 * @param {string} url - original URL, used as extension-based fallback
 * @returns {string} MIME type string
 */
export function detectMimeType(buf, url) {
  const bytes = new Uint8Array(buf, 0, Math.min(12, buf.byteLength));
  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'image/jpeg';
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'image/png';
  // GIF: 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'image/gif';
  // WebP: RIFF....WEBP (bytes 0-3 = RIFF, bytes 8-11 = WEBP)
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
      && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  // Fallback: infer from URL extension
  const ext = getPathExtension(url);
  return (ext && IMAGE_FORMATS[ext]) || 'image/jpeg';
}

/**
 * Fetch an image from a Dropbox URL and return a blob: URL with the correct
 * MIME type.  Dropbox currently serves images with content-type: application/json
 * and x-content-type-options: nosniff, causing browsers to reject them in <img>
 * tags.  The returned blob URLs are intentionally never revoked — they are freed
 * when the page unloads, and the calendar is not a long-lived SPA that re-fetches.
 * @param {string} url
 * @returns {Promise<string>} blob: URL
 */
export function fetchImageAsBlob(url) {
  return fetch(url)
    .then(r => { if (!r.ok) throw new Error(`Dropbox fetch failed: ${r.status}`); return r.arrayBuffer(); })
    .then(buf => {
      const mime = detectMimeType(buf, url);
      return URL.createObjectURL(new Blob([buf], { type: mime }));
    });
}

export function extractImage(description, config) {
  if (!description) return { image: null, images: [], description };
  // Decode HTML entities in URLs upfront so href and text content versions match.
  // Google Calendar API descriptions use &amp; in text content but & in href attrs.
  description = description.replace(/&amp;/g, '&');
  const extensions = (config && config.imageExtensions) || DEFAULT_IMAGE_EXTENSIONS;
  const pattern = buildImagePattern(extensions);
  const seen = new Set();
  const images = [];
  // Track original URLs for removal from description
  const originalUrls = [];
  let match;

  // Extract standard image URLs (by extension)
  while ((match = pattern.exec(description)) !== null) {
    const originalUrl = match[1];
    const normalized = normalizeImageUrl(originalUrl);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      images.push(normalized);
      originalUrls.push(originalUrl);
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

  // Extract Dropbox image URLs
  DROPBOX_URL_PATTERN.lastIndex = 0;
  while ((match = DROPBOX_URL_PATTERN.exec(description)) !== null) {
    const originalUrl = match[0];
    const ext = getPathExtension(originalUrl);
    // Skip known non-image extensions (they'll be picked up by attachment extraction)
    if (ext && NON_IMAGE_EXTENSIONS.has(ext)) continue;
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
