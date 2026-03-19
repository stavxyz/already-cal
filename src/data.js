import { extractImage } from './util/images.js';
import { extractLinks } from './util/links.js';
import { detectFormat } from './util/description.js';

export async function loadData(config) {
  let data;

  // Mode 1: Pre-loaded data
  if (config.data) {
    data = config.data;
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

async function fetchGoogleCalendar({ apiKey, calendarId, maxResults = 50 }, config) {
  const now = new Date().toISOString();
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
    + `?key=${apiKey}&timeMin=${now}&singleEvents=true&orderBy=startTime&maxResults=${maxResults}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Calendar API error: ${res.status}`);
  const data = await res.json();
  return transformGoogleEvents(data, config);
}

function getImageFromAttachments(attachments) {
  if (!attachments) return null;
  const imageAttachment = attachments.find(a =>
    a.mimeType && a.mimeType.startsWith('image/')
  );
  return imageAttachment ? imageAttachment.fileUrl : null;
}

export function transformGoogleEvents(googleData, config) {
  const events = (googleData.items || []).map(item => {
    let description = item.description || '';
    const { image, description: descAfterImage } = extractImage(description, config);
    const { links, description: descAfterLinks } = extractLinks(descAfterImage, config);

    return {
      id: item.id,
      title: item.summary || 'Untitled Event',
      description: descAfterLinks,
      descriptionFormat: detectFormat(descAfterLinks),
      location: item.location || '',
      start: item.start?.dateTime || item.start?.date || '',
      end: item.end?.dateTime || item.end?.date || '',
      allDay: !item.start?.dateTime,
      image: image || getImageFromAttachments(item.attachments),
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
      timezone: googleData.timeZone || 'UTC',
    },
    generated: new Date().toISOString(),
  };
}
