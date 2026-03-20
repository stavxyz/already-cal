const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, c => ESC_MAP[c]);
}

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
