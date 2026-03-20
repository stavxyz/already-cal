import { cleanupHtml } from './sanitize.js';

const DEFAULT_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'];

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
  let match;
  while ((match = pattern.exec(description)) !== null) {
    const url = match[1];
    if (!seen.has(url)) {
      seen.add(url);
      images.push(url);
    }
  }
  // Remove image URLs and any <a> tags wrapping them from description
  let cleaned = description;
  for (const img of images) {
    // Remove <a ...>img</a> pattern
    const escapedImg = img.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cleaned = cleaned.replace(new RegExp(`<a[^>]*>${escapedImg}</a>`, 'gi'), '');
    // Remove bare URL
    cleaned = cleaned.replace(img, '');
  }
  cleaned = cleanupHtml(cleaned);
  return { image: images[0] || null, images, description: cleaned };
}
