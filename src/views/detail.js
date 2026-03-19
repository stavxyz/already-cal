import { formatDatetime, formatDate } from '../util/dates.js';
import { renderDescription } from '../util/description.js';
import { escapeHtml } from '../util/sanitize.js';

export function renderDetailView(container, event, timezone, onBack, config) {
  config = config || {};
  const locale = config.locale;
  const i18n = config.i18n || {};
  const backLabel = i18n.back || '\u2190 Back';
  const locationTemplate = config.locationLinkTemplate || 'https://maps.google.com/?q={location}';

  const detail = document.createElement('div');
  detail.className = 'ogcal-detail';

  const backBtn = document.createElement('button');
  backBtn.className = 'ogcal-detail-back';
  backBtn.textContent = backLabel;
  backBtn.addEventListener('click', onBack);
  detail.appendChild(backBtn);

  // Two-column layout: image left, content right
  const body = document.createElement('div');
  body.className = event.image ? 'ogcal-detail-body ogcal-detail-body--has-image' : 'ogcal-detail-body';

  if (event.image) {
    const imgCol = document.createElement('div');
    imgCol.className = 'ogcal-detail-image';
    imgCol.innerHTML = `<img src="${event.image}" alt="${escapeHtml(event.title)}" loading="lazy">`;
    body.appendChild(imgCol);
  }

  const content = document.createElement('div');
  content.className = 'ogcal-detail-content';

  const title = document.createElement('h2');
  title.className = 'ogcal-detail-title';
  title.textContent = event.title;
  content.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'ogcal-detail-meta';
  const dateStr = event.allDay
    ? formatDate(event.start, timezone, locale)
    : formatDatetime(event.start, timezone, locale);
  meta.innerHTML = `<div class="ogcal-detail-date">${dateStr}</div>`;
  if (event.location) {
    const mapsUrl = locationTemplate.replace('{location}', encodeURIComponent(event.location));
    meta.innerHTML += `<div class="ogcal-detail-location"><a href="${mapsUrl}" target="_blank" rel="noopener">${escapeHtml(event.location)}</a></div>`;
  }
  content.appendChild(meta);

  if (event.description) {
    const desc = document.createElement('div');
    desc.className = 'ogcal-detail-description';
    desc.innerHTML = renderDescription(event.description, config);
    content.appendChild(desc);
  }

  if (event.links && event.links.length > 0) {
    const linksDiv = document.createElement('div');
    linksDiv.className = 'ogcal-detail-links';
    for (const link of event.links) {
      const a = document.createElement('a');
      a.className = 'ogcal-detail-link';
      a.href = link.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = link.label;
      linksDiv.appendChild(a);
    }
    content.appendChild(linksDiv);
  }

  body.appendChild(content);
  detail.appendChild(body);

  container.innerHTML = '';
  container.appendChild(detail);

  // Focus the back button for accessibility
  backBtn.focus();
}
