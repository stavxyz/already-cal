import { formatDatetime, formatDate } from '../util/dates.js';
import { renderDescription } from '../util/description.js';
import { createElement } from './helpers.js';

function renderGallery(images, altText) {
  const gallery = createElement('div', 'showcal-detail-gallery');

  let loadedImages = [...images];
  let current = 0;
  let counter = null;

  const imgEl = document.createElement('img');
  imgEl.className = 'showcal-detail-gallery-img';
  imgEl.src = images[0];
  imgEl.alt = altText;
  imgEl.setAttribute('loading', 'lazy');
  imgEl.onerror = () => {
    loadedImages = loadedImages.filter(u => u !== imgEl.src);
    if (loadedImages.length === 0) {
      gallery.closest('.showcal-detail-image')?.remove();
      return;
    }
    current = 0;
    imgEl.src = loadedImages[0];
    if (counter) counter.textContent = `1 / ${loadedImages.length}`;
  };
  gallery.appendChild(imgEl);

  if (images.length <= 1) return gallery;

  counter = createElement('div', 'showcal-detail-gallery-counter');
  counter.textContent = `1 / ${images.length}`;
  gallery.appendChild(counter);

  const prevBtn = createElement('button', 'showcal-detail-gallery-prev', { 'aria-label': 'Previous image' });
  prevBtn.textContent = '\u2039';
  gallery.appendChild(prevBtn);

  const nextBtn = createElement('button', 'showcal-detail-gallery-next', { 'aria-label': 'Next image' });
  nextBtn.textContent = '\u203a';
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

  const detail = createElement('div', 'showcal-detail');

  const backBtn = createElement('button', 'showcal-detail-back');
  backBtn.textContent = backLabel;
  backBtn.addEventListener('click', onBack);
  detail.appendChild(backBtn);

  // Two-column layout: gallery left, content right
  const body = createElement('div', hasImages ? 'showcal-detail-body showcal-detail-body--has-image' : 'showcal-detail-body');

  if (hasImages) {
    const galleryCol = createElement('div', 'showcal-detail-image');
    galleryCol.appendChild(renderGallery(images, event.title));
    body.appendChild(galleryCol);
  }

  const content = createElement('div', 'showcal-detail-content');

  const titleEl = createElement('h2', 'showcal-detail-title');
  titleEl.textContent = event.title;
  content.appendChild(titleEl);

  const meta = createElement('div', 'showcal-detail-meta');
  const dateStr = event.allDay
    ? formatDate(event.start, timezone, locale)
    : formatDatetime(event.start, timezone, locale);
  const dateDiv = createElement('div', 'showcal-detail-date');
  dateDiv.textContent = dateStr;
  meta.appendChild(dateDiv);

  if (event.location) {
    const mapsUrl = locationTemplate.replace('{location}', encodeURIComponent(event.location));
    const locDiv = createElement('div', 'showcal-detail-location');
    const locLink = createElement('a', null, { href: mapsUrl, target: '_blank', rel: 'noopener' });
    locLink.textContent = event.location;
    locDiv.appendChild(locLink);
    meta.appendChild(locDiv);
  }
  content.appendChild(meta);

  // Render tags (scalar tags and key-value text tags)
  const scalarAndTextTags = (event.tags || []).filter(t => {
    if (t.key === 'tag') return true; // scalar tag
    if (t.value && !t.value.startsWith('http')) return true; // key-value text
    return false;
  });

  if (scalarAndTextTags.length > 0) {
    const tagsDiv = createElement('div', 'showcal-detail-tags');
    for (const tag of scalarAndTextTags) {
      const span = createElement('span', 'showcal-detail-tag');
      span.textContent = tag.key === 'tag' ? tag.value : `${tag.key}: ${tag.value}`;
      tagsDiv.appendChild(span);
    }
    content.appendChild(tagsDiv);
  }

  if (event.description) {
    const desc = createElement('div', 'showcal-detail-description');
    desc.innerHTML = renderDescription(event.description, config);
    content.appendChild(desc);
  }

  if (event.attachments && event.attachments.length > 0) {
    const attachDiv = createElement('div', 'showcal-detail-attachments');
    for (const att of event.attachments) {
      const a = createElement('a', 'showcal-detail-attachment', { href: att.url, target: '_blank', rel: 'noopener' });
      a.textContent = att.label;
      attachDiv.appendChild(a);
    }
    content.appendChild(attachDiv);
  }

  // Collect key-value URL tags to render alongside links
  const urlTags = (event.tags || []).filter(t => t.key !== 'tag' && t.value && t.value.startsWith('http'));
  const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const allLinks = [...(event.links || []), ...urlTags.map(t => ({ label: titleCase(t.key), url: t.value }))];

  if (allLinks.length > 0) {
    const linksDiv = createElement('div', 'showcal-detail-links');
    for (const link of allLinks) {
      const a = createElement('a', 'showcal-detail-link', { href: link.url, target: '_blank', rel: 'noopener' });
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
