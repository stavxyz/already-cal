// test/setup-dom.js
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
});

global.document = dom.window.document;
global.window = dom.window;
global.HTMLElement = dom.window.HTMLElement;
global.DocumentFragment = dom.window.DocumentFragment;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.CustomEvent = dom.window.CustomEvent;
