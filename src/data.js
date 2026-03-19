import { extractImage } from './util/images.js';
import { extractLinks } from './util/links.js';
import { detectFormat } from './util/description.js';

export async function loadData(config) {
  // Mode 1: Pre-loaded data
  if (config.data) {
    return config.data;
  }

  // Mode 2: Fetch from URL
  if (config.fetchUrl) {
    const res = await fetch(config.fetchUrl);
    if (!res.ok) throw new Error(`Failed to fetch events: ${res.status}`);
    return await res.json();
  }

  // Mode 3: Direct Google Calendar API
  if (config.google) {
    return await fetchGoogleCalendar(config.google);
  }

  throw new Error('og-cal: No data source configured. Provide data, fetchUrl, or google config.');
}

async function fetchGoogleCalendar({ apiKey, calendarId, maxResults = 50 }) {
  const now = new Date().toISOString();
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
    + `?key=${apiKey}&timeMin=${now}&singleEvents=true&orderBy=startTime&maxResults=${maxResults}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Calendar API error: ${res.status}`);
  const data = await res.json();
  return transformGoogleEvents(data);
}

export function transformGoogleEvents(googleData) {
  const events = (googleData.items || []).map(item => {
    let description = item.description || '';
    const { image, description: descAfterImage } = extractImage(description);
    const { links, description: descAfterLinks } = extractLinks(descAfterImage);

    return {
      id: item.id,
      title: item.summary || 'Untitled Event',
      description: descAfterLinks,
      descriptionFormat: detectFormat(descAfterLinks),
      location: item.location || '',
      start: item.start?.dateTime || item.start?.date || '',
      end: item.end?.dateTime || item.end?.date || '',
      allDay: !item.start?.dateTime,
      image,
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
