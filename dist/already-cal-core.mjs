// src/util/html-entities.js
function decodeAmp(text) {
  return text.replace(/&amp;/g, "&");
}
var NAMED_ENTITIES = Object.assign(/* @__PURE__ */ Object.create(null), {
  amp: "&",
  AMP: "&",
  lt: "<",
  LT: "<",
  gt: ">",
  GT: ">",
  quot: '"',
  QUOT: '"',
  apos: "'",
  nbsp: "\xA0",
  rsquo: "\u2019",
  lsquo: "\u2018",
  rdquo: "\u201D",
  ldquo: "\u201C",
  mdash: "\u2014",
  ndash: "\u2013",
  hellip: "\u2026",
  eacute: "\xE9",
  Eacute: "\xC9",
  egrave: "\xE8",
  Egrave: "\xC8",
  aacute: "\xE1",
  Aacute: "\xC1",
  iacute: "\xED",
  Iacute: "\xCD",
  oacute: "\xF3",
  Oacute: "\xD3",
  uacute: "\xFA",
  Uacute: "\xDA",
  ntilde: "\xF1",
  Ntilde: "\xD1",
  uuml: "\xFC",
  Uuml: "\xDC",
  ouml: "\xF6",
  Ouml: "\xD6",
  auml: "\xE4",
  Auml: "\xC4",
  ccedil: "\xE7",
  Ccedil: "\xC7",
  copy: "\xA9",
  COPY: "\xA9",
  reg: "\xAE",
  REG: "\xAE",
  trade: "\u2122",
  deg: "\xB0"
});
var ENTITY_RE = /&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi;
var WIN1252_C1_REPLACEMENTS = /* @__PURE__ */ new Map([
  [128, 8364],
  [130, 8218],
  [131, 402],
  [132, 8222],
  [133, 8230],
  [134, 8224],
  [135, 8225],
  [136, 710],
  [137, 8240],
  [138, 352],
  [139, 8249],
  [140, 338],
  [142, 381],
  [145, 8216],
  [146, 8217],
  [147, 8220],
  [148, 8221],
  [149, 8226],
  [150, 8211],
  [151, 8212],
  [152, 732],
  [153, 8482],
  [154, 353],
  [155, 8250],
  [156, 339],
  [158, 382],
  [159, 376]
]);
function decodeHtmlEntities(text) {
  if (!text) return text;
  return text.replace(ENTITY_RE, (match, body) => {
    if (body[0] === "#") {
      const isHex = body[1]?.toLowerCase() === "x";
      const codePoint = isHex ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
      if (!Number.isInteger(codePoint) || codePoint === 0 || codePoint > 1114111 || codePoint >= 55296 && codePoint <= 57343) {
        return "\uFFFD";
      }
      return String.fromCodePoint(
        WIN1252_C1_REPLACEMENTS.get(codePoint) ?? codePoint
      );
    }
    const decoded = NAMED_ENTITIES[body];
    return decoded === void 0 ? match : decoded;
  });
}

// src/util/sanitize.js
var URL_PATTERN = /https?:\/\/[^\s<>"]+/gi;
function stripMatches(text, matches) {
  if (matches.length === 0) return text;
  const wanted = new Set(matches.map((m) => m.text.toLowerCase()));
  const spans = matches.map((m) => [m.index, m.index + m.text.length]);
  for (const span of wrappingAnchorSpans(text, wanted)) spans.push(span);
  spans.sort((a, b) => a[0] - b[0]);
  let out = "";
  let cursor = 0;
  for (const [start, end] of spans) {
    if (start > cursor) out += text.slice(cursor, start);
    if (end > cursor) cursor = end;
  }
  return out + text.slice(cursor);
}
var ANCHOR_OPEN_RE = /<a/gi;
function wrappingAnchorSpans(text, wanted) {
  const spans = [];
  let gt = -1;
  let closeEnd = -1;
  ANCHOR_OPEN_RE.lastIndex = 0;
  let open = ANCHOR_OPEN_RE.exec(text);
  while (open !== null) {
    const afterOpen = open.index + 2;
    if (gt < afterOpen) {
      gt = text.indexOf(">", afterOpen);
      if (gt === -1) break;
      const lt = text.indexOf("<", gt + 1);
      closeEnd = lt !== -1 && text.slice(lt, lt + 4).toLowerCase() === "</a>" && wanted.has(text.slice(gt + 1, lt).toLowerCase()) ? lt + 4 : -1;
    }
    if (closeEnd !== -1) {
      spans.push([open.index, closeEnd]);
      ANCHOR_OPEN_RE.lastIndex = closeEnd;
    } else {
      ANCHOR_OPEN_RE.lastIndex = open.index + 1;
    }
    open = ANCHOR_OPEN_RE.exec(text);
  }
  return spans;
}
function cleanupHtml(str) {
  if (!str) return "";
  return str.replace(/(<br\s*\/?>[\s]*){2,}/gi, "<br><br>").replace(/^(\s*<br\s*\/?>[\s]*)+/gi, "").replace(/(?<!\s)\s*(?:<br\s*\/?>\s*)+$/gi, "").replace(/\n{3,}/g, "\n\n").trim();
}

// src/util/tokens.js
var TRACKING_PARAMS = /* @__PURE__ */ new Set([
  "fbclid",
  // Facebook click ID
  "si"
  // Spotify session ID (share tracking)
]);
var TRACKING_PREFIX = "utm_";
var TRAILING_SLASHES_RE = /(?<!\/)\/+$/;
function trimTrailingSlashes(path) {
  return path.replace(TRAILING_SLASHES_RE, "");
}
function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.protocol = "https:";
    u.hostname = u.hostname.replace(/^www\./, "");
    const pathname = trimTrailingSlashes(u.pathname);
    const cleaned = new URLSearchParams();
    for (const [key, value] of u.searchParams) {
      if (key.startsWith(TRACKING_PREFIX)) continue;
      if (TRACKING_PARAMS.has(key)) continue;
      cleaned.append(key, value);
    }
    const search = cleaned.toString();
    return u.origin + pathname + (search ? `?${search}` : "") + u.hash;
  } catch {
    return url;
  }
}
var TokenSet = class {
  constructor() {
    this._map = /* @__PURE__ */ new Map();
  }
  get size() {
    return this._map.size;
  }
  has(canonicalId) {
    return this._map.has(canonicalId);
  }
  add(token) {
    if (!this._map.has(token.canonicalId)) {
      this._map.set(token.canonicalId, token);
      return true;
    }
    return false;
  }
  addAll(tokens) {
    for (const t of tokens) {
      this.add(t);
    }
  }
  ofType(type) {
    return [...this._map.values()].filter((t) => t.type === type);
  }
};

// src/util/images.js
var DEFAULT_IMAGE_EXTENSIONS = Object.freeze([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp"
]);
var DRIVE_ID_PATTERN = /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=view&)?id=)([a-zA-Z0-9_-]+)/;
var DRIVE_URL_PATTERN = new RegExp(
  `https?:\\/\\/${DRIVE_ID_PATTERN.source}[^\\s<>"]*`,
  "gi"
);
var DROPBOX_PATTERN = /(?:www\.)?dropbox\.com\/(?:scl\/fi|s)\//;
var DROPBOX_DIRECT_PATTERN = /dl\.dropboxusercontent\.com/;
var NON_IMAGE_EXTENSIONS = /* @__PURE__ */ new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "csv",
  "ppt",
  "pptx",
  "zip",
  "txt"
]);
var DROPBOX_URL_PATTERN = /https?:\/\/(?:(?:www\.)?dropbox\.com\/(?:scl\/fi|s)\/|dl\.dropboxusercontent\.com\/)[^\s<>"]+/gi;
function getPathExtension(url) {
  try {
    const pathname = new URL(url).pathname;
    const lastSegment = pathname.split("/").pop();
    const dotIdx = lastSegment.lastIndexOf(".");
    if (dotIdx === -1) return null;
    return lastSegment.slice(dotIdx + 1).toLowerCase();
  } catch {
    return null;
  }
}
function normalizeImageUrl(url) {
  if (!url) return null;
  const m = url.match(DRIVE_ID_PATTERN);
  if (m) return `https://lh3.googleusercontent.com/d/${m[1]}`;
  if (DROPBOX_DIRECT_PATTERN.test(url)) return url;
  if (DROPBOX_PATTERN.test(url)) {
    if (typeof console !== "undefined" && console.warn && !normalizeImageUrl._dropboxWarned) {
      console.warn(
        "already-cal: Dropbox image URL detected. If images fail to render, Dropbox may be serving incorrect content-type headers. Consider re-hosting images on a more reliable service."
      );
      normalizeImageUrl._dropboxWarned = true;
    }
    if (url.includes("dl=0")) return url.replace("dl=0", "raw=1");
    if (url.includes("?")) return `${url}&raw=1`;
    return `${url}?raw=1`;
  }
  return url;
}
function buildImagePattern(extensions) {
  const ext = extensions.join("|");
  return new RegExp(`^https?://[^\\s<>"]+\\.(?:${ext})(?:\\?[^\\s<>"]*)?`, "i");
}
function imageCanonicalId(originalUrl) {
  const driveMatch = originalUrl.match(DRIVE_ID_PATTERN);
  if (driveMatch) return `image:drive:${driveMatch[1]}`;
  const dropboxMatch = originalUrl.match(
    /dropbox\.com\/(?:scl\/fi|s)\/([^?]+)/
  );
  if (dropboxMatch) return `image:dropbox:${dropboxMatch[1]}`;
  const normalized = normalizeUrl(originalUrl);
  try {
    const u = new URL(normalized);
    return `image:${u.hostname}${u.pathname}`;
  } catch {
    return `image:${normalized}`;
  }
}
function extractImageTokens(description, config) {
  if (!description) return { tokens: [], description };
  description = decodeAmp(description);
  const extensions = config?.imageExtensions || DEFAULT_IMAGE_EXTENSIONS;
  const pattern = buildImagePattern(extensions);
  const seen = /* @__PURE__ */ new Set();
  const tokens = [];
  const found = [];
  let match;
  for (const run of description.matchAll(URL_PATTERN)) {
    match = pattern.exec(run[0]);
    if (match === null) continue;
    const originalUrl = match[0];
    const normalized = normalizeImageUrl(originalUrl);
    const cid = imageCanonicalId(originalUrl);
    if (normalized && !seen.has(cid)) {
      seen.add(cid);
      tokens.push({
        canonicalId: cid,
        type: "image",
        source: "url",
        url: normalized,
        label: "",
        metadata: {}
      });
    }
    found.push({ index: run.index, text: originalUrl });
  }
  DRIVE_URL_PATTERN.lastIndex = 0;
  match = DRIVE_URL_PATTERN.exec(description);
  while (match !== null) {
    const originalUrl = match[0];
    const normalized = normalizeImageUrl(originalUrl);
    const cid = imageCanonicalId(originalUrl);
    if (normalized && !seen.has(cid)) {
      seen.add(cid);
      tokens.push({
        canonicalId: cid,
        type: "image",
        source: "url",
        url: normalized,
        label: "",
        metadata: {}
      });
    }
    found.push({ index: match.index, text: originalUrl });
    match = DRIVE_URL_PATTERN.exec(description);
  }
  DROPBOX_URL_PATTERN.lastIndex = 0;
  match = DROPBOX_URL_PATTERN.exec(description);
  while (match !== null) {
    const originalUrl = match[0];
    const ext = getPathExtension(originalUrl);
    found.push({ index: match.index, text: originalUrl });
    match = DROPBOX_URL_PATTERN.exec(description);
    if (ext && NON_IMAGE_EXTENSIONS.has(ext)) continue;
    const normalized = normalizeImageUrl(originalUrl);
    const cid = imageCanonicalId(originalUrl);
    if (normalized && !seen.has(cid)) {
      seen.add(cid);
      tokens.push({
        canonicalId: cid,
        type: "image",
        source: "url",
        url: normalized,
        label: "",
        metadata: {}
      });
    }
  }
  const cleaned = cleanupHtml(stripMatches(description, found));
  return { tokens, description: cleaned };
}

// src/util/links.js
var PROFILE_PREFIXES = /* @__PURE__ */ new Set(["r", "u", "groups"]);
function pathSegments(url) {
  try {
    return trimTrailingSlashes(new URL(url).pathname).split("/").filter(Boolean);
  } catch {
    return [];
  }
}
function handleAt(url) {
  try {
    const segments = pathSegments(url);
    if (segments.length === 0) return null;
    if (segments.length === 2 && PROFILE_PREFIXES.has(segments[0])) {
      return `${segments[0]}/${segments[1]}`;
    }
    if (segments.length === 1) {
      const seg = segments[0].replace(/^@/, "");
      if (/\.(jpg|jpeg|png|gif|webp|pdf|html|js|css|php)$/i.test(seg))
        return null;
      return seg;
    }
    return null;
  } catch {
    return null;
  }
}
var DEFAULT_PLATFORMS = [
  {
    pattern: /eventbrite\.com/i,
    label: "RSVP on Eventbrite",
    canonicalize(url) {
      const segs = pathSegments(url);
      const slug = segs[segs.length - 1] || "";
      const m = slug.match(/(?<!\d)(\d+)$/);
      return `eventbrite:${m ? m[1] : slug}`;
    }
  },
  {
    pattern: /docs\.google\.com\/forms/i,
    label: "Fill Out Form",
    canonicalize(url) {
      const segs = pathSegments(url);
      const eIdx = segs.indexOf("e");
      const id = eIdx !== -1 ? segs[eIdx + 1] : segs[segs.length - 1];
      return `googleforms:${id || ""}`;
    }
  },
  {
    pattern: /goo\.gl\/maps|maps\.app\.goo\.gl|google\.com\/maps/i,
    label: "View on Map",
    canonicalize(url) {
      const segs = pathSegments(url);
      if (/maps\.app\.goo\.gl/.test(url)) {
        return `googlemaps:${segs[0] || ""}`;
      }
      return `googlemaps:${segs.join("/")}`;
    }
  },
  {
    pattern: /zoom\.us/i,
    label: "Join Zoom",
    canonicalize(url) {
      const segs = pathSegments(url);
      const jIdx = segs.indexOf("j");
      const id = jIdx !== -1 ? segs[jIdx + 1] : segs[segs.length - 1];
      return `zoom:${id || ""}`;
    }
  },
  {
    pattern: /meet\.google\.com/i,
    label: "Join Google Meet",
    canonicalize(url) {
      const segs = pathSegments(url);
      return `googlemeet:${segs[0] || ""}`;
    }
  },
  {
    pattern: /instagram\.com/i,
    labelFn: (url) => {
      const h = handleAt(url);
      return h ? `Follow @${h} on Instagram` : "View on Instagram";
    },
    canonicalize(url) {
      const segs = pathSegments(url);
      if (segs.length === 0) return "instagram:";
      if (segs.length === 1) return `instagram:${segs[0].replace(/^@/, "")}`;
      return `instagram:${segs.join("/")}`;
    }
  },
  {
    pattern: /facebook\.com|fb\.com/i,
    labelFn: (url) => {
      const h = handleAt(url);
      return h ? `${h} on Facebook` : "View on Facebook";
    },
    canonicalize(url) {
      const segs = pathSegments(url);
      return `facebook:${segs.join("/")}`;
    }
  },
  {
    pattern: /(?:twitter\.com|(?:^|\/\/)(?:www\.)?x\.com)/i,
    labelFn: (url) => {
      const h = handleAt(url);
      return h ? `Follow @${h} on X` : "View on X";
    },
    canonicalize(url) {
      const segs = pathSegments(url);
      return `x:${segs.join("/")}`;
    }
  },
  {
    pattern: /reddit\.com/i,
    labelFn: (url) => {
      const h = handleAt(url);
      return h ? `${h} on Reddit` : "View on Reddit";
    },
    canonicalize(url) {
      const segs = pathSegments(url);
      return `reddit:${segs.join("/")}`;
    }
  },
  {
    pattern: /youtube\.com|youtu\.be/i,
    label: "Watch on YouTube",
    canonicalize(url) {
      try {
        const parsed = new URL(url);
        if (/youtu\.be/.test(url)) {
          const segs2 = pathSegments(url);
          return `youtube:${segs2[0] || ""}`;
        }
        const v = parsed.searchParams.get("v");
        if (v) return `youtube:${v}`;
        const segs = pathSegments(url);
        return `youtube:${segs.join("/")}`;
      } catch {
        return "youtube:";
      }
    }
  },
  {
    pattern: /tiktok\.com/i,
    labelFn: (url) => {
      const h = handleAt(url);
      return h ? `@${h} on TikTok` : "View on TikTok";
    },
    canonicalize(url) {
      const segs = pathSegments(url);
      if (segs.length === 0) return "tiktok:";
      return `tiktok:${segs[0].replace(/^@/, "")}`;
    }
  },
  {
    pattern: /linkedin\.com/i,
    label: "View on LinkedIn",
    canonicalize(url) {
      const segs = pathSegments(url);
      return `linkedin:${segs.join("/")}`;
    }
  },
  {
    pattern: /discord\.gg|discord\.com/i,
    label: "Join Discord",
    canonicalize(url) {
      const segs = pathSegments(url);
      if (/discord\.gg/.test(url)) return `discord:${segs[0] || ""}`;
      const invIdx = segs.indexOf("invite");
      if (invIdx !== -1) return `discord:${segs[invIdx + 1] || ""}`;
      return `discord:${segs.join("/")}`;
    }
  },
  {
    pattern: /lu\.ma/i,
    label: "RSVP on Luma",
    canonicalize(url) {
      const segs = pathSegments(url);
      return `luma:${segs[0] || ""}`;
    }
  },
  {
    pattern: /mobilize\.us/i,
    label: "RSVP on Mobilize",
    canonicalize(url) {
      const segs = pathSegments(url);
      return `mobilize:${segs.join("/")}`;
    }
  },
  {
    pattern: /actionnetwork\.org/i,
    label: "Take Action",
    canonicalize(url) {
      const segs = pathSegments(url);
      return `actionnetwork:${segs.join("/")}`;
    }
  },
  {
    pattern: /gofundme\.com/i,
    label: "Donate on GoFundMe",
    canonicalize(url) {
      const segs = pathSegments(url);
      const fIdx = segs.indexOf("f");
      const slug = fIdx !== -1 ? segs[fIdx + 1] : segs[segs.length - 1];
      return `gofundme:${slug || ""}`;
    }
  },
  {
    pattern: /partiful\.com/i,
    label: "RSVP on Partiful",
    canonicalize(url) {
      const segs = pathSegments(url);
      const eIdx = segs.indexOf("e");
      const id = eIdx !== -1 ? segs[eIdx + 1] : segs[segs.length - 1];
      return `partiful:${id || ""}`;
    }
  }
];
function extractLinkTokens(description, config) {
  if (!description) return { tokens: [], description };
  description = decodeAmp(description);
  const platforms = config?.knownPlatforms || DEFAULT_PLATFORMS;
  const tokens = [];
  const toStrip = [];
  const seen = /* @__PURE__ */ new Set();
  for (const found of description.matchAll(URL_PATTERN)) {
    const url = found[0];
    const normalized = normalizeUrl(url);
    for (const platform of platforms) {
      if (platform.pattern.test(url)) {
        const canonicalId = platform.canonicalize ? platform.canonicalize(normalized) : null;
        if (canonicalId && seen.has(canonicalId)) {
          toStrip.push({ index: found.index, text: url });
          break;
        }
        if (canonicalId) seen.add(canonicalId);
        const label = platform.labelFn ? platform.labelFn(url) : platform.label;
        tokens.push({
          canonicalId: canonicalId || `link:${normalized}`,
          type: "link",
          source: "url",
          url,
          label,
          metadata: {}
        });
        toStrip.push({ index: found.index, text: url });
        break;
      }
    }
  }
  const cleaned = cleanupHtml(stripMatches(description, toStrip));
  return { tokens, description: cleaned };
}

// src/content-defaults.js
var CONTENT_DEFAULTS = Object.freeze({
  imageExtensions: DEFAULT_IMAGE_EXTENSIONS,
  knownPlatforms: DEFAULT_PLATFORMS
});

// src/util/attachments.js
var IMAGE_EXTENSIONS = new Set(DEFAULT_IMAGE_EXTENSIONS);
var EXTENSION_MAP = {
  pdf: { label: "Download PDF", type: "pdf" },
  doc: { label: "Download Document", type: "doc" },
  docx: { label: "Download Document", type: "docx" },
  xls: { label: "Download Spreadsheet", type: "xls" },
  xlsx: { label: "Download Spreadsheet", type: "xlsx" },
  csv: { label: "Download Spreadsheet", type: "csv" },
  ppt: { label: "Download Presentation", type: "ppt" },
  pptx: { label: "Download Presentation", type: "pptx" },
  zip: { label: "Download Archive", type: "zip" },
  txt: { label: "Download File", type: "txt" }
};
function normalizeAttachmentUrl(url) {
  if (!url) return url;
  const driveMatch = url.match(DRIVE_ID_PATTERN);
  if (driveMatch)
    return `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
  if (DROPBOX_DIRECT_PATTERN.test(url)) return url;
  if (DROPBOX_PATTERN.test(url)) {
    if (url.includes("dl=0")) return url.replace("dl=0", "raw=1");
    if (url.includes("?")) return `${url}&raw=1`;
    return `${url}?raw=1`;
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
  const driveMatch = url.match(DRIVE_ID_PATTERN);
  if (driveMatch) return { label: "Download File", type: "file" };
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
function extractAttachmentTokens(description, _config) {
  if (!description) return { tokens: [], description };
  description = decodeAmp(description);
  const tokens = [];
  const toStrip = [];
  const seen = /* @__PURE__ */ new Set();
  for (const found of description.matchAll(URL_PATTERN)) {
    const url = found[0];
    const classification = classifyUrl(url);
    if (!classification) continue;
    const cid = attachmentCanonicalId(url);
    if (seen.has(cid)) {
      toStrip.push({ index: found.index, text: url });
      continue;
    }
    seen.add(cid);
    const normalizedUrl = normalizeAttachmentUrl(url);
    tokens.push({
      canonicalId: cid,
      type: "attachment",
      source: "url",
      url: normalizedUrl,
      label: classification.label,
      metadata: { fileType: classification.type }
    });
    toStrip.push({ index: found.index, text: url });
  }
  const cleaned = cleanupHtml(stripMatches(description, toStrip));
  return { tokens, description: cleaned };
}
function deriveTypeFromMimeType(mimeType) {
  if (!mimeType) return "file";
  if (mimeType.includes("pdf")) return "pdf";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint"))
    return "presentation";
  if (mimeType.includes("sheet") || mimeType.includes("excel") || mimeType.includes("csv"))
    return "spreadsheet";
  if (mimeType.includes("word") || mimeType.includes("document")) return "doc";
  if (mimeType.includes("zip") || mimeType.includes("archive") || mimeType.includes("compressed"))
    return "archive";
  return "file";
}
function labelForType(type) {
  const map = {
    pdf: "Download PDF",
    doc: "Download Document",
    spreadsheet: "Download Spreadsheet",
    presentation: "Download Presentation",
    archive: "Download Archive"
  };
  return map[type] || "Download File";
}

// src/util/comments.js
var COMMENT_RE = /^[ \t]*\/\/ .*$\n?/gm;
function stripComments(description) {
  if (!description) return "";
  let text = decodeAmp(description);
  text = text.replace(/\r\n/g, "\n");
  text = text.replace(COMMENT_RE, "");
  text = text.replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "").replace(/\n+$/, "");
  return text;
}

// node_modules/marked/lib/marked.esm.js
function _getDefaults() {
  return {
    async: false,
    breaks: false,
    extensions: null,
    gfm: true,
    hooks: null,
    pedantic: false,
    renderer: null,
    silent: false,
    tokenizer: null,
    walkTokens: null
  };
}
var _defaults = _getDefaults();
function changeDefaults(newDefaults) {
  _defaults = newDefaults;
}
var noopTest = { exec: () => null };
function edit(regex, opt = "") {
  let source = typeof regex === "string" ? regex : regex.source;
  const obj = {
    replace: (name, val) => {
      let valSource = typeof val === "string" ? val : val.source;
      valSource = valSource.replace(other.caret, "$1");
      source = source.replace(name, valSource);
      return obj;
    },
    getRegex: () => {
      return new RegExp(source, opt);
    }
  };
  return obj;
}
var other = {
  codeRemoveIndent: /^(?: {1,4}| {0,3}\t)/gm,
  outputLinkReplace: /\\([\[\]])/g,
  indentCodeCompensation: /^(\s+)(?:```)/,
  beginningSpace: /^\s+/,
  endingHash: /#$/,
  startingSpaceChar: /^ /,
  endingSpaceChar: / $/,
  nonSpaceChar: /[^ ]/,
  newLineCharGlobal: /\n/g,
  tabCharGlobal: /\t/g,
  multipleSpaceGlobal: /\s+/g,
  blankLine: /^[ \t]*$/,
  doubleBlankLine: /\n[ \t]*\n[ \t]*$/,
  blockquoteStart: /^ {0,3}>/,
  blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g,
  blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm,
  listReplaceTabs: /^\t+/,
  listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g,
  listIsTask: /^\[[ xX]\] /,
  listReplaceTask: /^\[[ xX]\] +/,
  anyLine: /\n.*\n/,
  hrefBrackets: /^<(.*)>$/,
  tableDelimiter: /[:|]/,
  tableAlignChars: /^\||\| *$/g,
  tableRowBlankLine: /\n[ \t]*$/,
  tableAlignRight: /^ *-+: *$/,
  tableAlignCenter: /^ *:-+: *$/,
  tableAlignLeft: /^ *:-+ *$/,
  startATag: /^<a /i,
  endATag: /^<\/a>/i,
  startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i,
  endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i,
  startAngleBracket: /^</,
  endAngleBracket: />$/,
  pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/,
  unicodeAlphaNumeric: /[\p{L}\p{N}]/u,
  escapeTest: /[&<>"']/,
  escapeReplace: /[&<>"']/g,
  escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,
  escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,
  unescapeTest: /&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig,
  caret: /(^|[^\[])\^/g,
  percentDecode: /%25/g,
  findPipe: /\|/g,
  splitPipe: / \|/,
  slashPipe: /\\\|/g,
  carriageReturn: /\r\n|\r/g,
  spaceLine: /^ +$/gm,
  notSpaceStart: /^\S*/,
  endingNewline: /\n$/,
  listItemRegex: (bull) => new RegExp(`^( {0,3}${bull})((?:[	 ][^\\n]*)?(?:\\n|$))`),
  nextBulletRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`),
  hrRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`),
  fencesBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:\`\`\`|~~~)`),
  headingBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}#`),
  htmlBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}<(?:[a-z].*>|!--)`, "i")
};
var newline = /^(?:[ \t]*(?:\n|$))+/;
var blockCode = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
var fences = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/;
var hr = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
var heading = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
var bullet = /(?:[*+-]|\d{1,9}[.)])/;
var lheadingCore = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/;
var lheading = edit(lheadingCore).replace(/bull/g, bullet).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/\|table/g, "").getRegex();
var lheadingGfm = edit(lheadingCore).replace(/bull/g, bullet).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex();
var _paragraph = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/;
var blockText = /^[^\n]+/;
var _blockLabel = /(?!\s*\])(?:\\.|[^\[\]\\])+/;
var def = edit(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", _blockLabel).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex();
var list = edit(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g, bullet).getRegex();
var _tag = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";
var _comment = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;
var html = edit(
  "^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))",
  "i"
).replace("comment", _comment).replace("tag", _tag).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex();
var paragraph = edit(_paragraph).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex();
var blockquote = edit(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", paragraph).getRegex();
var blockNormal = {
  blockquote,
  code: blockCode,
  def,
  fences,
  heading,
  hr,
  html,
  lheading,
  list,
  newline,
  paragraph,
  table: noopTest,
  text: blockText
};
var gfmTable = edit(
  "^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)"
).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex();
var blockGfm = {
  ...blockNormal,
  lheading: lheadingGfm,
  table: gfmTable,
  paragraph: edit(_paragraph).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", gfmTable).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex()
};
var blockPedantic = {
  ...blockNormal,
  html: edit(
    `^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`
  ).replace("comment", _comment).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),
  def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,
  heading: /^(#{1,6})(.*)(?:\n+|$)/,
  fences: noopTest,
  // fences not supported
  lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,
  paragraph: edit(_paragraph).replace("hr", hr).replace("heading", " *#{1,6} *[^\n]").replace("lheading", lheading).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex()
};
var escape = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
var inlineCode = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
var br = /^( {2,}|\\)\n(?!\s*$)/;
var inlineText = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/;
var _punctuation = /[\p{P}\p{S}]/u;
var _punctuationOrSpace = /[\s\p{P}\p{S}]/u;
var _notPunctuationOrSpace = /[^\s\p{P}\p{S}]/u;
var punctuation = edit(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, _punctuationOrSpace).getRegex();
var _punctuationGfmStrongEm = /(?!~)[\p{P}\p{S}]/u;
var _punctuationOrSpaceGfmStrongEm = /(?!~)[\s\p{P}\p{S}]/u;
var _notPunctuationOrSpaceGfmStrongEm = /(?:[^\s\p{P}\p{S}]|~)/u;
var blockSkip = /\[[^[\]]*?\]\((?:\\.|[^\\\(\)]|\((?:\\.|[^\\\(\)])*\))*\)|`[^`]*?`|<[^<>]*?>/g;
var emStrongLDelimCore = /^(?:\*+(?:((?!\*)punct)|[^\s*]))|^_+(?:((?!_)punct)|([^\s_]))/;
var emStrongLDelim = edit(emStrongLDelimCore, "u").replace(/punct/g, _punctuation).getRegex();
var emStrongLDelimGfm = edit(emStrongLDelimCore, "u").replace(/punct/g, _punctuationGfmStrongEm).getRegex();
var emStrongRDelimAstCore = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)";
var emStrongRDelimAst = edit(emStrongRDelimAstCore, "gu").replace(/notPunctSpace/g, _notPunctuationOrSpace).replace(/punctSpace/g, _punctuationOrSpace).replace(/punct/g, _punctuation).getRegex();
var emStrongRDelimAstGfm = edit(emStrongRDelimAstCore, "gu").replace(/notPunctSpace/g, _notPunctuationOrSpaceGfmStrongEm).replace(/punctSpace/g, _punctuationOrSpaceGfmStrongEm).replace(/punct/g, _punctuationGfmStrongEm).getRegex();
var emStrongRDelimUnd = edit(
  "^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)",
  "gu"
).replace(/notPunctSpace/g, _notPunctuationOrSpace).replace(/punctSpace/g, _punctuationOrSpace).replace(/punct/g, _punctuation).getRegex();
var anyPunctuation = edit(/\\(punct)/, "gu").replace(/punct/g, _punctuation).getRegex();
var autolink = edit(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex();
var _inlineComment = edit(_comment).replace("(?:-->|$)", "-->").getRegex();
var tag = edit(
  "^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>"
).replace("comment", _inlineComment).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex();
var _inlineLabel = /(?:\[(?:\\.|[^\[\]\\])*\]|\\.|`[^`]*`|[^\[\]\\`])*?/;
var link = edit(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]*(?:\n[ \t]*)?)(title))?\s*\)/).replace("label", _inlineLabel).replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex();
var reflink = edit(/^!?\[(label)\]\[(ref)\]/).replace("label", _inlineLabel).replace("ref", _blockLabel).getRegex();
var nolink = edit(/^!?\[(ref)\](?:\[\])?/).replace("ref", _blockLabel).getRegex();
var reflinkSearch = edit("reflink|nolink(?!\\()", "g").replace("reflink", reflink).replace("nolink", nolink).getRegex();
var inlineNormal = {
  _backpedal: noopTest,
  // only used for GFM url
  anyPunctuation,
  autolink,
  blockSkip,
  br,
  code: inlineCode,
  del: noopTest,
  emStrongLDelim,
  emStrongRDelimAst,
  emStrongRDelimUnd,
  escape,
  link,
  nolink,
  punctuation,
  reflink,
  reflinkSearch,
  tag,
  text: inlineText,
  url: noopTest
};
var inlinePedantic = {
  ...inlineNormal,
  link: edit(/^!?\[(label)\]\((.*?)\)/).replace("label", _inlineLabel).getRegex(),
  reflink: edit(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", _inlineLabel).getRegex()
};
var inlineGfm = {
  ...inlineNormal,
  emStrongRDelimAst: emStrongRDelimAstGfm,
  emStrongLDelim: emStrongLDelimGfm,
  url: edit(/^((?:ftp|https?):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/, "i").replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),
  _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,
  del: /^(~~?)(?=[^\s~])((?:\\.|[^\\])*?(?:\\.|[^\s~\\]))\1(?=[^~]|$)/,
  text: /^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|https?:\/\/|ftp:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/
};
var inlineBreaks = {
  ...inlineGfm,
  br: edit(br).replace("{2,}", "*").getRegex(),
  text: edit(inlineGfm.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex()
};
var block = {
  normal: blockNormal,
  gfm: blockGfm,
  pedantic: blockPedantic
};
var inline = {
  normal: inlineNormal,
  gfm: inlineGfm,
  breaks: inlineBreaks,
  pedantic: inlinePedantic
};
var escapeReplacements = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};
var getEscapeReplacement = (ch) => escapeReplacements[ch];
function escape2(html2, encode) {
  if (encode) {
    if (other.escapeTest.test(html2)) {
      return html2.replace(other.escapeReplace, getEscapeReplacement);
    }
  } else {
    if (other.escapeTestNoEncode.test(html2)) {
      return html2.replace(other.escapeReplaceNoEncode, getEscapeReplacement);
    }
  }
  return html2;
}
function cleanUrl(href) {
  try {
    href = encodeURI(href).replace(other.percentDecode, "%");
  } catch {
    return null;
  }
  return href;
}
function splitCells(tableRow, count) {
  const row = tableRow.replace(other.findPipe, (match, offset, str) => {
    let escaped = false;
    let curr = offset;
    while (--curr >= 0 && str[curr] === "\\") escaped = !escaped;
    if (escaped) {
      return "|";
    } else {
      return " |";
    }
  }), cells = row.split(other.splitPipe);
  let i = 0;
  if (!cells[0].trim()) {
    cells.shift();
  }
  if (cells.length > 0 && !cells.at(-1)?.trim()) {
    cells.pop();
  }
  if (count) {
    if (cells.length > count) {
      cells.splice(count);
    } else {
      while (cells.length < count) cells.push("");
    }
  }
  for (; i < cells.length; i++) {
    cells[i] = cells[i].trim().replace(other.slashPipe, "|");
  }
  return cells;
}
function rtrim(str, c, invert) {
  const l = str.length;
  if (l === 0) {
    return "";
  }
  let suffLen = 0;
  while (suffLen < l) {
    const currChar = str.charAt(l - suffLen - 1);
    if (currChar === c && !invert) {
      suffLen++;
    } else if (currChar !== c && invert) {
      suffLen++;
    } else {
      break;
    }
  }
  return str.slice(0, l - suffLen);
}
function findClosingBracket(str, b) {
  if (str.indexOf(b[1]) === -1) {
    return -1;
  }
  let level = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === "\\") {
      i++;
    } else if (str[i] === b[0]) {
      level++;
    } else if (str[i] === b[1]) {
      level--;
      if (level < 0) {
        return i;
      }
    }
  }
  if (level > 0) {
    return -2;
  }
  return -1;
}
function outputLink(cap, link2, raw, lexer2, rules) {
  const href = link2.href;
  const title = link2.title || null;
  const text = cap[1].replace(rules.other.outputLinkReplace, "$1");
  lexer2.state.inLink = true;
  const token = {
    type: cap[0].charAt(0) === "!" ? "image" : "link",
    raw,
    href,
    title,
    text,
    tokens: lexer2.inlineTokens(text)
  };
  lexer2.state.inLink = false;
  return token;
}
function indentCodeCompensation(raw, text, rules) {
  const matchIndentToCode = raw.match(rules.other.indentCodeCompensation);
  if (matchIndentToCode === null) {
    return text;
  }
  const indentToCode = matchIndentToCode[1];
  return text.split("\n").map((node) => {
    const matchIndentInNode = node.match(rules.other.beginningSpace);
    if (matchIndentInNode === null) {
      return node;
    }
    const [indentInNode] = matchIndentInNode;
    if (indentInNode.length >= indentToCode.length) {
      return node.slice(indentToCode.length);
    }
    return node;
  }).join("\n");
}
var _Tokenizer = class {
  options;
  rules;
  // set by the lexer
  lexer;
  // set by the lexer
  constructor(options2) {
    this.options = options2 || _defaults;
  }
  space(src) {
    const cap = this.rules.block.newline.exec(src);
    if (cap && cap[0].length > 0) {
      return {
        type: "space",
        raw: cap[0]
      };
    }
  }
  code(src) {
    const cap = this.rules.block.code.exec(src);
    if (cap) {
      const text = cap[0].replace(this.rules.other.codeRemoveIndent, "");
      return {
        type: "code",
        raw: cap[0],
        codeBlockStyle: "indented",
        text: !this.options.pedantic ? rtrim(text, "\n") : text
      };
    }
  }
  fences(src) {
    const cap = this.rules.block.fences.exec(src);
    if (cap) {
      const raw = cap[0];
      const text = indentCodeCompensation(raw, cap[3] || "", this.rules);
      return {
        type: "code",
        raw,
        lang: cap[2] ? cap[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : cap[2],
        text
      };
    }
  }
  heading(src) {
    const cap = this.rules.block.heading.exec(src);
    if (cap) {
      let text = cap[2].trim();
      if (this.rules.other.endingHash.test(text)) {
        const trimmed = rtrim(text, "#");
        if (this.options.pedantic) {
          text = trimmed.trim();
        } else if (!trimmed || this.rules.other.endingSpaceChar.test(trimmed)) {
          text = trimmed.trim();
        }
      }
      return {
        type: "heading",
        raw: cap[0],
        depth: cap[1].length,
        text,
        tokens: this.lexer.inline(text)
      };
    }
  }
  hr(src) {
    const cap = this.rules.block.hr.exec(src);
    if (cap) {
      return {
        type: "hr",
        raw: rtrim(cap[0], "\n")
      };
    }
  }
  blockquote(src) {
    const cap = this.rules.block.blockquote.exec(src);
    if (cap) {
      let lines = rtrim(cap[0], "\n").split("\n");
      let raw = "";
      let text = "";
      const tokens = [];
      while (lines.length > 0) {
        let inBlockquote = false;
        const currentLines = [];
        let i;
        for (i = 0; i < lines.length; i++) {
          if (this.rules.other.blockquoteStart.test(lines[i])) {
            currentLines.push(lines[i]);
            inBlockquote = true;
          } else if (!inBlockquote) {
            currentLines.push(lines[i]);
          } else {
            break;
          }
        }
        lines = lines.slice(i);
        const currentRaw = currentLines.join("\n");
        const currentText = currentRaw.replace(this.rules.other.blockquoteSetextReplace, "\n    $1").replace(this.rules.other.blockquoteSetextReplace2, "");
        raw = raw ? `${raw}
${currentRaw}` : currentRaw;
        text = text ? `${text}
${currentText}` : currentText;
        const top = this.lexer.state.top;
        this.lexer.state.top = true;
        this.lexer.blockTokens(currentText, tokens, true);
        this.lexer.state.top = top;
        if (lines.length === 0) {
          break;
        }
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "code") {
          break;
        } else if (lastToken?.type === "blockquote") {
          const oldToken = lastToken;
          const newText = oldToken.raw + "\n" + lines.join("\n");
          const newToken = this.blockquote(newText);
          tokens[tokens.length - 1] = newToken;
          raw = raw.substring(0, raw.length - oldToken.raw.length) + newToken.raw;
          text = text.substring(0, text.length - oldToken.text.length) + newToken.text;
          break;
        } else if (lastToken?.type === "list") {
          const oldToken = lastToken;
          const newText = oldToken.raw + "\n" + lines.join("\n");
          const newToken = this.list(newText);
          tokens[tokens.length - 1] = newToken;
          raw = raw.substring(0, raw.length - lastToken.raw.length) + newToken.raw;
          text = text.substring(0, text.length - oldToken.raw.length) + newToken.raw;
          lines = newText.substring(tokens.at(-1).raw.length).split("\n");
          continue;
        }
      }
      return {
        type: "blockquote",
        raw,
        tokens,
        text
      };
    }
  }
  list(src) {
    let cap = this.rules.block.list.exec(src);
    if (cap) {
      let bull = cap[1].trim();
      const isordered = bull.length > 1;
      const list2 = {
        type: "list",
        raw: "",
        ordered: isordered,
        start: isordered ? +bull.slice(0, -1) : "",
        loose: false,
        items: []
      };
      bull = isordered ? `\\d{1,9}\\${bull.slice(-1)}` : `\\${bull}`;
      if (this.options.pedantic) {
        bull = isordered ? bull : "[*+-]";
      }
      const itemRegex = this.rules.other.listItemRegex(bull);
      let endsWithBlankLine = false;
      while (src) {
        let endEarly = false;
        let raw = "";
        let itemContents = "";
        if (!(cap = itemRegex.exec(src))) {
          break;
        }
        if (this.rules.block.hr.test(src)) {
          break;
        }
        raw = cap[0];
        src = src.substring(raw.length);
        let line = cap[2].split("\n", 1)[0].replace(this.rules.other.listReplaceTabs, (t) => " ".repeat(3 * t.length));
        let nextLine = src.split("\n", 1)[0];
        let blankLine = !line.trim();
        let indent = 0;
        if (this.options.pedantic) {
          indent = 2;
          itemContents = line.trimStart();
        } else if (blankLine) {
          indent = cap[1].length + 1;
        } else {
          indent = cap[2].search(this.rules.other.nonSpaceChar);
          indent = indent > 4 ? 1 : indent;
          itemContents = line.slice(indent);
          indent += cap[1].length;
        }
        if (blankLine && this.rules.other.blankLine.test(nextLine)) {
          raw += nextLine + "\n";
          src = src.substring(nextLine.length + 1);
          endEarly = true;
        }
        if (!endEarly) {
          const nextBulletRegex = this.rules.other.nextBulletRegex(indent);
          const hrRegex = this.rules.other.hrRegex(indent);
          const fencesBeginRegex = this.rules.other.fencesBeginRegex(indent);
          const headingBeginRegex = this.rules.other.headingBeginRegex(indent);
          const htmlBeginRegex = this.rules.other.htmlBeginRegex(indent);
          while (src) {
            const rawLine = src.split("\n", 1)[0];
            let nextLineWithoutTabs;
            nextLine = rawLine;
            if (this.options.pedantic) {
              nextLine = nextLine.replace(this.rules.other.listReplaceNesting, "  ");
              nextLineWithoutTabs = nextLine;
            } else {
              nextLineWithoutTabs = nextLine.replace(this.rules.other.tabCharGlobal, "    ");
            }
            if (fencesBeginRegex.test(nextLine)) {
              break;
            }
            if (headingBeginRegex.test(nextLine)) {
              break;
            }
            if (htmlBeginRegex.test(nextLine)) {
              break;
            }
            if (nextBulletRegex.test(nextLine)) {
              break;
            }
            if (hrRegex.test(nextLine)) {
              break;
            }
            if (nextLineWithoutTabs.search(this.rules.other.nonSpaceChar) >= indent || !nextLine.trim()) {
              itemContents += "\n" + nextLineWithoutTabs.slice(indent);
            } else {
              if (blankLine) {
                break;
              }
              if (line.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4) {
                break;
              }
              if (fencesBeginRegex.test(line)) {
                break;
              }
              if (headingBeginRegex.test(line)) {
                break;
              }
              if (hrRegex.test(line)) {
                break;
              }
              itemContents += "\n" + nextLine;
            }
            if (!blankLine && !nextLine.trim()) {
              blankLine = true;
            }
            raw += rawLine + "\n";
            src = src.substring(rawLine.length + 1);
            line = nextLineWithoutTabs.slice(indent);
          }
        }
        if (!list2.loose) {
          if (endsWithBlankLine) {
            list2.loose = true;
          } else if (this.rules.other.doubleBlankLine.test(raw)) {
            endsWithBlankLine = true;
          }
        }
        let istask = null;
        let ischecked;
        if (this.options.gfm) {
          istask = this.rules.other.listIsTask.exec(itemContents);
          if (istask) {
            ischecked = istask[0] !== "[ ] ";
            itemContents = itemContents.replace(this.rules.other.listReplaceTask, "");
          }
        }
        list2.items.push({
          type: "list_item",
          raw,
          task: !!istask,
          checked: ischecked,
          loose: false,
          text: itemContents,
          tokens: []
        });
        list2.raw += raw;
      }
      const lastItem = list2.items.at(-1);
      if (lastItem) {
        lastItem.raw = lastItem.raw.trimEnd();
        lastItem.text = lastItem.text.trimEnd();
      } else {
        return;
      }
      list2.raw = list2.raw.trimEnd();
      for (let i = 0; i < list2.items.length; i++) {
        this.lexer.state.top = false;
        list2.items[i].tokens = this.lexer.blockTokens(list2.items[i].text, []);
        if (!list2.loose) {
          const spacers = list2.items[i].tokens.filter((t) => t.type === "space");
          const hasMultipleLineBreaks = spacers.length > 0 && spacers.some((t) => this.rules.other.anyLine.test(t.raw));
          list2.loose = hasMultipleLineBreaks;
        }
      }
      if (list2.loose) {
        for (let i = 0; i < list2.items.length; i++) {
          list2.items[i].loose = true;
        }
      }
      return list2;
    }
  }
  html(src) {
    const cap = this.rules.block.html.exec(src);
    if (cap) {
      const token = {
        type: "html",
        block: true,
        raw: cap[0],
        pre: cap[1] === "pre" || cap[1] === "script" || cap[1] === "style",
        text: cap[0]
      };
      return token;
    }
  }
  def(src) {
    const cap = this.rules.block.def.exec(src);
    if (cap) {
      const tag2 = cap[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal, " ");
      const href = cap[2] ? cap[2].replace(this.rules.other.hrefBrackets, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "";
      const title = cap[3] ? cap[3].substring(1, cap[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : cap[3];
      return {
        type: "def",
        tag: tag2,
        raw: cap[0],
        href,
        title
      };
    }
  }
  table(src) {
    const cap = this.rules.block.table.exec(src);
    if (!cap) {
      return;
    }
    if (!this.rules.other.tableDelimiter.test(cap[2])) {
      return;
    }
    const headers = splitCells(cap[1]);
    const aligns = cap[2].replace(this.rules.other.tableAlignChars, "").split("|");
    const rows = cap[3]?.trim() ? cap[3].replace(this.rules.other.tableRowBlankLine, "").split("\n") : [];
    const item = {
      type: "table",
      raw: cap[0],
      header: [],
      align: [],
      rows: []
    };
    if (headers.length !== aligns.length) {
      return;
    }
    for (const align of aligns) {
      if (this.rules.other.tableAlignRight.test(align)) {
        item.align.push("right");
      } else if (this.rules.other.tableAlignCenter.test(align)) {
        item.align.push("center");
      } else if (this.rules.other.tableAlignLeft.test(align)) {
        item.align.push("left");
      } else {
        item.align.push(null);
      }
    }
    for (let i = 0; i < headers.length; i++) {
      item.header.push({
        text: headers[i],
        tokens: this.lexer.inline(headers[i]),
        header: true,
        align: item.align[i]
      });
    }
    for (const row of rows) {
      item.rows.push(splitCells(row, item.header.length).map((cell, i) => {
        return {
          text: cell,
          tokens: this.lexer.inline(cell),
          header: false,
          align: item.align[i]
        };
      }));
    }
    return item;
  }
  lheading(src) {
    const cap = this.rules.block.lheading.exec(src);
    if (cap) {
      return {
        type: "heading",
        raw: cap[0],
        depth: cap[2].charAt(0) === "=" ? 1 : 2,
        text: cap[1],
        tokens: this.lexer.inline(cap[1])
      };
    }
  }
  paragraph(src) {
    const cap = this.rules.block.paragraph.exec(src);
    if (cap) {
      const text = cap[1].charAt(cap[1].length - 1) === "\n" ? cap[1].slice(0, -1) : cap[1];
      return {
        type: "paragraph",
        raw: cap[0],
        text,
        tokens: this.lexer.inline(text)
      };
    }
  }
  text(src) {
    const cap = this.rules.block.text.exec(src);
    if (cap) {
      return {
        type: "text",
        raw: cap[0],
        text: cap[0],
        tokens: this.lexer.inline(cap[0])
      };
    }
  }
  escape(src) {
    const cap = this.rules.inline.escape.exec(src);
    if (cap) {
      return {
        type: "escape",
        raw: cap[0],
        text: cap[1]
      };
    }
  }
  tag(src) {
    const cap = this.rules.inline.tag.exec(src);
    if (cap) {
      if (!this.lexer.state.inLink && this.rules.other.startATag.test(cap[0])) {
        this.lexer.state.inLink = true;
      } else if (this.lexer.state.inLink && this.rules.other.endATag.test(cap[0])) {
        this.lexer.state.inLink = false;
      }
      if (!this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(cap[0])) {
        this.lexer.state.inRawBlock = true;
      } else if (this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(cap[0])) {
        this.lexer.state.inRawBlock = false;
      }
      return {
        type: "html",
        raw: cap[0],
        inLink: this.lexer.state.inLink,
        inRawBlock: this.lexer.state.inRawBlock,
        block: false,
        text: cap[0]
      };
    }
  }
  link(src) {
    const cap = this.rules.inline.link.exec(src);
    if (cap) {
      const trimmedUrl = cap[2].trim();
      if (!this.options.pedantic && this.rules.other.startAngleBracket.test(trimmedUrl)) {
        if (!this.rules.other.endAngleBracket.test(trimmedUrl)) {
          return;
        }
        const rtrimSlash = rtrim(trimmedUrl.slice(0, -1), "\\");
        if ((trimmedUrl.length - rtrimSlash.length) % 2 === 0) {
          return;
        }
      } else {
        const lastParenIndex = findClosingBracket(cap[2], "()");
        if (lastParenIndex === -2) {
          return;
        }
        if (lastParenIndex > -1) {
          const start = cap[0].indexOf("!") === 0 ? 5 : 4;
          const linkLen = start + cap[1].length + lastParenIndex;
          cap[2] = cap[2].substring(0, lastParenIndex);
          cap[0] = cap[0].substring(0, linkLen).trim();
          cap[3] = "";
        }
      }
      let href = cap[2];
      let title = "";
      if (this.options.pedantic) {
        const link2 = this.rules.other.pedanticHrefTitle.exec(href);
        if (link2) {
          href = link2[1];
          title = link2[3];
        }
      } else {
        title = cap[3] ? cap[3].slice(1, -1) : "";
      }
      href = href.trim();
      if (this.rules.other.startAngleBracket.test(href)) {
        if (this.options.pedantic && !this.rules.other.endAngleBracket.test(trimmedUrl)) {
          href = href.slice(1);
        } else {
          href = href.slice(1, -1);
        }
      }
      return outputLink(cap, {
        href: href ? href.replace(this.rules.inline.anyPunctuation, "$1") : href,
        title: title ? title.replace(this.rules.inline.anyPunctuation, "$1") : title
      }, cap[0], this.lexer, this.rules);
    }
  }
  reflink(src, links) {
    let cap;
    if ((cap = this.rules.inline.reflink.exec(src)) || (cap = this.rules.inline.nolink.exec(src))) {
      const linkString = (cap[2] || cap[1]).replace(this.rules.other.multipleSpaceGlobal, " ");
      const link2 = links[linkString.toLowerCase()];
      if (!link2) {
        const text = cap[0].charAt(0);
        return {
          type: "text",
          raw: text,
          text
        };
      }
      return outputLink(cap, link2, cap[0], this.lexer, this.rules);
    }
  }
  emStrong(src, maskedSrc, prevChar = "") {
    let match = this.rules.inline.emStrongLDelim.exec(src);
    if (!match) return;
    if (match[3] && prevChar.match(this.rules.other.unicodeAlphaNumeric)) return;
    const nextChar = match[1] || match[2] || "";
    if (!nextChar || !prevChar || this.rules.inline.punctuation.exec(prevChar)) {
      const lLength = [...match[0]].length - 1;
      let rDelim, rLength, delimTotal = lLength, midDelimTotal = 0;
      const endReg = match[0][0] === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
      endReg.lastIndex = 0;
      maskedSrc = maskedSrc.slice(-1 * src.length + lLength);
      while ((match = endReg.exec(maskedSrc)) != null) {
        rDelim = match[1] || match[2] || match[3] || match[4] || match[5] || match[6];
        if (!rDelim) continue;
        rLength = [...rDelim].length;
        if (match[3] || match[4]) {
          delimTotal += rLength;
          continue;
        } else if (match[5] || match[6]) {
          if (lLength % 3 && !((lLength + rLength) % 3)) {
            midDelimTotal += rLength;
            continue;
          }
        }
        delimTotal -= rLength;
        if (delimTotal > 0) continue;
        rLength = Math.min(rLength, rLength + delimTotal + midDelimTotal);
        const lastCharLength = [...match[0]][0].length;
        const raw = src.slice(0, lLength + match.index + lastCharLength + rLength);
        if (Math.min(lLength, rLength) % 2) {
          const text2 = raw.slice(1, -1);
          return {
            type: "em",
            raw,
            text: text2,
            tokens: this.lexer.inlineTokens(text2)
          };
        }
        const text = raw.slice(2, -2);
        return {
          type: "strong",
          raw,
          text,
          tokens: this.lexer.inlineTokens(text)
        };
      }
    }
  }
  codespan(src) {
    const cap = this.rules.inline.code.exec(src);
    if (cap) {
      let text = cap[2].replace(this.rules.other.newLineCharGlobal, " ");
      const hasNonSpaceChars = this.rules.other.nonSpaceChar.test(text);
      const hasSpaceCharsOnBothEnds = this.rules.other.startingSpaceChar.test(text) && this.rules.other.endingSpaceChar.test(text);
      if (hasNonSpaceChars && hasSpaceCharsOnBothEnds) {
        text = text.substring(1, text.length - 1);
      }
      return {
        type: "codespan",
        raw: cap[0],
        text
      };
    }
  }
  br(src) {
    const cap = this.rules.inline.br.exec(src);
    if (cap) {
      return {
        type: "br",
        raw: cap[0]
      };
    }
  }
  del(src) {
    const cap = this.rules.inline.del.exec(src);
    if (cap) {
      return {
        type: "del",
        raw: cap[0],
        text: cap[2],
        tokens: this.lexer.inlineTokens(cap[2])
      };
    }
  }
  autolink(src) {
    const cap = this.rules.inline.autolink.exec(src);
    if (cap) {
      let text, href;
      if (cap[2] === "@") {
        text = cap[1];
        href = "mailto:" + text;
      } else {
        text = cap[1];
        href = text;
      }
      return {
        type: "link",
        raw: cap[0],
        text,
        href,
        tokens: [
          {
            type: "text",
            raw: text,
            text
          }
        ]
      };
    }
  }
  url(src) {
    let cap;
    if (cap = this.rules.inline.url.exec(src)) {
      let text, href;
      if (cap[2] === "@") {
        text = cap[0];
        href = "mailto:" + text;
      } else {
        let prevCapZero;
        do {
          prevCapZero = cap[0];
          cap[0] = this.rules.inline._backpedal.exec(cap[0])?.[0] ?? "";
        } while (prevCapZero !== cap[0]);
        text = cap[0];
        if (cap[1] === "www.") {
          href = "http://" + cap[0];
        } else {
          href = cap[0];
        }
      }
      return {
        type: "link",
        raw: cap[0],
        text,
        href,
        tokens: [
          {
            type: "text",
            raw: text,
            text
          }
        ]
      };
    }
  }
  inlineText(src) {
    const cap = this.rules.inline.text.exec(src);
    if (cap) {
      const escaped = this.lexer.state.inRawBlock;
      return {
        type: "text",
        raw: cap[0],
        text: cap[0],
        escaped
      };
    }
  }
};
var _Lexer = class __Lexer {
  tokens;
  options;
  state;
  tokenizer;
  inlineQueue;
  constructor(options2) {
    this.tokens = [];
    this.tokens.links = /* @__PURE__ */ Object.create(null);
    this.options = options2 || _defaults;
    this.options.tokenizer = this.options.tokenizer || new _Tokenizer();
    this.tokenizer = this.options.tokenizer;
    this.tokenizer.options = this.options;
    this.tokenizer.lexer = this;
    this.inlineQueue = [];
    this.state = {
      inLink: false,
      inRawBlock: false,
      top: true
    };
    const rules = {
      other,
      block: block.normal,
      inline: inline.normal
    };
    if (this.options.pedantic) {
      rules.block = block.pedantic;
      rules.inline = inline.pedantic;
    } else if (this.options.gfm) {
      rules.block = block.gfm;
      if (this.options.breaks) {
        rules.inline = inline.breaks;
      } else {
        rules.inline = inline.gfm;
      }
    }
    this.tokenizer.rules = rules;
  }
  /**
   * Expose Rules
   */
  static get rules() {
    return {
      block,
      inline
    };
  }
  /**
   * Static Lex Method
   */
  static lex(src, options2) {
    const lexer2 = new __Lexer(options2);
    return lexer2.lex(src);
  }
  /**
   * Static Lex Inline Method
   */
  static lexInline(src, options2) {
    const lexer2 = new __Lexer(options2);
    return lexer2.inlineTokens(src);
  }
  /**
   * Preprocessing
   */
  lex(src) {
    src = src.replace(other.carriageReturn, "\n");
    this.blockTokens(src, this.tokens);
    for (let i = 0; i < this.inlineQueue.length; i++) {
      const next = this.inlineQueue[i];
      this.inlineTokens(next.src, next.tokens);
    }
    this.inlineQueue = [];
    return this.tokens;
  }
  blockTokens(src, tokens = [], lastParagraphClipped = false) {
    if (this.options.pedantic) {
      src = src.replace(other.tabCharGlobal, "    ").replace(other.spaceLine, "");
    }
    while (src) {
      let token;
      if (this.options.extensions?.block?.some((extTokenizer) => {
        if (token = extTokenizer.call({ lexer: this }, src, tokens)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          return true;
        }
        return false;
      })) {
        continue;
      }
      if (token = this.tokenizer.space(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (token.raw.length === 1 && lastToken !== void 0) {
          lastToken.raw += "\n";
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (token = this.tokenizer.code(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "paragraph" || lastToken?.type === "text") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.text;
          this.inlineQueue.at(-1).src = lastToken.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (token = this.tokenizer.fences(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.heading(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.hr(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.blockquote(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.list(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.html(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.def(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "paragraph" || lastToken?.type === "text") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.raw;
          this.inlineQueue.at(-1).src = lastToken.text;
        } else if (!this.tokens.links[token.tag]) {
          this.tokens.links[token.tag] = {
            href: token.href,
            title: token.title
          };
        }
        continue;
      }
      if (token = this.tokenizer.table(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.lheading(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      let cutSrc = src;
      if (this.options.extensions?.startBlock) {
        let startIndex = Infinity;
        const tempSrc = src.slice(1);
        let tempStart;
        this.options.extensions.startBlock.forEach((getStartIndex) => {
          tempStart = getStartIndex.call({ lexer: this }, tempSrc);
          if (typeof tempStart === "number" && tempStart >= 0) {
            startIndex = Math.min(startIndex, tempStart);
          }
        });
        if (startIndex < Infinity && startIndex >= 0) {
          cutSrc = src.substring(0, startIndex + 1);
        }
      }
      if (this.state.top && (token = this.tokenizer.paragraph(cutSrc))) {
        const lastToken = tokens.at(-1);
        if (lastParagraphClipped && lastToken?.type === "paragraph") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.text;
          this.inlineQueue.pop();
          this.inlineQueue.at(-1).src = lastToken.text;
        } else {
          tokens.push(token);
        }
        lastParagraphClipped = cutSrc.length !== src.length;
        src = src.substring(token.raw.length);
        continue;
      }
      if (token = this.tokenizer.text(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "text") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.text;
          this.inlineQueue.pop();
          this.inlineQueue.at(-1).src = lastToken.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (src) {
        const errMsg = "Infinite loop on byte: " + src.charCodeAt(0);
        if (this.options.silent) {
          console.error(errMsg);
          break;
        } else {
          throw new Error(errMsg);
        }
      }
    }
    this.state.top = true;
    return tokens;
  }
  inline(src, tokens = []) {
    this.inlineQueue.push({ src, tokens });
    return tokens;
  }
  /**
   * Lexing/Compiling
   */
  inlineTokens(src, tokens = []) {
    let maskedSrc = src;
    let match = null;
    if (this.tokens.links) {
      const links = Object.keys(this.tokens.links);
      if (links.length > 0) {
        while ((match = this.tokenizer.rules.inline.reflinkSearch.exec(maskedSrc)) != null) {
          if (links.includes(match[0].slice(match[0].lastIndexOf("[") + 1, -1))) {
            maskedSrc = maskedSrc.slice(0, match.index) + "[" + "a".repeat(match[0].length - 2) + "]" + maskedSrc.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex);
          }
        }
      }
    }
    while ((match = this.tokenizer.rules.inline.anyPunctuation.exec(maskedSrc)) != null) {
      maskedSrc = maskedSrc.slice(0, match.index) + "++" + maskedSrc.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);
    }
    while ((match = this.tokenizer.rules.inline.blockSkip.exec(maskedSrc)) != null) {
      maskedSrc = maskedSrc.slice(0, match.index) + "[" + "a".repeat(match[0].length - 2) + "]" + maskedSrc.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);
    }
    let keepPrevChar = false;
    let prevChar = "";
    while (src) {
      if (!keepPrevChar) {
        prevChar = "";
      }
      keepPrevChar = false;
      let token;
      if (this.options.extensions?.inline?.some((extTokenizer) => {
        if (token = extTokenizer.call({ lexer: this }, src, tokens)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          return true;
        }
        return false;
      })) {
        continue;
      }
      if (token = this.tokenizer.escape(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.tag(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.link(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.reflink(src, this.tokens.links)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (token.type === "text" && lastToken?.type === "text") {
          lastToken.raw += token.raw;
          lastToken.text += token.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (token = this.tokenizer.emStrong(src, maskedSrc, prevChar)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.codespan(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.br(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.del(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.autolink(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (!this.state.inLink && (token = this.tokenizer.url(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      let cutSrc = src;
      if (this.options.extensions?.startInline) {
        let startIndex = Infinity;
        const tempSrc = src.slice(1);
        let tempStart;
        this.options.extensions.startInline.forEach((getStartIndex) => {
          tempStart = getStartIndex.call({ lexer: this }, tempSrc);
          if (typeof tempStart === "number" && tempStart >= 0) {
            startIndex = Math.min(startIndex, tempStart);
          }
        });
        if (startIndex < Infinity && startIndex >= 0) {
          cutSrc = src.substring(0, startIndex + 1);
        }
      }
      if (token = this.tokenizer.inlineText(cutSrc)) {
        src = src.substring(token.raw.length);
        if (token.raw.slice(-1) !== "_") {
          prevChar = token.raw.slice(-1);
        }
        keepPrevChar = true;
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "text") {
          lastToken.raw += token.raw;
          lastToken.text += token.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (src) {
        const errMsg = "Infinite loop on byte: " + src.charCodeAt(0);
        if (this.options.silent) {
          console.error(errMsg);
          break;
        } else {
          throw new Error(errMsg);
        }
      }
    }
    return tokens;
  }
};
var _Renderer = class {
  options;
  parser;
  // set by the parser
  constructor(options2) {
    this.options = options2 || _defaults;
  }
  space(token) {
    return "";
  }
  code({ text, lang, escaped }) {
    const langString = (lang || "").match(other.notSpaceStart)?.[0];
    const code = text.replace(other.endingNewline, "") + "\n";
    if (!langString) {
      return "<pre><code>" + (escaped ? code : escape2(code, true)) + "</code></pre>\n";
    }
    return '<pre><code class="language-' + escape2(langString) + '">' + (escaped ? code : escape2(code, true)) + "</code></pre>\n";
  }
  blockquote({ tokens }) {
    const body = this.parser.parse(tokens);
    return `<blockquote>
${body}</blockquote>
`;
  }
  html({ text }) {
    return text;
  }
  heading({ tokens, depth }) {
    return `<h${depth}>${this.parser.parseInline(tokens)}</h${depth}>
`;
  }
  hr(token) {
    return "<hr>\n";
  }
  list(token) {
    const ordered = token.ordered;
    const start = token.start;
    let body = "";
    for (let j = 0; j < token.items.length; j++) {
      const item = token.items[j];
      body += this.listitem(item);
    }
    const type = ordered ? "ol" : "ul";
    const startAttr = ordered && start !== 1 ? ' start="' + start + '"' : "";
    return "<" + type + startAttr + ">\n" + body + "</" + type + ">\n";
  }
  listitem(item) {
    let itemBody = "";
    if (item.task) {
      const checkbox = this.checkbox({ checked: !!item.checked });
      if (item.loose) {
        if (item.tokens[0]?.type === "paragraph") {
          item.tokens[0].text = checkbox + " " + item.tokens[0].text;
          if (item.tokens[0].tokens && item.tokens[0].tokens.length > 0 && item.tokens[0].tokens[0].type === "text") {
            item.tokens[0].tokens[0].text = checkbox + " " + escape2(item.tokens[0].tokens[0].text);
            item.tokens[0].tokens[0].escaped = true;
          }
        } else {
          item.tokens.unshift({
            type: "text",
            raw: checkbox + " ",
            text: checkbox + " ",
            escaped: true
          });
        }
      } else {
        itemBody += checkbox + " ";
      }
    }
    itemBody += this.parser.parse(item.tokens, !!item.loose);
    return `<li>${itemBody}</li>
`;
  }
  checkbox({ checked }) {
    return "<input " + (checked ? 'checked="" ' : "") + 'disabled="" type="checkbox">';
  }
  paragraph({ tokens }) {
    return `<p>${this.parser.parseInline(tokens)}</p>
`;
  }
  table(token) {
    let header = "";
    let cell = "";
    for (let j = 0; j < token.header.length; j++) {
      cell += this.tablecell(token.header[j]);
    }
    header += this.tablerow({ text: cell });
    let body = "";
    for (let j = 0; j < token.rows.length; j++) {
      const row = token.rows[j];
      cell = "";
      for (let k = 0; k < row.length; k++) {
        cell += this.tablecell(row[k]);
      }
      body += this.tablerow({ text: cell });
    }
    if (body) body = `<tbody>${body}</tbody>`;
    return "<table>\n<thead>\n" + header + "</thead>\n" + body + "</table>\n";
  }
  tablerow({ text }) {
    return `<tr>
${text}</tr>
`;
  }
  tablecell(token) {
    const content = this.parser.parseInline(token.tokens);
    const type = token.header ? "th" : "td";
    const tag2 = token.align ? `<${type} align="${token.align}">` : `<${type}>`;
    return tag2 + content + `</${type}>
`;
  }
  /**
   * span level renderer
   */
  strong({ tokens }) {
    return `<strong>${this.parser.parseInline(tokens)}</strong>`;
  }
  em({ tokens }) {
    return `<em>${this.parser.parseInline(tokens)}</em>`;
  }
  codespan({ text }) {
    return `<code>${escape2(text, true)}</code>`;
  }
  br(token) {
    return "<br>";
  }
  del({ tokens }) {
    return `<del>${this.parser.parseInline(tokens)}</del>`;
  }
  link({ href, title, tokens }) {
    const text = this.parser.parseInline(tokens);
    const cleanHref = cleanUrl(href);
    if (cleanHref === null) {
      return text;
    }
    href = cleanHref;
    let out = '<a href="' + href + '"';
    if (title) {
      out += ' title="' + escape2(title) + '"';
    }
    out += ">" + text + "</a>";
    return out;
  }
  image({ href, title, text, tokens }) {
    if (tokens) {
      text = this.parser.parseInline(tokens, this.parser.textRenderer);
    }
    const cleanHref = cleanUrl(href);
    if (cleanHref === null) {
      return escape2(text);
    }
    href = cleanHref;
    let out = `<img src="${href}" alt="${text}"`;
    if (title) {
      out += ` title="${escape2(title)}"`;
    }
    out += ">";
    return out;
  }
  text(token) {
    return "tokens" in token && token.tokens ? this.parser.parseInline(token.tokens) : "escaped" in token && token.escaped ? token.text : escape2(token.text);
  }
};
var _TextRenderer = class {
  // no need for block level renderers
  strong({ text }) {
    return text;
  }
  em({ text }) {
    return text;
  }
  codespan({ text }) {
    return text;
  }
  del({ text }) {
    return text;
  }
  html({ text }) {
    return text;
  }
  text({ text }) {
    return text;
  }
  link({ text }) {
    return "" + text;
  }
  image({ text }) {
    return "" + text;
  }
  br() {
    return "";
  }
};
var _Parser = class __Parser {
  options;
  renderer;
  textRenderer;
  constructor(options2) {
    this.options = options2 || _defaults;
    this.options.renderer = this.options.renderer || new _Renderer();
    this.renderer = this.options.renderer;
    this.renderer.options = this.options;
    this.renderer.parser = this;
    this.textRenderer = new _TextRenderer();
  }
  /**
   * Static Parse Method
   */
  static parse(tokens, options2) {
    const parser2 = new __Parser(options2);
    return parser2.parse(tokens);
  }
  /**
   * Static Parse Inline Method
   */
  static parseInline(tokens, options2) {
    const parser2 = new __Parser(options2);
    return parser2.parseInline(tokens);
  }
  /**
   * Parse Loop
   */
  parse(tokens, top = true) {
    let out = "";
    for (let i = 0; i < tokens.length; i++) {
      const anyToken = tokens[i];
      if (this.options.extensions?.renderers?.[anyToken.type]) {
        const genericToken = anyToken;
        const ret = this.options.extensions.renderers[genericToken.type].call({ parser: this }, genericToken);
        if (ret !== false || !["space", "hr", "heading", "code", "table", "blockquote", "list", "html", "paragraph", "text"].includes(genericToken.type)) {
          out += ret || "";
          continue;
        }
      }
      const token = anyToken;
      switch (token.type) {
        case "space": {
          out += this.renderer.space(token);
          continue;
        }
        case "hr": {
          out += this.renderer.hr(token);
          continue;
        }
        case "heading": {
          out += this.renderer.heading(token);
          continue;
        }
        case "code": {
          out += this.renderer.code(token);
          continue;
        }
        case "table": {
          out += this.renderer.table(token);
          continue;
        }
        case "blockquote": {
          out += this.renderer.blockquote(token);
          continue;
        }
        case "list": {
          out += this.renderer.list(token);
          continue;
        }
        case "html": {
          out += this.renderer.html(token);
          continue;
        }
        case "paragraph": {
          out += this.renderer.paragraph(token);
          continue;
        }
        case "text": {
          let textToken = token;
          let body = this.renderer.text(textToken);
          while (i + 1 < tokens.length && tokens[i + 1].type === "text") {
            textToken = tokens[++i];
            body += "\n" + this.renderer.text(textToken);
          }
          if (top) {
            out += this.renderer.paragraph({
              type: "paragraph",
              raw: body,
              text: body,
              tokens: [{ type: "text", raw: body, text: body, escaped: true }]
            });
          } else {
            out += body;
          }
          continue;
        }
        default: {
          const errMsg = 'Token with "' + token.type + '" type was not found.';
          if (this.options.silent) {
            console.error(errMsg);
            return "";
          } else {
            throw new Error(errMsg);
          }
        }
      }
    }
    return out;
  }
  /**
   * Parse Inline Tokens
   */
  parseInline(tokens, renderer = this.renderer) {
    let out = "";
    for (let i = 0; i < tokens.length; i++) {
      const anyToken = tokens[i];
      if (this.options.extensions?.renderers?.[anyToken.type]) {
        const ret = this.options.extensions.renderers[anyToken.type].call({ parser: this }, anyToken);
        if (ret !== false || !["escape", "html", "link", "image", "strong", "em", "codespan", "br", "del", "text"].includes(anyToken.type)) {
          out += ret || "";
          continue;
        }
      }
      const token = anyToken;
      switch (token.type) {
        case "escape": {
          out += renderer.text(token);
          break;
        }
        case "html": {
          out += renderer.html(token);
          break;
        }
        case "link": {
          out += renderer.link(token);
          break;
        }
        case "image": {
          out += renderer.image(token);
          break;
        }
        case "strong": {
          out += renderer.strong(token);
          break;
        }
        case "em": {
          out += renderer.em(token);
          break;
        }
        case "codespan": {
          out += renderer.codespan(token);
          break;
        }
        case "br": {
          out += renderer.br(token);
          break;
        }
        case "del": {
          out += renderer.del(token);
          break;
        }
        case "text": {
          out += renderer.text(token);
          break;
        }
        default: {
          const errMsg = 'Token with "' + token.type + '" type was not found.';
          if (this.options.silent) {
            console.error(errMsg);
            return "";
          } else {
            throw new Error(errMsg);
          }
        }
      }
    }
    return out;
  }
};
var _Hooks = class {
  options;
  block;
  constructor(options2) {
    this.options = options2 || _defaults;
  }
  static passThroughHooks = /* @__PURE__ */ new Set([
    "preprocess",
    "postprocess",
    "processAllTokens"
  ]);
  /**
   * Process markdown before marked
   */
  preprocess(markdown) {
    return markdown;
  }
  /**
   * Process HTML after marked is finished
   */
  postprocess(html2) {
    return html2;
  }
  /**
   * Process all tokens before walk tokens
   */
  processAllTokens(tokens) {
    return tokens;
  }
  /**
   * Provide function to tokenize markdown
   */
  provideLexer() {
    return this.block ? _Lexer.lex : _Lexer.lexInline;
  }
  /**
   * Provide function to parse tokens
   */
  provideParser() {
    return this.block ? _Parser.parse : _Parser.parseInline;
  }
};
var Marked = class {
  defaults = _getDefaults();
  options = this.setOptions;
  parse = this.parseMarkdown(true);
  parseInline = this.parseMarkdown(false);
  Parser = _Parser;
  Renderer = _Renderer;
  TextRenderer = _TextRenderer;
  Lexer = _Lexer;
  Tokenizer = _Tokenizer;
  Hooks = _Hooks;
  constructor(...args) {
    this.use(...args);
  }
  /**
   * Run callback for every token
   */
  walkTokens(tokens, callback) {
    let values = [];
    for (const token of tokens) {
      values = values.concat(callback.call(this, token));
      switch (token.type) {
        case "table": {
          const tableToken = token;
          for (const cell of tableToken.header) {
            values = values.concat(this.walkTokens(cell.tokens, callback));
          }
          for (const row of tableToken.rows) {
            for (const cell of row) {
              values = values.concat(this.walkTokens(cell.tokens, callback));
            }
          }
          break;
        }
        case "list": {
          const listToken = token;
          values = values.concat(this.walkTokens(listToken.items, callback));
          break;
        }
        default: {
          const genericToken = token;
          if (this.defaults.extensions?.childTokens?.[genericToken.type]) {
            this.defaults.extensions.childTokens[genericToken.type].forEach((childTokens) => {
              const tokens2 = genericToken[childTokens].flat(Infinity);
              values = values.concat(this.walkTokens(tokens2, callback));
            });
          } else if (genericToken.tokens) {
            values = values.concat(this.walkTokens(genericToken.tokens, callback));
          }
        }
      }
    }
    return values;
  }
  use(...args) {
    const extensions = this.defaults.extensions || { renderers: {}, childTokens: {} };
    args.forEach((pack) => {
      const opts = { ...pack };
      opts.async = this.defaults.async || opts.async || false;
      if (pack.extensions) {
        pack.extensions.forEach((ext) => {
          if (!ext.name) {
            throw new Error("extension name required");
          }
          if ("renderer" in ext) {
            const prevRenderer = extensions.renderers[ext.name];
            if (prevRenderer) {
              extensions.renderers[ext.name] = function(...args2) {
                let ret = ext.renderer.apply(this, args2);
                if (ret === false) {
                  ret = prevRenderer.apply(this, args2);
                }
                return ret;
              };
            } else {
              extensions.renderers[ext.name] = ext.renderer;
            }
          }
          if ("tokenizer" in ext) {
            if (!ext.level || ext.level !== "block" && ext.level !== "inline") {
              throw new Error("extension level must be 'block' or 'inline'");
            }
            const extLevel = extensions[ext.level];
            if (extLevel) {
              extLevel.unshift(ext.tokenizer);
            } else {
              extensions[ext.level] = [ext.tokenizer];
            }
            if (ext.start) {
              if (ext.level === "block") {
                if (extensions.startBlock) {
                  extensions.startBlock.push(ext.start);
                } else {
                  extensions.startBlock = [ext.start];
                }
              } else if (ext.level === "inline") {
                if (extensions.startInline) {
                  extensions.startInline.push(ext.start);
                } else {
                  extensions.startInline = [ext.start];
                }
              }
            }
          }
          if ("childTokens" in ext && ext.childTokens) {
            extensions.childTokens[ext.name] = ext.childTokens;
          }
        });
        opts.extensions = extensions;
      }
      if (pack.renderer) {
        const renderer = this.defaults.renderer || new _Renderer(this.defaults);
        for (const prop in pack.renderer) {
          if (!(prop in renderer)) {
            throw new Error(`renderer '${prop}' does not exist`);
          }
          if (["options", "parser"].includes(prop)) {
            continue;
          }
          const rendererProp = prop;
          const rendererFunc = pack.renderer[rendererProp];
          const prevRenderer = renderer[rendererProp];
          renderer[rendererProp] = (...args2) => {
            let ret = rendererFunc.apply(renderer, args2);
            if (ret === false) {
              ret = prevRenderer.apply(renderer, args2);
            }
            return ret || "";
          };
        }
        opts.renderer = renderer;
      }
      if (pack.tokenizer) {
        const tokenizer = this.defaults.tokenizer || new _Tokenizer(this.defaults);
        for (const prop in pack.tokenizer) {
          if (!(prop in tokenizer)) {
            throw new Error(`tokenizer '${prop}' does not exist`);
          }
          if (["options", "rules", "lexer"].includes(prop)) {
            continue;
          }
          const tokenizerProp = prop;
          const tokenizerFunc = pack.tokenizer[tokenizerProp];
          const prevTokenizer = tokenizer[tokenizerProp];
          tokenizer[tokenizerProp] = (...args2) => {
            let ret = tokenizerFunc.apply(tokenizer, args2);
            if (ret === false) {
              ret = prevTokenizer.apply(tokenizer, args2);
            }
            return ret;
          };
        }
        opts.tokenizer = tokenizer;
      }
      if (pack.hooks) {
        const hooks = this.defaults.hooks || new _Hooks();
        for (const prop in pack.hooks) {
          if (!(prop in hooks)) {
            throw new Error(`hook '${prop}' does not exist`);
          }
          if (["options", "block"].includes(prop)) {
            continue;
          }
          const hooksProp = prop;
          const hooksFunc = pack.hooks[hooksProp];
          const prevHook = hooks[hooksProp];
          if (_Hooks.passThroughHooks.has(prop)) {
            hooks[hooksProp] = (arg) => {
              if (this.defaults.async) {
                return Promise.resolve(hooksFunc.call(hooks, arg)).then((ret2) => {
                  return prevHook.call(hooks, ret2);
                });
              }
              const ret = hooksFunc.call(hooks, arg);
              return prevHook.call(hooks, ret);
            };
          } else {
            hooks[hooksProp] = (...args2) => {
              let ret = hooksFunc.apply(hooks, args2);
              if (ret === false) {
                ret = prevHook.apply(hooks, args2);
              }
              return ret;
            };
          }
        }
        opts.hooks = hooks;
      }
      if (pack.walkTokens) {
        const walkTokens2 = this.defaults.walkTokens;
        const packWalktokens = pack.walkTokens;
        opts.walkTokens = function(token) {
          let values = [];
          values.push(packWalktokens.call(this, token));
          if (walkTokens2) {
            values = values.concat(walkTokens2.call(this, token));
          }
          return values;
        };
      }
      this.defaults = { ...this.defaults, ...opts };
    });
    return this;
  }
  setOptions(opt) {
    this.defaults = { ...this.defaults, ...opt };
    return this;
  }
  lexer(src, options2) {
    return _Lexer.lex(src, options2 ?? this.defaults);
  }
  parser(tokens, options2) {
    return _Parser.parse(tokens, options2 ?? this.defaults);
  }
  parseMarkdown(blockType) {
    const parse2 = (src, options2) => {
      const origOpt = { ...options2 };
      const opt = { ...this.defaults, ...origOpt };
      const throwError = this.onError(!!opt.silent, !!opt.async);
      if (this.defaults.async === true && origOpt.async === false) {
        return throwError(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
      }
      if (typeof src === "undefined" || src === null) {
        return throwError(new Error("marked(): input parameter is undefined or null"));
      }
      if (typeof src !== "string") {
        return throwError(new Error("marked(): input parameter is of type " + Object.prototype.toString.call(src) + ", string expected"));
      }
      if (opt.hooks) {
        opt.hooks.options = opt;
        opt.hooks.block = blockType;
      }
      const lexer2 = opt.hooks ? opt.hooks.provideLexer() : blockType ? _Lexer.lex : _Lexer.lexInline;
      const parser2 = opt.hooks ? opt.hooks.provideParser() : blockType ? _Parser.parse : _Parser.parseInline;
      if (opt.async) {
        return Promise.resolve(opt.hooks ? opt.hooks.preprocess(src) : src).then((src2) => lexer2(src2, opt)).then((tokens) => opt.hooks ? opt.hooks.processAllTokens(tokens) : tokens).then((tokens) => opt.walkTokens ? Promise.all(this.walkTokens(tokens, opt.walkTokens)).then(() => tokens) : tokens).then((tokens) => parser2(tokens, opt)).then((html2) => opt.hooks ? opt.hooks.postprocess(html2) : html2).catch(throwError);
      }
      try {
        if (opt.hooks) {
          src = opt.hooks.preprocess(src);
        }
        let tokens = lexer2(src, opt);
        if (opt.hooks) {
          tokens = opt.hooks.processAllTokens(tokens);
        }
        if (opt.walkTokens) {
          this.walkTokens(tokens, opt.walkTokens);
        }
        let html2 = parser2(tokens, opt);
        if (opt.hooks) {
          html2 = opt.hooks.postprocess(html2);
        }
        return html2;
      } catch (e) {
        return throwError(e);
      }
    };
    return parse2;
  }
  onError(silent, async) {
    return (e) => {
      e.message += "\nPlease report this to https://github.com/markedjs/marked.";
      if (silent) {
        const msg = "<p>An error occurred:</p><pre>" + escape2(e.message + "", true) + "</pre>";
        if (async) {
          return Promise.resolve(msg);
        }
        return msg;
      }
      if (async) {
        return Promise.reject(e);
      }
      throw e;
    };
  }
};
var markedInstance = new Marked();
function marked(src, opt) {
  return markedInstance.parse(src, opt);
}
marked.options = marked.setOptions = function(options2) {
  markedInstance.setOptions(options2);
  marked.defaults = markedInstance.defaults;
  changeDefaults(marked.defaults);
  return marked;
};
marked.getDefaults = _getDefaults;
marked.defaults = _defaults;
marked.use = function(...args) {
  markedInstance.use(...args);
  marked.defaults = markedInstance.defaults;
  changeDefaults(marked.defaults);
  return marked;
};
marked.walkTokens = function(tokens, callback) {
  return markedInstance.walkTokens(tokens, callback);
};
marked.parseInline = markedInstance.parseInline;
marked.Parser = _Parser;
marked.parser = _Parser.parse;
marked.Renderer = _Renderer;
marked.TextRenderer = _TextRenderer;
marked.Lexer = _Lexer;
marked.lexer = _Lexer.lex;
marked.Tokenizer = _Tokenizer;
marked.Hooks = _Hooks;
marked.parse = marked;
var options = marked.options;
var setOptions = marked.setOptions;
var use = marked.use;
var walkTokens = marked.walkTokens;
var parseInline = marked.parseInline;
var parser = _Parser.parse;
var lexer = _Lexer.lex;

// src/util/description.js
var DEFAULT_ALLOWED_TAGS = Object.freeze([
  "p",
  "a",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
  "br",
  "img",
  "blockquote",
  "code",
  "pre",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6"
]);
var DEFAULT_ALLOWED_ATTRS = deepFreezeRecord({
  a: ["href", "target", "rel"],
  img: ["src", "alt"]
});
var FORCED_BLANK_REL_TOKENS = Object.freeze(["noopener", "noreferrer"]);
var DEFAULT_ALLOWED_URL_SCHEMES = deepFreezeRecord({
  a: ["http", "https", "mailto", "tel"],
  img: ["http", "https"]
});
var DEFAULT_RAW_TEXT_ELEMENTS = Object.freeze([
  "script",
  "style",
  "noscript",
  "template",
  "textarea"
]);
var RAW_TEXT_ELEMENTS_SET = new Set(DEFAULT_RAW_TEXT_ELEMENTS);
var HTML_TAG_RE = /<\/?[a-z][a-z0-9]*[\s>]/i;
var MARKDOWN_RE = /(?:^|\n)#{1,6}\s|(?:^|\n)[-*]\s|\*\*|__|\[[^[\]\n]{1,500}\]\([^[)\n]{1,2000}\)/;
function detectFormat(text) {
  if (!text) return "plain";
  if (HTML_TAG_RE.test(text)) return "html";
  if (MARKDOWN_RE.test(text)) return "markdown";
  return "plain";
}
function deepFreezeRecord(obj) {
  for (const key of Object.keys(obj)) {
    if (Array.isArray(obj[key])) Object.freeze(obj[key]);
  }
  return Object.freeze(obj);
}
var SCRIPT_STYLE_OPEN_RE = /<(script|style)\b[^<>]*>/gi;
function stripScriptStyle(html2) {
  const lower = html2.toLowerCase();
  let out = "";
  let cursor = 0;
  SCRIPT_STYLE_OPEN_RE.lastIndex = 0;
  let match = SCRIPT_STYLE_OPEN_RE.exec(html2);
  while (match !== null) {
    const name = match[1].toLowerCase();
    const openEnd = SCRIPT_STYLE_OPEN_RE.lastIndex;
    const closerIdx = lower.indexOf(`</${name}`, openEnd);
    if (closerIdx === -1) {
      out += html2.slice(cursor, match.index);
      cursor = html2.length;
      break;
    }
    const closeTagEnd = html2.indexOf(">", closerIdx);
    const afterClose = closeTagEnd === -1 ? html2.length : closeTagEnd + 1;
    out += html2.slice(cursor, match.index);
    cursor = afterClose;
    SCRIPT_STYLE_OPEN_RE.lastIndex = cursor;
    match = SCRIPT_STYLE_OPEN_RE.exec(html2);
  }
  return out + html2.slice(cursor);
}
var BLOCK_TAG_RE = /<\/?(?:br|p|div|li|ul|ol|tr|td|h[1-6]|blockquote|hr)\b[^<>]*>/gi;
var TAG_RE = /<[^<>]*>/g;
function stripHtml(html2) {
  return stripScriptStyle(html2).replace(BLOCK_TAG_RE, " ").replace(TAG_RE, "");
}
var MARKDOWN_PARSE_LIMIT = 1e3;
function markdownToHtmlBounded(text) {
  if (text.length <= MARKDOWN_PARSE_LIMIT) return marked.parse(text);
  const head = text.slice(0, MARKDOWN_PARSE_LIMIT);
  let cut = head.lastIndexOf("\n");
  if (cut <= 0) cut = head.lastIndexOf(" ");
  if (cut <= 0) {
    cut = MARKDOWN_PARSE_LIMIT;
    const code = text.charCodeAt(cut - 1);
    if (code >= 55296 && code <= 56319) cut -= 1;
  }
  return `${marked.parse(text.slice(0, cut))}
${text.slice(cut)}`;
}
function plainTextDescription(event) {
  const text = typeof event?.description === "string" ? event.description : "";
  if (!text) return "";
  const format = event.descriptionFormat ?? detectFormat(text);
  const html2 = format === "markdown" ? markdownToHtmlBounded(text) : text;
  const stripped = format === "plain" ? html2 : stripHtml(html2);
  return decodeHtmlEntities(stripped).replace(/\s+/g, " ").trim();
}

// src/util/directives.js
var DIRECTIVE_PATTERN = /#already:([^\s<>]+)/gi;
var DIRECTIVE_PLATFORMS = {
  instagram: {
    label: (v) => `Follow @${v} on Instagram`,
    canonicalPrefix: "instagram",
    url: (v) => `https://instagram.com/${v}`
  },
  facebook: {
    label: (v) => `${v} on Facebook`,
    canonicalPrefix: "facebook",
    url: (v) => `https://facebook.com/${v}`
  },
  x: {
    label: (v) => `Follow @${v} on X`,
    canonicalPrefix: "x",
    url: (v) => `https://x.com/${v}`
  },
  twitter: {
    label: (v) => `Follow @${v} on X`,
    canonicalPrefix: "x",
    url: (v) => `https://x.com/${v}`
  },
  reddit: {
    label: (v) => `r/${v} on Reddit`,
    canonicalPrefix: "reddit",
    url: (v) => `https://reddit.com/r/${v}`
  },
  youtube: {
    label: () => "Watch on YouTube",
    canonicalPrefix: "youtube",
    url: (v) => `https://youtube.com/${v}`
  },
  tiktok: {
    label: (v) => `@${v} on TikTok`,
    canonicalPrefix: "tiktok",
    url: (v) => `https://tiktok.com/@${v}`
  },
  linkedin: {
    label: () => "View on LinkedIn",
    canonicalPrefix: "linkedin",
    url: (v) => `https://linkedin.com/in/${v}`
  },
  discord: {
    label: () => "Join Discord",
    canonicalPrefix: "discord",
    url: (v) => `https://discord.gg/${v}`
  },
  zoom: {
    label: () => "Join Zoom",
    canonicalPrefix: "zoom",
    url: (v) => `https://zoom.us/j/${v}`
  },
  googlemeet: {
    label: () => "Join Google Meet",
    canonicalPrefix: "googlemeet",
    url: (v) => `https://meet.google.com/${v}`
  },
  meet: {
    label: () => "Join Google Meet",
    canonicalPrefix: "googlemeet",
    url: (v) => `https://meet.google.com/${v}`
  },
  eventbrite: {
    label: () => "RSVP on Eventbrite",
    canonicalPrefix: "eventbrite",
    url: (v) => `https://eventbrite.com/e/${v}`
  },
  luma: {
    label: () => "RSVP on Luma",
    canonicalPrefix: "luma",
    url: (v) => `https://lu.ma/${v}`
  },
  mobilize: {
    label: () => "RSVP on Mobilize",
    canonicalPrefix: "mobilize",
    url: (v) => `https://mobilize.us/${v}`
  },
  actionnetwork: {
    label: () => "Take Action",
    canonicalPrefix: "actionnetwork",
    url: (v) => `https://actionnetwork.org/${v}`
  },
  gofundme: {
    label: () => "Donate on GoFundMe",
    canonicalPrefix: "gofundme",
    url: (v) => `https://gofundme.com/f/${v}`
  },
  partiful: {
    label: () => "RSVP on Partiful",
    canonicalPrefix: "partiful",
    url: (v) => `https://partiful.com/e/${v}`
  },
  googleforms: {
    label: () => "Fill Out Form",
    canonicalPrefix: "googleforms",
    url: (v) => `https://docs.google.com/forms/d/e/${v}/viewform`
  },
  forms: {
    label: () => "Fill Out Form",
    canonicalPrefix: "googleforms",
    url: (v) => `https://docs.google.com/forms/d/e/${v}/viewform`
  },
  googlemaps: {
    label: () => "View on Map",
    canonicalPrefix: "googlemaps",
    url: (v) => `https://maps.google.com/?q=${v}`
  },
  maps: {
    label: () => "View on Map",
    canonicalPrefix: "googlemaps",
    url: (v) => `https://maps.google.com/?q=${v}`
  }
};
function parseDirective(body) {
  const colonIdx = body.indexOf(":");
  if (colonIdx === -1) return null;
  const type = body.slice(0, colonIdx).toLowerCase();
  const value = body.slice(colonIdx + 1);
  if (!value) return null;
  const platform = DIRECTIVE_PLATFORMS[type];
  if (platform) {
    return {
      canonicalId: `${platform.canonicalPrefix}:${value}`,
      type: "link",
      source: "directive",
      url: platform.url(value),
      label: platform.label(value),
      metadata: {}
    };
  }
  if (type === "image") {
    const driveMatch = value.match(/^drive:(.+)$/);
    if (driveMatch) {
      const driveId = driveMatch[1];
      return {
        canonicalId: `image:drive:${driveId}`,
        type: "image",
        source: "directive",
        url: `https://lh3.googleusercontent.com/d/${driveId}`,
        label: "",
        metadata: {}
      };
    }
    const isUrl = value.startsWith("http://") || value.startsWith("https://");
    const url = isUrl ? normalizeImageUrl(value) : null;
    return {
      canonicalId: isUrl ? imageCanonicalId(value) : `image:${value}`,
      type: "image",
      source: "directive",
      url: url || value,
      label: "",
      metadata: {}
    };
  }
  if (type === "tag") {
    return {
      canonicalId: `tag:${value}`,
      type: "tag",
      source: "directive",
      url: null,
      label: value,
      metadata: { key: "tag", value }
    };
  }
  return {
    canonicalId: `tag:${type}:${value}`,
    type: "tag",
    source: "directive",
    url: value.startsWith("http") ? value : null,
    label: `${type}: ${value}`,
    metadata: { key: type, value }
  };
}
function extractDirectives(description) {
  if (!description)
    return { tokens: [], description, featured: false, hidden: false };
  description = decodeAmp(description);
  const tokens = [];
  const seen = /* @__PURE__ */ new Set();
  let featured = false;
  let hidden = false;
  const matches = [...description.matchAll(DIRECTIVE_PATTERN)];
  for (const match of matches) {
    const body = match[1];
    const bodyLower = body.toLowerCase();
    if (bodyLower === "featured") {
      featured = true;
      continue;
    }
    if (bodyLower === "hidden") {
      hidden = true;
      continue;
    }
    const token = parseDirective(body);
    if (!token) continue;
    if (!seen.has(token.canonicalId)) {
      seen.add(token.canonicalId);
      tokens.push(token);
    }
  }
  const cleaned = cleanupHtml(
    stripMatches(
      description,
      matches.map((m) => ({ index: m.index, text: m[0] }))
    )
  );
  return { tokens, description: cleaned, featured, hidden };
}

// src/data.js
function enrichEvent(event, config) {
  let description = event.description || "";
  let image = event.image || null;
  let images = event.images && event.images.length > 0 ? event.images : [];
  let links = event.links && event.links.length > 0 ? event.links : [];
  let featured = event.featured || false;
  let hidden = event.hidden || false;
  const tokenSet = new TokenSet();
  description = stripComments(description);
  if (description) {
    const result = extractDirectives(description);
    description = result.description;
    tokenSet.addAll(result.tokens);
    if (result.featured) featured = true;
    if (result.hidden) hidden = true;
  }
  if (images.length === 0 && description) {
    const result = extractImageTokens(description, config);
    description = result.description;
    tokenSet.addAll(result.tokens);
  }
  const attachmentImages = getImagesFromAttachments(
    event._imageAttachments || event.attachments
  );
  if (attachmentImages.length > 0) {
    const imgTokens = tokenSet.ofType("image");
    const existing = new Set(imgTokens.map((t) => t.url));
    for (const ai of attachmentImages) {
      if (!existing.has(ai)) {
        tokenSet.add({
          canonicalId: `image:attachment:${ai}`,
          type: "image",
          source: "url",
          url: ai,
          label: "",
          metadata: {}
        });
      }
    }
  }
  if (links.length === 0 && description) {
    const result = extractLinkTokens(description, config);
    description = result.description;
    tokenSet.addAll(result.tokens);
  }
  let attachments = event.attachments && event.attachments.length > 0 ? event.attachments : [];
  if (description) {
    const result = extractAttachmentTokens(description, config);
    if (result.tokens.length > 0) {
      tokenSet.addAll(result.tokens);
      description = result.description;
    }
  }
  const imageTokens = tokenSet.ofType("image");
  if (imageTokens.length > 0 && images.length === 0) {
    images = imageTokens.map((t) => t.url);
  }
  if (!image && images.length > 0) image = images[0];
  const linkTokens = tokenSet.ofType("link");
  if (linkTokens.length > 0 && links.length === 0) {
    links = linkTokens.map((t) => ({ label: t.label, url: t.url || "" }));
  }
  const attachmentTokens = tokenSet.ofType("attachment");
  if (attachmentTokens.length > 0) {
    const tokenAttachments = attachmentTokens.map((t) => ({
      label: t.label,
      url: t.url,
      type: t.metadata.fileType || "file"
    }));
    attachments = [...attachments, ...tokenAttachments];
  }
  const tagTokens = tokenSet.ofType("tag");
  const existingTags = event.tags || [];
  const tags = [
    ...existingTags,
    ...tagTokens.map((t) => ({ key: t.metadata.key, value: t.metadata.value }))
  ];
  const descriptionFormat = event.descriptionFormat || detectFormat(description);
  const { _imageAttachments, ...rest } = event;
  return {
    ...rest,
    description,
    descriptionFormat,
    image,
    images,
    links,
    attachments,
    tags,
    featured,
    hidden,
    htmlLink: event.htmlLink || ""
  };
}
function getImagesFromAttachments(attachments) {
  if (!attachments) return [];
  return attachments.filter((a) => a.mimeType?.startsWith("image/")).map((a) => normalizeImageUrl(a.fileUrl || a.url)).filter(Boolean);
}
function enrichGoogleEvent(item, config) {
  const apiAttachments = [];
  const imageAttachments = [];
  for (const a of item.attachments || []) {
    if (a.mimeType?.startsWith("image/")) {
      imageAttachments.push({ mimeType: a.mimeType, url: a.fileUrl });
    } else {
      const type = deriveTypeFromMimeType(a.mimeType);
      apiAttachments.push({
        label: a.title || labelForType(type),
        url: a.fileUrl,
        type
      });
    }
  }
  return enrichEvent(
    {
      id: item.id,
      title: item.summary || "Untitled Event",
      description: item.description || "",
      location: item.location || "",
      start: item.start?.dateTime || item.start?.date || "",
      end: item.end?.dateTime || item.end?.date || "",
      allDay: !item.start?.dateTime,
      image: null,
      images: [],
      links: [],
      htmlLink: item.htmlLink || "",
      attachments: apiAttachments,
      _imageAttachments: imageAttachments,
      _sourceTimeZone: item._sourceTimeZone
    },
    config
  );
}
export {
  CONTENT_DEFAULTS,
  enrichGoogleEvent,
  plainTextDescription
};
