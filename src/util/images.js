import { cleanupHtml, stripUrl } from './sanitize.js';
import { normalizeUrl } from './tokens.js';

export const DEFAULT_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'];


// Core pattern for extracting a Google Drive file ID from various URL formats:
//   /file/d/ID/..., /open?id=ID, /uc?id=ID, /uc?export=view&id=ID
export const DRIVE_ID_PATTERN = /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=view&)?id=)([a-zA-Z0-9_-]+)/;

// Full-URL version with protocol and trailing chars, for scanning descriptions.
const DRIVE_URL_PATTERN = new RegExp(
  `https?:\\/\\/${DRIVE_ID_PATTERN.source}[^\\s<>"]*`, 'gi'
);

// Dropbox share URL patterns: /scl/fi/ (current) and /s/ (legacy)
export const DROPBOX_PATTERN = /(?:www\.)?dropbox\.com\/(?:scl\/fi|s)\//;

// dl.dropboxusercontent.com is already direct-serve
export const DROPBOX_DIRECT_PATTERN = /dl\.dropboxusercontent\.com/;

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

  // Dropbox share URLs — normalize to raw=1.
  // Dropbox may serve these with incorrect content-type headers; if images
  // fail to render, consider re-hosting on a service with reliable MIME types.
  if (DROPBOX_PATTERN.test(url)) {
    if (typeof console !== 'undefined' && console.warn && !normalizeImageUrl._dropboxWarned) {
      console.warn('already-cal: Dropbox image URL detected. If images fail to render, Dropbox may be serving incorrect content-type headers. Consider re-hosting images on a more reliable service.');
      normalizeImageUrl._dropboxWarned = true;
    }
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

export { getPathExtension, NON_IMAGE_EXTENSIONS, imageCanonicalId };

function imageCanonicalId(originalUrl) {
  // Drive URLs: use file ID
  const driveMatch = originalUrl.match(DRIVE_ID_PATTERN);
  if (driveMatch) return `image:drive:${driveMatch[1]}`;

  // Dropbox URLs: use hash/filename from path
  const dropboxMatch = originalUrl.match(/dropbox\.com\/(?:scl\/fi|s)\/([^?]+)/);
  if (dropboxMatch) return `image:dropbox:${dropboxMatch[1]}`;

  // General: normalize to strip www, tracking params, etc.
  const normalized = normalizeUrl(originalUrl);
  try {
    const u = new URL(normalized);
    return `image:${u.hostname}${u.pathname}`;
  } catch {
    return `image:${normalized}`;
  }
}

/** Extract image tokens from description text (by extension, Drive URLs, and Dropbox URLs). */
export function extractImageTokens(description, config) {
  if (!description) return { tokens: [], description };
  description = description.replace(/&amp;/g, '&');
  const extensions = (config && config.imageExtensions) || DEFAULT_IMAGE_EXTENSIONS;
  const pattern = buildImagePattern(extensions);
  const seen = new Set();
  const tokens = [];
  const originalUrls = [];
  let match;

  // Standard image URLs (by extension)
  while ((match = pattern.exec(description)) !== null) {
    const originalUrl = match[1];
    const normalized = normalizeImageUrl(originalUrl);
    const cid = imageCanonicalId(originalUrl);
    if (normalized && !seen.has(cid)) {
      seen.add(cid);
      tokens.push({ canonicalId: cid, type: 'image', source: 'url', url: normalized, label: '', metadata: {} });
    }
    originalUrls.push(originalUrl);
  }

  // Google Drive image URLs
  DRIVE_URL_PATTERN.lastIndex = 0;
  while ((match = DRIVE_URL_PATTERN.exec(description)) !== null) {
    const originalUrl = match[0];
    const normalized = normalizeImageUrl(originalUrl);
    const cid = imageCanonicalId(originalUrl);
    if (normalized && !seen.has(cid)) {
      seen.add(cid);
      tokens.push({ canonicalId: cid, type: 'image', source: 'url', url: normalized, label: '', metadata: {} });
    }
    originalUrls.push(originalUrl);
  }

  // Dropbox image URLs
  DROPBOX_URL_PATTERN.lastIndex = 0;
  while ((match = DROPBOX_URL_PATTERN.exec(description)) !== null) {
    const originalUrl = match[0];
    const ext = getPathExtension(originalUrl);
    if (ext && NON_IMAGE_EXTENSIONS.has(ext)) continue;
    const normalized = normalizeImageUrl(originalUrl);
    const cid = imageCanonicalId(originalUrl);
    if (normalized && !seen.has(cid)) {
      seen.add(cid);
      tokens.push({ canonicalId: cid, type: 'image', source: 'url', url: normalized, label: '', metadata: {} });
    }
    originalUrls.push(originalUrl);
  }

  let cleaned = description;
  for (const url of originalUrls) {
    cleaned = stripUrl(cleaned, url);
  }
  cleaned = cleanupHtml(cleaned);
  return { tokens, description: cleaned };
}

/** Extract images from description, returning image URLs and cleaned description. */
export function extractImage(description, config) {
  if (!description) return { image: null, images: [], description };
  const { tokens, description: cleaned } = extractImageTokens(description, config);
  const images = tokens.map(t => t.url);
  return { image: images[0] || null, images, description: cleaned };
}
