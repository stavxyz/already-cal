import { cleanupHtml, stripUrl, URL_PATTERN } from './sanitize.js';
import {
  DRIVE_ID_PATTERN, getPathExtension, NON_IMAGE_EXTENSIONS,
  DROPBOX_PATTERN, DROPBOX_DIRECT_PATTERN, DEFAULT_IMAGE_EXTENSIONS,
} from './images.js';
import { normalizeUrl } from './tokens.js';

const IMAGE_EXTENSIONS = new Set(DEFAULT_IMAGE_EXTENSIONS);


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

/** Normalize an attachment URL: convert Drive/Dropbox URLs to direct-download links. */
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

function attachmentCanonicalId(url) {
  const driveMatch = url.match(DRIVE_ID_PATTERN);
  if (driveMatch) return `attachment:drive:${driveMatch[1]}`;

  const normalized = normalizeUrl(url);
  try {
    const u = new URL(normalized);
    return `attachment:${u.hostname}${u.pathname}`;
  } catch {
    return `attachment:${normalized}`;
  }
}

/** Extract file attachment tokens from description URLs. */
export function extractAttachmentTokens(description, config) {
  if (!description) return { tokens: [], description };
  description = description.replace(/&amp;/g, '&');

  const tokens = [];
  let cleaned = description;
  const seen = new Set();

  const urls = description.match(URL_PATTERN) || [];
  for (const url of urls) {
    const classification = classifyUrl(url);
    if (!classification) continue;

    const cid = attachmentCanonicalId(url);
    if (seen.has(cid)) {
      cleaned = stripUrl(cleaned, url);
      continue;
    }
    seen.add(cid);

    const normalizedUrl = normalizeAttachmentUrl(url);
    tokens.push({
      canonicalId: cid,
      type: 'attachment',
      source: 'url',
      url: normalizedUrl,
      label: classification.label,
      metadata: { fileType: classification.type },
    });
    cleaned = stripUrl(cleaned, url);
  }

  cleaned = cleanupHtml(cleaned);
  return { tokens, description: cleaned };
}

/** Extract file attachments from description, returning attachment objects and cleaned description. */
export function extractAttachments(description, config) {
  if (!description) return { attachments: [], description };
  const { tokens, description: cleaned } = extractAttachmentTokens(description, config);
  const attachments = tokens.map(t => ({
    label: t.label,
    url: t.url,
    type: t.metadata.fileType || 'file',
  }));
  return { attachments, description: cleaned };
}

/** Derive a file type string from a MIME type (e.g. "application/pdf" → "pdf"). */
export function deriveTypeFromMimeType(mimeType) {
  if (!mimeType) return 'file';
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
  if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('csv')) return 'spreadsheet';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'doc';
  if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('compressed')) return 'archive';
  return 'file';
}

/** Return a human-readable download label for a file type (e.g. "pdf" → "Download PDF"). */
export function labelForType(type) {
  const map = {
    pdf: 'Download PDF', doc: 'Download Document', spreadsheet: 'Download Spreadsheet',
    presentation: 'Download Presentation', archive: 'Download Archive',
  };
  return map[type] || 'Download File';
}
