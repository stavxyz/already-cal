import { formatDatetime, formatDate } from '../util/dates.js';
import { renderDescription } from '../util/description.js';
import { escapeHtml } from '../util/sanitize.js';

function renderGallery(images, altText) {
  const gallery = document.createElement('div');
  gallery.className = 'ogcal-detail-gallery';

  let loadedImages = [...images];
  let current = 0;
  let counter = null;

  const imgEl = document.createElement('img');
  imgEl.className = 'ogcal-detail-gallery-img';
  imgEl.src = images[0];
  imgEl.alt = altText;
  imgEl.loading = 'lazy';
  imgEl.onerror = () => {
    loadedImages = loadedImages.filter(u => u !== imgEl.src);
    if (loadedImages.length === 0) {
      gallery.closest('.ogcal-detail-image')?.remove();
      return;
    }
    current = 0;
    imgEl.src = loadedImages[0];
    if (counter) counter.textContent = `1 / ${loadedImages.length}`;
  };
  gallery.appendChild(imgEl);

  if (images.length <= 1) return gallery;

  counter = document.createElement('div');
  counter.className = 'ogcal-detail-gallery-counter';
  counter.textContent = `1 / ${images.length}`;
  gallery.appendChild(counter);

  const prevBtn = document.createElement('button');
  prevBtn.className = 'ogcal-detail-gallery-prev';
  prevBtn.innerHTML = '&#8249;';
  prevBtn.setAttribute('aria-label', 'Previous image');
  gallery.appendChild(prevBtn);

  const nextBtn = document.createElement('button');
  nextBtn.className = 'ogcal-detail-gallery-next';
  nextBtn.innerHTML = '&#8250;';
  nextBtn.setAttribute('aria-label', 'Next image');
  gallery.appendChild(nextBtn);

  function goTo(idx) {
    current = (idx + loadedImages.length) % loadedImages.length;
    imgEl.src = loadedImages[current];
    counter.textContent = `${current + 1} / ${loadedImages.length}`;
  }

  prevBtn.addEventListener('click', () => goTo(current - 1));
  nextBtn.addEventListener('click', () => goTo(current + 1));

  gallery.setAttribute('tabindex', '0');
  gallery.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { goTo(current - 1); e.preventDefault(); }
    if (e.key === 'ArrowRight') { goTo(current + 1); e.preventDefault(); }
  });

  return gallery;
}

export function renderDetailView(container, event, timezone, onBack, config) {
  config = config || {};
  const locale = config.locale;
  const i18n = config.i18n || {};
  const backLabel = i18n.back || '\u2190 Back';
  const locationTemplate = config.locationLinkTemplate || 'https://maps.google.com/?q={location}';

  const images = event.images && event.images.length > 0 ? event.images : (event.image ? [event.image] : []);
  const hasImages = images.length > 0;

  const detail = document.createElement('div');
  detail.className = 'ogcal-detail';

  const backBtn = document.createElement('button');
  backBtn.className = 'ogcal-detail-back';
  backBtn.textContent = backLabel;
  backBtn.addEventListener('click', onBack);
  detail.appendChild(backBtn);

  // Two-column layout: gallery left, content right
  const body = document.createElement('div');
  body.className = hasImages ? 'ogcal-detail-body ogcal-detail-body--has-image' : 'ogcal-detail-body';

  if (hasImages) {
    const galleryCol = document.createElement('div');
    galleryCol.className = 'ogcal-detail-image';
    galleryCol.appendChild(renderGallery(images, escapeHtml(event.title)));
    body.appendChild(galleryCol);
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

  if (event.attachments && event.attachments.length > 0) {
    const attachDiv = document.createElement('div');
    attachDiv.className = 'ogcal-detail-attachments';
    for (const att of event.attachments) {
      const a = document.createElement('a');
      a.className = 'ogcal-detail-attachment';
      a.href = att.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = att.label;
      attachDiv.appendChild(a);
    }
    content.appendChild(attachDiv);
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
