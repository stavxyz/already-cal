/**
 * Deterministic FNV-1a 32-bit hash reduced to an index in [0, length).
 * Used to pick a stable card image per recurring-event occurrence.
 * The hash runs over UTF-16 code units (charCodeAt), so a consumer that
 * hashes UTF-8 bytes would get different indices for non-ASCII ids. The
 * only guarantee is that the same key gives the same index.
 */
export function stableIndex(key, length) {
  if (!(length > 1)) return 0;

  const str = String(key ?? "");
  let hash = 0x811c9dc5; // FNV-1a 32-bit offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV-1a 32-bit prime
  }

  return (hash >>> 0) % length;
}
