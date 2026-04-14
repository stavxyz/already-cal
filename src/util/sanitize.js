const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Shared URL-matching pattern used by link, image, and attachment extractors
export const URL_PATTERN = /https?:\/\/[^\s<>"]+/gi;

/** Escape HTML special characters in a string. */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, c => ESC_MAP[c]);
}

/** Escape special regex characters in a string for use in new RegExp(). */
export function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Remove a URL from HTML, stripping both bare URLs and <a>-wrapped versions. */
export function stripUrl(html, url) {
  const escaped = escapeRegex(url);
  html = html.replace(new RegExp(`<a[^>]*>${escaped}</a>`, 'gi'), '');
  html = html.replace(new RegExp(escaped, 'g'), '');
  return html;
}

/** Clean up HTML after URL extraction: collapse orphaned <br> runs and normalize whitespace. */
// Clean up description HTML after extracting URLs.
// Collapses orphaned <br> runs, removes leading/trailing <br>,
// and normalizes excessive newlines.
export function cleanupHtml(str) {
  if (!str) return '';
  return str
    // Collapse 2+ consecutive <br> (with optional whitespace between) into a double line break
    .replace(/(<br\s*\/?>[\s]*){2,}/gi, '<br><br>')
    // Remove <br> at the very start or end
    .replace(/^(\s*<br\s*\/?>[\s]*)+/gi, '')
    .replace(/(\s*<br\s*\/?>[\s]*)+$/gi, '')
    // Collapse 3+ newlines into 2
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
