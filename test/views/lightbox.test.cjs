require('../setup-dom.cjs');
const { describe, it, before, afterEach } = require('node:test');
const assert = require('node:assert');

let openLightbox;

before(async () => {
  const mod = await import('../../src/views/lightbox.js');
  openLightbox = mod.openLightbox;
});

afterEach(() => {
  // Use click on close button to properly clean up listeners + body overflow
  document.querySelector('.already-lightbox-close')?.click();
});

describe('openLightbox', () => {
  it('creates a lightbox overlay on document.body', () => {
    openLightbox(['https://a.com/1.jpg'], 0, 'Alt text');
    const overlay = document.querySelector('.already-lightbox');
    assert.ok(overlay);
    assert.strictEqual(overlay.getAttribute('role'), 'dialog');
    assert.strictEqual(overlay.getAttribute('aria-modal'), 'true');
    assert.strictEqual(overlay.getAttribute('aria-label'), 'Image viewer');
  });

  it('displays the image at the given start index', () => {
    openLightbox(['https://a.com/1.jpg', 'https://a.com/2.jpg'], 1, 'Alt');
    const img = document.querySelector('.already-lightbox-img');
    assert.strictEqual(img.src, 'https://a.com/2.jpg');
  });

  it('sets alt text on the lightbox image', () => {
    openLightbox(['https://a.com/1.jpg'], 0, 'Event flyer');
    const img = document.querySelector('.already-lightbox-img');
    assert.strictEqual(img.alt, 'Event flyer');
  });

  it('has a close button', () => {
    openLightbox(['https://a.com/1.jpg'], 0, 'Alt');
    const closeBtn = document.querySelector('.already-lightbox-close');
    assert.ok(closeBtn);
    assert.strictEqual(closeBtn.getAttribute('aria-label'), 'Close');
  });

  it('focuses the close button on open', () => {
    openLightbox(['https://a.com/1.jpg'], 0, 'Alt');
    const closeBtn = document.querySelector('.already-lightbox-close');
    assert.strictEqual(document.activeElement, closeBtn);
  });

  it('removes overlay when close button is clicked', () => {
    openLightbox(['https://a.com/1.jpg'], 0, 'Alt');
    document.querySelector('.already-lightbox-close').click();
    assert.strictEqual(document.querySelector('.already-lightbox'), null);
  });

  it('removes overlay when backdrop is clicked', () => {
    openLightbox(['https://a.com/1.jpg'], 0, 'Alt');
    const overlay = document.querySelector('.already-lightbox');
    overlay.click();
    assert.strictEqual(document.querySelector('.already-lightbox'), null);
  });

  it('removes overlay when image is clicked', () => {
    openLightbox(['https://a.com/1.jpg'], 0, 'Alt');
    document.querySelector('.already-lightbox-img').click();
    assert.strictEqual(document.querySelector('.already-lightbox'), null);
  });

  it('does NOT close when prev/next button is clicked', () => {
    openLightbox(['https://a.com/1.jpg', 'https://a.com/2.jpg'], 0, 'Alt');
    document.querySelector('.already-lightbox-next').click();
    assert.ok(document.querySelector('.already-lightbox'));
  });

  it('removes overlay on Escape key', () => {
    openLightbox(['https://a.com/1.jpg'], 0, 'Alt');
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
    assert.strictEqual(document.querySelector('.already-lightbox'), null);
  });

  it('navigates to next image on next button click', () => {
    openLightbox(['https://a.com/1.jpg', 'https://a.com/2.jpg', 'https://a.com/3.jpg'], 0, 'Alt');
    document.querySelector('.already-lightbox-next').click();
    assert.strictEqual(document.querySelector('.already-lightbox-img').src, 'https://a.com/2.jpg');
    assert.strictEqual(document.querySelector('.already-lightbox-counter').textContent, '2 / 3');
  });

  it('navigates to previous image on prev button click', () => {
    openLightbox(['https://a.com/1.jpg', 'https://a.com/2.jpg'], 1, 'Alt');
    document.querySelector('.already-lightbox-prev').click();
    assert.strictEqual(document.querySelector('.already-lightbox-img').src, 'https://a.com/1.jpg');
  });

  it('wraps around from last to first image', () => {
    openLightbox(['https://a.com/1.jpg', 'https://a.com/2.jpg'], 1, 'Alt');
    document.querySelector('.already-lightbox-next').click();
    assert.strictEqual(document.querySelector('.already-lightbox-img').src, 'https://a.com/1.jpg');
  });

  it('wraps around from first to last image', () => {
    openLightbox(['https://a.com/1.jpg', 'https://a.com/2.jpg', 'https://a.com/3.jpg'], 0, 'Alt');
    document.querySelector('.already-lightbox-prev').click();
    assert.strictEqual(document.querySelector('.already-lightbox-img').src, 'https://a.com/3.jpg');
  });

  it('navigates via ArrowRight key', () => {
    openLightbox(['https://a.com/1.jpg', 'https://a.com/2.jpg'], 0, 'Alt');
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight' }));
    assert.strictEqual(document.querySelector('.already-lightbox-img').src, 'https://a.com/2.jpg');
  });

  it('navigates via ArrowLeft key', () => {
    openLightbox(['https://a.com/1.jpg', 'https://a.com/2.jpg'], 1, 'Alt');
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    assert.strictEqual(document.querySelector('.already-lightbox-img').src, 'https://a.com/1.jpg');
  });

  it('shows correct counter with non-zero startIndex', () => {
    openLightbox(['https://a.com/1.jpg', 'https://a.com/2.jpg', 'https://a.com/3.jpg'], 1, 'Alt');
    assert.strictEqual(document.querySelector('.already-lightbox-counter').textContent, '2 / 3');
  });

  it('hides nav controls for single image', () => {
    openLightbox(['https://a.com/1.jpg'], 0, 'Alt');
    assert.strictEqual(document.querySelector('.already-lightbox-prev'), null);
    assert.strictEqual(document.querySelector('.already-lightbox-next'), null);
    assert.strictEqual(document.querySelector('.already-lightbox-counter'), null);
  });

  it('restores focus to previously focused element on close', () => {
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    btn.focus();
    openLightbox(['https://a.com/1.jpg'], 0, 'Alt');
    document.querySelector('.already-lightbox-close').click();
    assert.strictEqual(document.activeElement, btn);
    btn.remove();
  });

  it('traps Tab focus within the lightbox', () => {
    openLightbox(['https://a.com/1.jpg', 'https://a.com/2.jpg'], 0, 'Alt');
    const closeBtn = document.querySelector('.already-lightbox-close');
    const nextBtn = document.querySelector('.already-lightbox-next');
    // Focus is on close button (first), Shift+Tab should wrap to last (next)
    closeBtn.focus();
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }));
    assert.strictEqual(document.activeElement, nextBtn);
    // Tab from last (next) should wrap to first (close)
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: false }));
    assert.strictEqual(document.activeElement, closeBtn);
  });

  it('includes the image in the focus trap', () => {
    openLightbox(['https://a.com/1.jpg'], 0, 'Alt');
    const closeBtn = document.querySelector('.already-lightbox-close');
    const img = document.querySelector('.already-lightbox-img');
    assert.strictEqual(img.getAttribute('role'), 'button');
    assert.strictEqual(img.getAttribute('tabindex'), '0');
    // Shift+Tab from close (first) should wrap to img (last)
    closeBtn.focus();
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }));
    assert.strictEqual(document.activeElement, img);
  });

  it('removes keydown listener after close', () => {
    openLightbox(['https://a.com/1.jpg', 'https://a.com/2.jpg'], 0, 'Alt');
    document.querySelector('.already-lightbox-close').click();
    // Dispatch arrow key after close — should not reopen or error
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight' }));
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
    assert.strictEqual(document.querySelector('.already-lightbox'), null);
  });

  it('replaces existing lightbox when opened twice', () => {
    openLightbox(['https://a.com/1.jpg'], 0, 'Alt');
    openLightbox(['https://a.com/2.jpg'], 0, 'Alt');
    const overlays = document.querySelectorAll('.already-lightbox');
    assert.strictEqual(overlays.length, 1);
    assert.strictEqual(document.querySelector('.already-lightbox-img').src, 'https://a.com/2.jpg');
  });

  it('does nothing when called with empty array', () => {
    openLightbox([], 0, 'Alt');
    assert.strictEqual(document.querySelector('.already-lightbox'), null);
  });

  it('clamps out-of-bounds startIndex', () => {
    openLightbox(['https://a.com/1.jpg', 'https://a.com/2.jpg'], 5, 'Alt');
    const img = document.querySelector('.already-lightbox-img');
    assert.ok(img);
    // 5 % 2 = 1
    assert.strictEqual(img.src, 'https://a.com/2.jpg');
  });

  it('sets overflow hidden on body while open', () => {
    const original = document.body.style.overflow;
    openLightbox(['https://a.com/1.jpg'], 0, 'Alt');
    assert.strictEqual(document.body.style.overflow, 'hidden');
    document.querySelector('.already-lightbox-close').click();
    assert.strictEqual(document.body.style.overflow, original);
  });
});
