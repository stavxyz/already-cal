require('../setup-dom.cjs');
const { describe, it, before, afterEach } = require('node:test');
const assert = require('node:assert');
const { createTestEvent } = require('../helpers.cjs');

let renderDetailView;

before(async () => {
  const mod = await import('../../src/views/detail.js');
  renderDetailView = mod.renderDetailView;
});

afterEach(() => {
  document.querySelector('.already-lightbox-close')?.click();
});

describe('renderDetailView', () => {
  const baseEvent = createTestEvent({
    id: 'detail-1',
    title: 'Concert in the Park',
    description: '<p>A great show</p>',
    location: 'Central Park',
    start: '2026-04-15T20:00:00Z',
    end: '2026-04-15T23:00:00Z',
  });

  it('renders event title', () => {
    const container = document.createElement('div');
    renderDetailView(container, baseEvent, 'UTC', () => {}, {});
    assert.strictEqual(container.querySelector('.already-detail-title').textContent, 'Concert in the Park');
  });

  it('renders date', () => {
    const container = document.createElement('div');
    renderDetailView(container, baseEvent, 'UTC', () => {}, {});
    assert.ok(container.querySelector('.already-detail-date'));
    assert.ok(container.querySelector('.already-detail-date').textContent.length > 0);
  });

  it('renders location with maps link', () => {
    const container = document.createElement('div');
    renderDetailView(container, baseEvent, 'UTC', () => {}, {});
    const locLink = container.querySelector('.already-detail-location a');
    assert.ok(locLink);
    assert.strictEqual(locLink.textContent, 'Central Park');
    assert.ok(locLink.href.includes('maps.google.com'));
    assert.strictEqual(locLink.target, '_blank');
  });

  it('omits location when empty', () => {
    const container = document.createElement('div');
    const event = { ...baseEvent, location: '' };
    renderDetailView(container, event, 'UTC', () => {}, {});
    assert.strictEqual(container.querySelector('.already-detail-location'), null);
  });

  it('renders description HTML', () => {
    const container = document.createElement('div');
    renderDetailView(container, baseEvent, 'UTC', () => {}, {});
    const desc = container.querySelector('.already-detail-description');
    assert.ok(desc);
  });

  it('renders scalar tags as pills', () => {
    const container = document.createElement('div');
    const event = { ...baseEvent, tags: [{ key: 'tag', value: 'outdoor' }, { key: 'cost', value: '$25' }] };
    renderDetailView(container, event, 'UTC', () => {}, {});
    const tags = container.querySelectorAll('.already-detail-tag');
    assert.strictEqual(tags.length, 2);
    assert.strictEqual(tags[0].textContent, 'outdoor');
    assert.strictEqual(tags[1].textContent, 'cost: $25');
  });

  it('renders URL-valued tags as link buttons', () => {
    const container = document.createElement('div');
    const event = { ...baseEvent, tags: [{ key: 'rsvp', value: 'https://example.com' }] };
    renderDetailView(container, event, 'UTC', () => {}, {});
    const link = container.querySelector('.already-detail-link');
    assert.ok(link);
    assert.strictEqual(link.textContent, 'Rsvp');
    assert.strictEqual(link.href, 'https://example.com/');
  });

  it('renders attachments', () => {
    const container = document.createElement('div');
    const event = { ...baseEvent, attachments: [{ label: 'Flyer.pdf', url: 'https://example.com/flyer.pdf' }] };
    renderDetailView(container, event, 'UTC', () => {}, {});
    const att = container.querySelector('.already-detail-attachment');
    assert.ok(att);
    assert.strictEqual(att.textContent, 'Flyer.pdf');
  });

  it('renders back button and calls onBack', () => {
    const container = document.createElement('div');
    let backCalled = false;
    renderDetailView(container, baseEvent, 'UTC', () => { backCalled = true; }, {});
    const btn = container.querySelector('.already-detail-back');
    assert.ok(btn);
    btn.click();
    assert.strictEqual(backCalled, true);
  });

  it('renders gallery for multiple images', () => {
    const container = document.createElement('div');
    const event = { ...baseEvent, images: ['https://a.com/1.jpg', 'https://a.com/2.jpg'], image: 'https://a.com/1.jpg' };
    renderDetailView(container, event, 'UTC', () => {}, {});
    assert.ok(container.querySelector('.already-detail-gallery'));
    assert.ok(container.querySelector('.already-detail-gallery-prev'));
    assert.ok(container.querySelector('.already-detail-gallery-next'));
    assert.ok(container.querySelector('.already-detail-gallery-counter'));
  });

  it('renders single image without carousel controls', () => {
    const container = document.createElement('div');
    const event = { ...baseEvent, image: 'https://a.com/1.jpg', images: ['https://a.com/1.jpg'] };
    renderDetailView(container, event, 'UTC', () => {}, {});
    assert.ok(container.querySelector('.already-detail-gallery'));
    assert.strictEqual(container.querySelector('.already-detail-gallery-prev'), null);
  });

  it('title uses textContent (XSS safe)', () => {
    const container = document.createElement('div');
    const event = { ...baseEvent, title: '<img onerror=alert(1)>' };
    renderDetailView(container, event, 'UTC', () => {}, {});
    const title = container.querySelector('.already-detail-title');
    assert.strictEqual(title.textContent, '<img onerror=alert(1)>');
    assert.ok(!title.innerHTML.includes('<img'));
  });

  it('shows magnifying glass badge on gallery image', () => {
    const container = document.createElement('div');
    const event = { ...baseEvent, image: 'https://a.com/1.jpg', images: ['https://a.com/1.jpg'] };
    renderDetailView(container, event, 'UTC', () => {}, {});
    const badge = container.querySelector('.already-detail-gallery-zoom');
    assert.ok(badge, 'zoom badge should be present');
  });

  it('opens lightbox when gallery image is clicked', () => {
    const container = document.createElement('div');
    const event = { ...baseEvent, image: 'https://a.com/1.jpg', images: ['https://a.com/1.jpg'] };
    renderDetailView(container, event, 'UTC', () => {}, {});
    container.querySelector('.already-detail-gallery-img').click();
    const lightbox = document.querySelector('.already-lightbox');
    assert.ok(lightbox, 'lightbox should open on image click');
  });

  it('opens lightbox at correct index for multi-image gallery', () => {
    const container = document.createElement('div');
    const event = { ...baseEvent, images: ['https://a.com/1.jpg', 'https://a.com/2.jpg'], image: 'https://a.com/1.jpg' };
    renderDetailView(container, event, 'UTC', () => {}, {});
    // Navigate to second image
    container.querySelector('.already-detail-gallery-next').click();
    // Click image to open lightbox
    container.querySelector('.already-detail-gallery-img').click();
    const lightboxImg = document.querySelector('.already-lightbox-img');
    assert.strictEqual(lightboxImg.src, 'https://a.com/2.jpg');
  });
});
