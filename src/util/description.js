import { marked } from 'marked';
import { escapeHtml } from './sanitize.js';

const DEFAULT_ALLOWED_TAGS = [
  'p', 'a', 'strong', 'em', 'ul', 'ol', 'li', 'br', 'img',
  'blockquote', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
];

const DEFAULT_ALLOWED_ATTRS = {
  a: ['href', 'target'],
  img: ['src', 'alt'],
};

const HTML_TAG_RE = /<\/?[a-z][a-z0-9]*[\s>]/i;
const MARKDOWN_RE = /(?:^|\n)#{1,6}\s|(?:^|\n)[-*]\s|\*\*|__|\[.+?\]\(.+?\)/;

/** Auto-detect whether text is HTML, markdown, or plain text. */
export function detectFormat(text) {
  if (!text) return 'plain';
  if (HTML_TAG_RE.test(text)) return 'html';
  if (MARKDOWN_RE.test(text)) return 'markdown';
  return 'plain';
}

/** Sanitize HTML by removing disallowed tags and attributes. */
export function sanitizeHtml(html, config) {
  const sanitization = config && config.sanitization;
  const allowedTags = new Set(
    (sanitization && sanitization.allowedTags) || DEFAULT_ALLOWED_TAGS
  );
  const allowedAttrs = (sanitization && sanitization.allowedAttrs) || DEFAULT_ALLOWED_ATTRS;

  const div = document.createElement('div');
  div.innerHTML = html;
  sanitizeNode(div, allowedTags, allowedAttrs);
  return div.innerHTML;
}

function sanitizeNode(node, allowedTags, allowedAttrs) {
  const children = Array.from(node.childNodes);
  for (const child of children) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = child.tagName.toLowerCase();
      if (!allowedTags.has(tag)) {
        while (child.firstChild) {
          node.insertBefore(child.firstChild, child);
        }
        node.removeChild(child);
      } else {
        const allowed = allowedAttrs[tag] || [];
        const attrs = Array.from(child.attributes);
        for (const attr of attrs) {
          if (!allowed.includes(attr.name)) {
            child.removeAttribute(attr.name);
          }
        }
        sanitizeNode(child, allowedTags, allowedAttrs);
      }
    }
  }
}

/** Render event description text as sanitized HTML based on auto-detected format. */
export function renderDescription(text, config) {
  if (!text) return '';
  const format = detectFormat(text);
  switch (format) {
    case 'html':
      return sanitizeHtml(text, config);
    case 'markdown':
      return sanitizeHtml(marked.parse(text), config);
    case 'plain':
    default:
      return escapeHtml(text).replace(/\n/g, '<br>');
  }
}
