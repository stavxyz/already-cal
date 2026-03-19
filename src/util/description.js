import { marked } from 'marked';
import { escapeHtml } from './sanitize.js';

const ALLOWED_TAGS = new Set([
  'p', 'a', 'strong', 'em', 'ul', 'ol', 'li', 'br', 'img',
  'blockquote', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
]);

const ALLOWED_ATTRS = {
  a: ['href', 'target'],
  img: ['src', 'alt'],
};

const HTML_TAG_RE = /<\/?[a-z][a-z0-9]*[\s>]/i;
const MARKDOWN_RE = /(?:^|\n)#{1,6}\s|(?:^|\n)[-*]\s|\*\*|__|\[.+?\]\(.+?\)/;

export function detectFormat(text) {
  if (!text) return 'plain';
  if (HTML_TAG_RE.test(text)) return 'html';
  if (MARKDOWN_RE.test(text)) return 'markdown';
  return 'plain';
}

export function sanitizeHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  sanitizeNode(div);
  return div.innerHTML;
}

function sanitizeNode(node) {
  const children = Array.from(node.childNodes);
  for (const child of children) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = child.tagName.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) {
        while (child.firstChild) {
          node.insertBefore(child.firstChild, child);
        }
        node.removeChild(child);
      } else {
        const allowed = ALLOWED_ATTRS[tag] || [];
        const attrs = Array.from(child.attributes);
        for (const attr of attrs) {
          if (!allowed.includes(attr.name)) {
            child.removeAttribute(attr.name);
          }
        }
        sanitizeNode(child);
      }
    }
  }
}

export function renderDescription(text) {
  if (!text) return '';
  const format = detectFormat(text);
  switch (format) {
    case 'html':
      return sanitizeHtml(text);
    case 'markdown':
      return sanitizeHtml(marked.parse(text));
    case 'plain':
    default:
      return escapeHtml(text).replace(/\n/g, '<br>');
  }
}
