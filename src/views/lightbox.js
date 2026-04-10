import { createElement } from './helpers.js';

let currentClose = null;

export function openLightbox(images, startIndex, altText) {
  // Close existing lightbox (cleans up listeners properly)
  if (currentClose) currentClose();

  const previousFocus = document.activeElement;

  let current = startIndex;
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

  const closeBtn = createElement('button', 'already-lightbox-close', { 'aria-label': 'Close' });
  closeBtn.textContent = '\u00d7';

  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKeydown);
    currentClose = null;
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
      const focusable = overlay.querySelectorAll('button');
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
