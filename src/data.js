import { extractImage, normalizeImageUrl } from './util/images.js';
import { extractLinks } from './util/links.js';
import { detectFormat } from './util/description.js';

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
  }
  else {
    throw new Error('og-cal: No data source configured. Provide data, fetchUrl, or google config.');
  }

  // Enrich events: extract images/links from descriptions for all data sources
  if (data.events) {
    data = { ...data, events: data.events.map(event => enrichEvent(event, config)) };
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

function enrichEvent(event, config) {
  let description = event.description || '';
  let image = event.image || null;
  let images = (event.images && event.images.length > 0) ? event.images : [];
  let links = (event.links && event.links.length > 0) ? event.links : [];

  // Extract images from description if not already set
  if (images.length === 0 && description) {
    const result = extractImage(description, config);
    image = result.image;
    images = result.images;
    description = result.description;
  }

  // Fallback: check attachments for images
  const attachmentImages = getImagesFromAttachments(event.attachments);
  if (attachmentImages.length > 0) {
    // Append attachment images that aren't already in the list
    const existing = new Set(images);
    for (const ai of attachmentImages) {
      if (!existing.has(ai)) {
        images.push(ai);
      }
    }
  }

  // Set primary image
  if (!image && images.length > 0) image = images[0];

  // Extract links from description if not already populated
  if (links.length === 0 && description) {
    const result = extractLinks(description, config);
    links = result.links;
    description = result.description;
  }

  // Detect format if not set
  const descriptionFormat = event.descriptionFormat || detectFormat(description);

  return { ...event, description, descriptionFormat, image, images, links };
}

async function fetchGoogleCalendar({ apiKey, calendarId, maxResults = 50 }, config) {
  const now = new Date().toISOString();
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
    + `?key=${apiKey}&timeMin=${now}&singleEvents=true&orderBy=startTime&maxResults=${maxResults}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Calendar API error: ${res.status}`);
  const data = await res.json();
  return transformGoogleEvents(data, config);
}

function getImagesFromAttachments(attachments) {
  if (!attachments) return [];
  return attachments
    .filter(a => a.mimeType && a.mimeType.startsWith('image/'))
    .map(a => normalizeImageUrl(a.fileUrl || a.url))
    .filter(Boolean);
}

export function transformGoogleEvents(googleData, config) {
  const events = (googleData.items || []).map(item => {
    let description = item.description || '';
    const { image, images, description: descAfterImage } = extractImage(description, config);
    const { links, description: descAfterLinks } = extractLinks(descAfterImage, config);

    const attachmentImages = getImagesFromAttachments(
      (item.attachments || []).map(a => ({ ...a, url: a.fileUrl }))
    );
    const allImages = [...images];
    const existing = new Set(allImages);
    for (const ai of attachmentImages) {
      if (!existing.has(ai)) allImages.push(ai);
    }

    return {
      id: item.id,
      title: item.summary || 'Untitled Event',
      description: descAfterLinks,
      descriptionFormat: detectFormat(descAfterLinks),
      location: item.location || '',
      start: item.start?.dateTime || item.start?.date || '',
      end: item.end?.dateTime || item.end?.date || '',
      allDay: !item.start?.dateTime,
      image: image || allImages[0] || null,
      images: allImages,
      links,
      attachments: (item.attachments || []).map(a => ({
        title: a.title,
        url: a.fileUrl,
        mimeType: a.mimeType,
      })),
    };
  });

  return {
    events,
    calendar: {
      name: googleData.summary || '',
      description: googleData.description || '',
      timezone: googleData.timeZone || 'UTC',
    },
    generated: new Date().toISOString(),
  };
}
