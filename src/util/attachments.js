import { cleanupHtml, stripUrl } from './sanitize.js';
import { DRIVE_ID_PATTERN, getPathExtension, NON_IMAGE_EXTENSIONS } from './images.js';

const DROPBOX_PATTERN = /(?:www\.)?dropbox\.com\/(?:scl\/fi|s)\//;
const DROPBOX_DIRECT_PATTERN = /dl\.dropboxusercontent\.com/;

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp']);

const URL_PATTERN = /https?:\/\/[^\s<>"]+/gi;

function decodeUrlEntities(url) {
  return url.replace(/&amp;/g, '&');
}

// Map extensions to {label, type} — grouped by category
const EXTENSION_MAP = {
  pdf:  { label: 'Download PDF', type: 'pdf' },
  doc:  { label: 'Download Document', type: 'doc' },
  docx: { label: 'Download Document', type: 'docx' },
  xls:  { label: 'Download Spreadsheet', type: 'xls' },
  xlsx: { label: 'Download Spreadsheet', type: 'xlsx' },
  csv:  { label: 'Download Spreadsheet', type: 'csv' },
  ppt:  { label: 'Download Presentation', type: 'ppt' },
  pptx: { label: 'Download Presentation', type: 'pptx' },
  zip:  { label: 'Download Archive', type: 'zip' },
  txt:  { label: 'Download File', type: 'txt' },
};

export function normalizeAttachmentUrl(url) {
  if (!url) return url;

  const driveMatch = url.match(DRIVE_ID_PATTERN);
  if (driveMatch) return `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;

  if (DROPBOX_DIRECT_PATTERN.test(url)) return url;

  if (DROPBOX_PATTERN.test(url)) {
    if (url.includes('dl=0')) return url.replace('dl=0', 'raw=1');
    if (url.includes('?')) return url + '&raw=1';
    return url + '?raw=1';
  }

  return url;
}

function classifyUrl(url) {
  const ext = getPathExtension(url);

  if (ext) {
    if (IMAGE_EXTENSIONS.has(ext)) return null;
    if (EXTENSION_MAP[ext]) return EXTENSION_MAP[ext];
    return null;
  }

  // No extension — check for Drive URL (could be any file type)
  const driveMatch = url.match(DRIVE_ID_PATTERN);
  if (driveMatch) return { label: 'Download File', type: 'file' };

  return null;
}

export function extractAttachments(description, config) {
  if (!description) return { attachments: [], description };

  const attachments = [];
  let cleaned = description;
  const seen = new Set();

  const urls = description.match(URL_PATTERN) || [];
  for (const url of urls) {
    if (seen.has(url)) continue;
    const decodedUrl = decodeUrlEntities(url);
    const classification = classifyUrl(decodedUrl);
    if (!classification) continue;

    seen.add(url);
    const normalizedUrl = normalizeAttachmentUrl(decodedUrl);
    attachments.push({
      label: classification.label,
      url: normalizedUrl,
      type: classification.type,
    });
    cleaned = stripUrl(cleaned, url);
  }

  cleaned = cleanupHtml(cleaned);
  return { attachments, description: cleaned };
}

export function deriveTypeFromMimeType(mimeType) {
  if (!mimeType) return 'file';
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
  if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('csv')) return 'spreadsheet';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'doc';
  if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('compressed')) return 'archive';
  return 'file';
}

export function labelForType(type) {
  const map = {
    pdf: 'Download PDF', doc: 'Download Document', spreadsheet: 'Download Spreadsheet',
    presentation: 'Download Presentation', archive: 'Download Archive',
  };
  return map[type] || 'Download File';
}
