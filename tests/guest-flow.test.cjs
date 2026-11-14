const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Exercise the actual navigation/submission code with controllable network timing.
// Layout is deliberately left to real-browser checks, rather than mocked here.
function guestPage() {
  const nodes = new Map();
  const windowEvents = new Map(), motionEvents = new Map();
  function element(id) {
    if (nodes.has(id)) return nodes.get(id);
    const classes = new Set(), listeners = new Map();
    const node = {
      id, hidden: /-scene$/.test(id) && id !== 'envelope-scene', disabled: false,
      value: '', valueAsNumber: 0, validity: {}, style: {removeProperty() {}},
      classList: {add: (...xs) => xs.forEach(x => classes.add(x)), remove: (...xs) => xs.forEach(x => classes.delete(x)), contains: x => classes.has(x)},
      addEventListener(type, handler) { listeners.set(type, handler); },
      dispatch(type) { return listeners.get(type)?.({preventDefault() {}}); },
      querySelector() { return element('dialog'); }, querySelectorAll() { return []; },
      closest() { return element('invitation'); },
      setAttribute(k, v) { this[k] = v; }, removeAttribute(k) { delete this[k]; },
      setCustomValidity(message) { this.validity.customError = !!message; },
      reportValidity() {}, focus() {}, getAnimations() { return []; },
      getBoundingClientRect() { return {left: 0, top: 0, width: 300, height: 500}; }
    };
    nodes.set(id, node); return node;
  }
  const fields = ['rsvp-name', 'rsvp-adults', 'rsvp-children'].map(element);
  const yes = element('yes'), no = element('no');
  fields.push(yes, no);
  const form = element('rsvp');
  form.elements = {attendance: {value: 'yes'}};
  form.reset = () => {};
  form.querySelectorAll = () => fields;
  element('rsvp-name').value = 'Test guest';
  element('rsvp-adults').valueAsNumber = 2;
  element('rsvp-children').valueAsNumber = 1;
  const network = [];
  const context = vm.createContext({
    console: {error() {}}, URLSearchParams, AbortController,
    crypto: {randomUUID: () => 'test-device'},
    localStorage: {getItem() { return null; }, setItem() {}},
    document: {
      getElementById: element,
      querySelector: () => ({content: 'https://script.google.com/macros/s/test/exec'}),
      querySelectorAll: () => [], addEventListener() {}, dispatchEvent() {},
      body: {style: {}}
    },
    window: {matchMedia: () => ({matches: true, addEventListener: (type, callback) => motionEvents.set(type, callback)}), addEventListener: (type, callback) => windowEvents.set(type, callback)},
    i18n: {text(node, message, values = {}) { node.textContent = message.replace(/\{(\w+)\}/g, (_, k) => typeof values[k] === 'function' ? values[k]() : values[k] || ''); }, t: text => text},
    music: {}, setTimeout() { return 1; }, clearTimeout() {}, setInterval() { return 1; },
    CustomEvent: class { constructor(type, args) { this.type = type; this.detail = args?.detail; } },
    fetch: () => new Promise((resolve, reject) => network.push({resolve: body => resolve({ok: true, json: async () => body}), reject}))
  });
  const source = fs.readFileSync(path.join(__dirname, '../dist/app.js'), 'utf8');
  vm.runInContext(source.split('// The supplied MP3 soundtrack')[0], context);
  element('overlay').hidden = false;
  vm.runInContext("stage = 'rsvp'; $('rsvp-scene').hidden = false;", context);
  return {element, form, fields, network, windowEvents, motionEvents, run: text => vm.runInContext(text, context)};
}

test('double submit makes one request, freezes fields, and restores them after success', async () => {
  const page = guestPage();
  const sending = page.form.dispatch('submit');
  assert.equal(page.network.length, 1);
  assert.ok(page.fields.every(field => field.disabled));
  await page.form.dispatch('submit');
  assert.equal(page.network.length, 1);
  page.network[0].resolve({ok: true});
  await sending;
  assert.equal(page.run('stage'), 'calendar');
  assert.ok(page.fields.every(field => !field.disabled));
  assert.match(page.element('rsvp-result').textContent, /Đã gửi/);
  assert.equal(page.form['aria-busy'], undefined);
});

test('closing during a pending RSVP never reopens a hidden guest scene', async () => {
  const page = guestPage();
  const sending = page.form.dispatch('submit');
  page.run('reset()');
  page.network[0].resolve({ok: true});
  await sending;
  assert.equal(page.run('stage'), 'intro');
  assert.equal(page.element('overlay').hidden, true);
  assert.equal(page.element('calendar-scene').hidden, true);
  assert.equal(page.element('rsvp-submit').disabled, false);
});

test('failed request leaves the form usable and does not show a success scene', async () => {
  const page = guestPage();
  const sending = page.form.dispatch('submit');
  page.network[0].reject(new Error('offline'));
  await sending;
  assert.equal(page.run('stage'), 'rsvp');
  assert.equal(page.element('calendar-scene').hidden, true);
  assert.ok(page.fields.every(field => !field.disabled));
  assert.equal(page.form.classList.contains('sending'), false);
  assert.match(page.element('rsvp-note').textContent, /Chưa gửi được/);
});

test('declining attendance keeps guest counters disabled after the request', async () => {
  const page = guestPage();
  page.form.elements.attendance.value = 'no';
  const sending = page.form.dispatch('submit');
  page.network[0].resolve({ok: true});
  await sending;
  assert.equal(page.element('rsvp-adults').disabled, true);
  assert.equal(page.element('rsvp-children').disabled, true);
  assert.equal(page.element('rsvp-name').disabled, false);
});

test('rotating during extraction finishes the card instead of retaining stale coordinates', () => {
  const page = guestPage();
  page.run("stage = 'opening'; $('card-scene').hidden = false; $('overlay').classList.add('revealing'); $('card-scene').classList.add('extracting-card');");
  page.windowEvents.get('resize')();
  assert.equal(page.run('stage'), 'card');
  assert.equal(page.element('envelope-scene').hidden, true);
  assert.equal(page.element('card-scene').hidden, false);
  assert.equal(page.element('card-scene').classList.contains('extracting-card'), false);
  assert.equal(page.element('overlay').classList.contains('revealing'), false);
});

test('zero votes stays zero and malformed tally counts cannot produce NaN bars', () => {
  const source = fs.readFileSync(path.join(__dirname, '../dist/delight.js'), 'utf8');
  const start = source.indexOf('  function showTally(');
  const end = source.indexOf('  items.forEach(button => button.addEventListener', start);
  assert.ok(start > 0 && end > start);
  const bars = {innerHTML: '', hidden: true, querySelectorAll() { return []; }};
  const note = {};
  const context = vm.createContext({
    ITEM: {but: {name: 'Bút'}, sach: {name: 'Sách'}}, bars, note, tally: null,
    requestAnimationFrame: fn => fn(),
    i18n: {text(node, message, values) { node.total = values.total; }}
  });
  vm.runInContext(source.slice(start, end), context);
  vm.runInContext("showTally({but: 0, sach: 0}, 'but')", context);
  assert.equal(note.total, 0);
  assert.doesNotMatch(bars.innerHTML, /NaN|Infinity/);
  vm.runInContext("showTally({but: -4, sach: 'not a number'}, 'but')", context);
  assert.equal(note.total, 0);
  assert.doesNotMatch(bars.innerHTML, /NaN|Infinity/);
  vm.runInContext("showTally({but: 1, sach: 3}, 'but')", context);
  assert.equal(note.total, 4);
  assert.match(bars.innerHTML, /25%/);
  assert.match(bars.innerHTML, /75%/);
});
