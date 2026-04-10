// test/views/lightbox.test.js
require('../setup-dom.js');
const { describe, it, before, afterEach } = require('node:test');
const assert = require('node:assert');

let openLightbox;

before(async () => {
  const mod = await import('../../src/views/lightbox.js');
  openLightbox = mod.openLightbox;
});

afterEach(() => {
  document.querySelector('.already-lightbox')?.remove();
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

  it('has a close button', () => {
    openLightbox(['https://a.com/1.jpg'], 0, 'Alt');
    const closeBtn = document.querySelector('.already-lightbox-close');
    assert.ok(closeBtn);
    assert.strictEqual(closeBtn.getAttribute('aria-label'), 'Close');
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
});
