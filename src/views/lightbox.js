// src/views/lightbox.js
import { createElement } from './helpers.js';

// Tracks the close function of any open lightbox to ensure only one exists at a time
let currentClose = null;

/**
 * Open a fullscreen image lightbox overlay with navigation controls.
 * @param {string[]} images - Non-empty array of image URLs
 * @param {number} startIndex - Zero-based index of the initially displayed image
 * @param {string} altText - Shared alt text for all images (typically the event title)
 */
export function openLightbox(images, startIndex, altText) {
  if (!images || images.length === 0) return;

  // Close any existing lightbox before opening a new one
  if (currentClose) currentClose();

  const previousFocus = document.activeElement;
  const savedOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  let current = ((startIndex % images.length) + images.length) % images.length;
  let counterEl = null;

  const overlay = createElement('div', 'already-lightbox', {
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': 'Image viewer',
  });

  const img = document.createElement('img');
  img.className = 'already-lightbox-img';
  img.src = images[current];
  img.alt = altText;
  img.setAttribute('tabindex', '0');
  img.setAttribute('role', 'button');
  img.setAttribute('aria-label', 'Close image viewer');

  img.onerror = () => {
    if (images.length > 1) {
      goTo(current + 1);
    } else {
      close();
    }
  };

  const closeBtn = createElement('button', 'already-lightbox-close', { 'aria-label': 'Close' });
  closeBtn.textContent = '\u00d7';

  function close() {
    document.removeEventListener('keydown', onKeydown);
    currentClose = null;
    document.body.style.overflow = savedOverflow;
    overlay.remove();
    if (previousFocus && previousFocus.focus) previousFocus.focus();
  }

  function goTo(idx) {
    current = (idx + images.length) % images.length;
    img.src = images[current];
    if (counterEl) counterEl.textContent = `${current + 1} / ${images.length}`;
  }

  function onKeydown(e) {
    if (e.key === 'Escape') { close(); e.preventDefault(); return; }
    if (e.key === 'ArrowLeft') { goTo(current - 1); e.preventDefault(); return; }
    if (e.key === 'ArrowRight') { goTo(current + 1); e.preventDefault(); return; }
    if (e.key === 'Tab') {
      const focusable = overlay.querySelectorAll('button, [role="button"]');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        last.focus(); e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === last) {
        first.focus(); e.preventDefault();
      }
    }
  }

  closeBtn.addEventListener('click', (e) => { e.stopPropagation(); close(); });
  img.addEventListener('click', (e) => { e.stopPropagation(); close(); });
  overlay.addEventListener('click', close);

  document.addEventListener('keydown', onKeydown);
  currentClose = close;

  overlay.appendChild(closeBtn);
  overlay.appendChild(img);
  if (images.length > 1) {
    const prevBtn = createElement('button', 'already-lightbox-prev', { 'aria-label': 'Previous image' });
    prevBtn.textContent = '\u2039';
    prevBtn.addEventListener('click', (e) => { e.stopPropagation(); goTo(current - 1); });

    const nextBtn = createElement('button', 'already-lightbox-next', { 'aria-label': 'Next image' });
    nextBtn.textContent = '\u203a';
    nextBtn.addEventListener('click', (e) => { e.stopPropagation(); goTo(current + 1); });

    counterEl = createElement('div', 'already-lightbox-counter');
    counterEl.textContent = `${current + 1} / ${images.length}`;

    overlay.appendChild(prevBtn);
    overlay.appendChild(nextBtn);
    overlay.appendChild(counterEl);
  }

  document.body.appendChild(overlay);
  closeBtn.focus();
}
