import { cleanupHtml } from './sanitize.js';

const DEFAULT_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'];

// Match Google Drive file URLs: /file/d/ID/view, /open?id=ID, /uc?id=ID
const DRIVE_PATTERN = /https?:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=view&)?id=)([a-zA-Z0-9_-]+)[^\s<>"]*/gi;

// Convert Google Drive URLs to direct-servable image URLs via lh3.googleusercontent.com
export function normalizeImageUrl(url) {
  if (!url) return null;
  const driveMatch = url.match(/drive\.google\.com\/(?:open\?id=|file\/d\/|uc\?(?:export=view&)?id=)([a-zA-Z0-9_-]+)/);
  if (driveMatch) return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
  return url;
}

function buildImagePattern(extensions) {
  const ext = extensions.join('|');
  // Match image URLs whether bare, inside href="...", or inside >...</a> tags
  return new RegExp(`(https?://[^\\s<>"]+\\.(?:${ext})(?:\\?[^\\s<>"]*)?)`, 'gi');
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
  DRIVE_PATTERN.lastIndex = 0;
  while ((match = DRIVE_PATTERN.exec(description)) !== null) {
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
  for (const img of originalUrls) {
    // Remove <a ...>img</a> pattern
    const escapedImg = img.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cleaned = cleaned.replace(new RegExp(`<a[^>]*>${escapedImg}</a>`, 'gi'), '');
    // Remove bare URL
    cleaned = cleaned.replace(img, '');
  }
  cleaned = cleanupHtml(cleaned);
  return { image: images[0] || null, images, description: cleaned };
}
