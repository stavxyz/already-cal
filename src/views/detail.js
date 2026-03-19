import { formatDatetime, formatDate } from '../util/dates.js';
import { renderDescription } from '../util/description.js';
import { escapeHtml } from '../util/sanitize.js';

export function renderDetailView(container, event, timezone, onBack) {
  const detail = document.createElement('div');
  detail.className = 'ogcal-detail';

  const backBtn = document.createElement('button');
  backBtn.className = 'ogcal-detail-back';
  backBtn.textContent = '← Back';
  backBtn.addEventListener('click', onBack);
  detail.appendChild(backBtn);

  if (event.image) {
    const img = document.createElement('div');
    img.className = 'ogcal-detail-image';
    img.innerHTML = `<img src="${event.image}" alt="" loading="lazy">`;
    detail.appendChild(img);
  }

  const title = document.createElement('h2');
  title.className = 'ogcal-detail-title';
  title.textContent = event.title;
  detail.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'ogcal-detail-meta';
  const dateStr = event.allDay
    ? formatDate(event.start, timezone)
    : formatDatetime(event.start, timezone);
  meta.innerHTML = `<div class="ogcal-detail-date">${dateStr}</div>`;
  if (event.location) {
    const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(event.location)}`;
    meta.innerHTML += `<div class="ogcal-detail-location"><a href="${mapsUrl}" target="_blank" rel="noopener">${escapeHtml(event.location)}</a></div>`;
  }
  detail.appendChild(meta);

  if (event.description) {
    const desc = document.createElement('div');
    desc.className = 'ogcal-detail-description';
    desc.innerHTML = renderDescription(event.description);
    detail.appendChild(desc);
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
    detail.appendChild(linksDiv);
  }

  container.innerHTML = '';
  container.appendChild(detail);

  // Focus the back button for accessibility
  backBtn.focus();
}
