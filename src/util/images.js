const DEFAULT_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'];

function buildImagePattern(extensions) {
  const ext = extensions.join('|');
  return new RegExp(`(?:^|\\s)(https?:\\/\\/\\S+\\.(?:${ext})(?:\\?\\S*)?)(?:\\s|$)`, 'gi');
}

export function extractImage(description, config) {
  if (!description) return { image: null, images: [], description };
  const extensions = (config && config.imageExtensions) || DEFAULT_IMAGE_EXTENSIONS;
  const pattern = buildImagePattern(extensions);
  const images = [];
  let cleaned = description;
  let match;
  while ((match = pattern.exec(description)) !== null) {
    images.push(match[1]);
  }
  // Remove all image URLs from description
  for (const img of images) {
    cleaned = cleaned.replace(img, '').trim();
  }
  // Clean up leftover whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  return { image: images[0] || null, images, description: cleaned };
}
