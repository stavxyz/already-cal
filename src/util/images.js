const IMAGE_PATTERN = /(?:^|\s)(https?:\/\/\S+\.(?:png|jpe?g|gif|webp)(?:\?\S*)?)(?:\s|$)/i;

export function extractImage(description) {
  if (!description) return { image: null, description };
  const match = description.match(IMAGE_PATTERN);
  if (!match) return { image: null, description };
  const image = match[1];
  const cleaned = description.replace(match[0], ' ').trim();
  return { image, description: cleaned };
}
