import {
  deriveTypeFromMimeType,
  extractAttachmentTokens,
  labelForType,
} from "./util/attachments.js";
import { detectFormat } from "./util/description.js";
import { extractDirectives } from "./util/directives.js";
import { extractImageTokens, normalizeImageUrl } from "./util/images.js";
import { extractLinkTokens } from "./util/links.js";
import { TokenSet } from "./util/tokens.js";

/** Load event data from the configured source (pre-loaded, fetch URL, or Google Calendar API). */
export async function loadData(config) {
  let data;

  // Mode 1: Pre-loaded data
  if (config.data) {
    // Auto-detect raw Google Calendar API response (has `items` instead of `events`)
    if (config.data.items && !config.data.events) {
      data = transformGoogleEvents(config.data, config);
    } else {
      data = config.data;
    }
  }
  // Mode 2: Fetch from URL
  else if (config.fetchUrl) {
    const res = await fetch(config.fetchUrl);
    if (!res.ok) throw new Error(`Failed to fetch events: ${res.status}`);
    data = await res.json();
  }
  // Mode 3: Direct Google Calendar API
  else if (config.google) {
    data = await fetchGoogleCalendar(config.google, config);
  } else {
    throw new Error(
      "already-cal: No data source configured. Provide data, fetchUrl, or google config.",
    );
  }

  // Enrich events: extract images/links from descriptions for all data sources
  if (data.events) {
    data = {
      ...data,
      events: data.events.map((event) => enrichEvent(event, config)),
    };
  }

  // Apply eventTransform
  if (config.eventTransform && data.events) {
    data = { ...data, events: data.events.map(config.eventTransform) };
  }

  // Apply eventFilter
  if (config.eventFilter && data.events) {
    data = { ...data, events: data.events.filter(config.eventFilter) };
  }

  return data;
}

/** Enrich a raw event: extract directives, images, links, attachments, and tags from description. */
export function enrichEvent(event, config) {
  let description = event.description || "";
  let image = event.image || null;
  let images = event.images && event.images.length > 0 ? event.images : [];
  let links = event.links && event.links.length > 0 ? event.links : [];
  let featured = event.featured || false;
  let hidden = event.hidden || false;

  const tokenSet = new TokenSet();

  // Step 1: Extract directives (#already: syntax)
  if (description) {
    const result = extractDirectives(description);
    description = result.description;
    tokenSet.addAll(result.tokens);
    if (result.featured) featured = true;
    if (result.hidden) hidden = true;
  }

  // Step 2: Extract images from description if not already set
  if (images.length === 0 && description) {
    const result = extractImageTokens(description, config);
    description = result.description;
    tokenSet.addAll(result.tokens);
  }

  // Fallback: check attachments for images
  const attachmentImages = getImagesFromAttachments(
    event._imageAttachments || event.attachments,
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
          metadata: {},
        });
      }
    }
  }

  // Step 3: Extract links from description if not already populated
  if (links.length === 0 && description) {
    const result = extractLinkTokens(description, config);
    description = result.description;
    tokenSet.addAll(result.tokens);
  }

  // Step 4: Extract file attachments from description
  let attachments =
    event.attachments && event.attachments.length > 0 ? event.attachments : [];
  if (description) {
    const result = extractAttachmentTokens(description, config);
    if (result.tokens.length > 0) {
      tokenSet.addAll(result.tokens);
      description = result.description;
    }
  }

  // Build output arrays from token set
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
      type: t.metadata.fileType || "file",
    }));
    attachments = [...attachments, ...tokenAttachments];
  }

  // Build tags from tag tokens, merging with any existing tags
  const tagTokens = tokenSet.ofType("tag");
  const existingTags = event.tags || [];
  const tags = [
    ...existingTags,
    ...tagTokens.map((t) => ({ key: t.metadata.key, value: t.metadata.value })),
  ];

  // Detect format if not set
  const descriptionFormat =
    event.descriptionFormat || detectFormat(description);

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
  };
}

async function fetchGoogleCalendar(
  { apiKey, calendarId, maxResults = 50 },
  config,
) {
  const now = new Date().toISOString();
  const url =
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events` +
    `?key=${apiKey}&timeMin=${now}&singleEvents=true&orderBy=startTime&maxResults=${maxResults}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Calendar API error: ${res.status}`);
  const data = await res.json();
  return transformGoogleEvents(data, config);
}

function getImagesFromAttachments(attachments) {
  if (!attachments) return [];
  return attachments
    .filter((a) => a.mimeType?.startsWith("image/"))
    .map((a) => normalizeImageUrl(a.fileUrl || a.url))
    .filter(Boolean);
}

/** Transform raw Google Calendar API response into already-cal data format. */
export function transformGoogleEvents(googleData, config) {
  const events = (googleData.items || []).map((item) => {
    // Separate image attachments from file attachments.
    // Image attachments keep mimeType so getImagesFromAttachments can process them.
    // File attachments get normalized to {label, url, type} schema.
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
          type,
        });
      }
    }

    // Build base event shape — enrichEvent handles description extraction.
    // _imageAttachments is internal, stripped by enrichEvent before returning.
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
      },
      config,
    );
  });

  return {
    events,
    calendar: {
      name: googleData.summary || "",
      description: googleData.description || "",
      timezone: googleData.timeZone || "UTC",
    },
    generated: new Date().toISOString(),
  };
}
