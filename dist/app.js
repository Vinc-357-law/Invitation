'use strict';
const $ = id => document.getElementById(id);
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
let stage = 'intro', openingTimer, lastTrigger;
const overlay = $('overlay'), dialog = overlay.querySelector('[role="dialog"]');
const envelopeScene = $('envelope-scene');
const cardScene = $('card-scene');
const invitation = $('card-title').closest('.invitation');
let extractionAnimations = [];
const ENVELOPE_REST = 800; // how long the landed envelope stays closed before it opens by itself
function announce(message) { i18n.text($('status'), message); $('status').classList.add('visible'); clearTimeout(announce.timer); announce.timer = setTimeout(() => $('status').classList.remove('visible'), 3300); }
function setStep(n) { document.querySelectorAll('.steps i').forEach((el,i) => el.classList.toggle('active',i===n)); }
function receive(event) {
  if (stage !== 'intro') return;
  lastTrigger = event.currentTarget; stage = 'dropping';
  const sleigh = $('sleigh'), rect = sleigh.getBoundingClientRect();
  const letter = $('envelope').cloneNode(true);
  letter.removeAttribute('id');
  letter.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
  letter.classList.add('falling-letter');
  letter.inert = true;
  letter.setAttribute('aria-hidden', 'true');
  // Drop from Santa's sack; if the sleigh is off-screen (hint button used), drop from the sky centre.
  const sackX = rect.left + rect.width * .16; // Santa sits in the first sixth of the nine-reindeer team
  const onScreen = sackX > 24 && sackX < innerWidth - 160;
  letter.style.left = `${onScreen ? sackX : innerWidth / 2 - 52}px`;
  letter.style.top = `${onScreen ? rect.top + rect.height * .5 : innerHeight * .28}px`;
  document.body.append(letter);
  $('world').classList.add('delivered');
  openingTimer = setTimeout(() => {
    const from = letter.getBoundingClientRect();
    const fromWidth = letter.offsetWidth * 1.15;
    stage = 'envelope'; overlay.hidden = false;
    $('world').inert = true; document.body.style.overflow = 'hidden';
    setStep(1);
    const settle = motion.matches ? 0 : deliverEnvelope(from, fromWidth) + ENVELOPE_REST;
    letter.remove();
    dialog.focus({preventScroll: true});
    openingTimer = setTimeout(openEnvelope, settle);
  }, motion.matches ? 80 : 1250);
  if (!music.started && !music.userMuted) music.start();
}

// Hand the falling letter over to the full-size envelope so it grows from the same spot.
function deliverEnvelope(from, fromWidth) {
  const envelope = $('envelope'), to = envelope.getBoundingClientRect();
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const scale = fromWidth / envelope.offsetWidth;
  const duration = 1150;
  envelope.animate([
    {transform: `translate(${dx}px, ${dy}px) rotate(18deg) scale(${scale})`},
    {transform: 'translate(0, 0) rotate(0deg) scale(1)'}
  ], {duration, easing: 'cubic-bezier(.3,1.18,.42,1)'});
  return duration + 80;
}
$('sleigh').addEventListener('click', receive);
$('receive-hint').addEventListener('click', receive);

function clearExtraction() {
  extractionAnimations.forEach(animation => animation.cancel());
  extractionAnimations = [];
  overlay.classList.remove('revealing');
  envelopeScene.classList.remove('extracting-envelope');
  envelopeScene.style.removeProperty('top');
  cardScene.classList.remove('extracting-card');
  cardScene.inert = false;
}

function finishOpening() {
  stage = 'card';
  envelopeScene.hidden = true;
  cardScene.hidden = false;
  clearExtraction();
  setStep(2);
  overlay.scrollTop = 0;
  invitation.focus({preventScroll: true});
}

function extractInvitation() {
  overlay.scrollTop = 0;
  overlay.classList.add('revealing');
  envelopeScene.style.top = `${envelopeScene.offsetTop}px`;
  envelopeScene.classList.add('extracting-envelope');
  cardScene.classList.add('letter-extracted', 'extracting-card');
  cardScene.inert = true;
  cardScene.hidden = false;

  const envelope = $('envelope').getBoundingClientRect();
  const card = invitation.getBoundingClientRect();
  const scale = envelope.width * .828 / card.width;
  const x = envelope.left + (envelope.width - card.width * scale) / 2 - card.left;
  const y = envelope.top + envelope.height * .015 - card.top; // tucked just inside the envelope
  const raised = Math.max(12, innerHeight * .05) - card.top;
  // The flap needs room to swing up; the envelope then sinks, and finally leaves the screen.
  const lowered = envelope.height * .118;
  const sunk = Math.max(lowered, innerHeight * .57 - envelope.top);
  const gone = innerHeight + 60 - envelope.top;
  const duration = 3100;
  const sink = 'cubic-bezier(.3,.7,.2,1)', glide = 'cubic-bezier(.25,.8,.25,1)';
  const inEnvelope = (top, turn = 0) => `translate(${x}px, ${top}px) scale(${scale}) rotate(${turn}deg)`;
  const slide = distance => `translateY(${distance}px)`;
  const envelopeLayers = $('envelope').querySelectorAll('.ke-back, .ke-flap, .ke-front');
  extractionAnimations = [
    ...[...envelopeLayers].map(layer => layer.animate([
      {transform: slide(0), offset: 0, easing: sink},
      {transform: slide(lowered), offset: .27, easing: sink},
      {transform: slide(sunk), offset: .6},
      {transform: slide(sunk), offset: .66, easing: sink},
      {transform: slide(gone), offset: .98},
      {transform: slide(gone), offset: 1}
    ], {duration, fill: 'both'})),
    invitation.animate([
      {transform: inEnvelope(y), offset: 0, easing: sink},
      {transform: inEnvelope(y + lowered), offset: .27, easing: glide},
      {transform: inEnvelope(raised, -2), offset: .6},
      {transform: inEnvelope(raised, -2), offset: .66, easing: glide},
      {transform: 'translate(0px, 0px) scale(1) rotate(0deg)', offset: 1}
    ], {duration, fill: 'both'})
  ];
  openingTimer = setTimeout(finishOpening, duration);
}

function openEnvelope() {
  if (stage !== 'envelope') return;
  stage = 'opening'; $('envelope').classList.add('opening');
  music.chime();
  document.dispatchEvent(new CustomEvent('envelope:open'));
  if (motion.matches) finishOpening();
  else extractInvitation();
}
function reset() {
  clearTimeout(openingTimer); clearTimeout(stepSwitch); stage = 'intro'; overlay.hidden = true; $('world').inert = false;
  clearExtraction();
  document.querySelectorAll('.falling-letter').forEach(letter => letter.remove());
  for (const element of [$('envelope'), $('rsvp-scene'), $('calendar-scene'), cardScene]) {
    element.getAnimations().forEach(animation => animation.cancel());
    element.inert = false;
  }
  cardScene.classList.remove('letter-extracted');
  $('envelope-scene').hidden = false; $('card-scene').hidden = true;
  $('rsvp-scene').hidden = true;
  $('calendar-scene').hidden = true;
  $('game-scene').hidden = true;
  $('game-scene').getAnimations().forEach(animation => animation.cancel());
  $('game-scene').inert = false;
  $('envelope').classList.remove('opening');
  $('world').classList.remove('delivered'); document.body.style.overflow = ''; setStep(0);
  (lastTrigger || $('sleigh')).focus({preventScroll:true});
}
$('close').addEventListener('click',reset); $('replay').addEventListener('click',reset);
document.addEventListener('keydown',e=>{
  if (overlay.hidden) return;
  if (e.key === 'Escape') { e.preventDefault(); reset(); }
  if (e.key !== 'Tab') return;
  const focusable = [...dialog.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled)')].filter(el => el.getClientRects().length);
  const first=focusable[0], last=focusable.at(-1), active=document.activeElement;
  if(e.shiftKey && (active===first || !focusable.includes(active))) {e.preventDefault();last.focus();}
  else if(!e.shiftKey && (active===last || !focusable.includes(active))) {e.preventDefault();first.focus();}
});
const rsvp = $('rsvp');
const guestName = $('rsvp-name');
const adultCount = $('rsvp-adults');
const childCount = $('rsvp-children');
const rsvpResult = $('rsvp-result');
const endpoint = document.querySelector('meta[name="rsvp-endpoint"]').content.trim();
const sheetsReady = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(endpoint);

// One anonymous id per device, so a guest who answers again updates their row instead of adding one.
const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch {} }
};
const clientId = store.get('aristia-client') || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
store.set('aristia-client', clientId);

// Google Apps Script web app: a form-encoded POST is a "simple" request (no CORS preflight) and the
// script's JSON reply is readable after Google's redirect.
async function sheetRequest(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {...options, signal: controller.signal});
    if (!response.ok) throw new Error('Không kết nối được Google Sheets.');
    const data = await response.json();
    if (!data.ok) throw new Error(data.message || 'Không lưu được phản hồi.');
    return data;
  } finally { clearTimeout(timeout); }
}
const sheet = {
  ready: sheetsReady,
  clientId,
  store,
  async post(fields) {
    return sheetRequest(endpoint, {method: 'POST', body: new URLSearchParams({...fields, clientId})});
  },
  async get(params) {
    return sheetRequest(`${endpoint}?${new URLSearchParams(params)}`);
  }
};
window.sheet = sheet;

let stepSwitch;
function showGuestStep(next, focusId) {
  const current = $(stage + '-scene'), target = $(next + '-scene');
  stage = next;
  clearTimeout(stepSwitch);
  const swap = () => {
    for (const step of ['card', 'rsvp', 'calendar', 'game']) {
      const scene = $(step + '-scene');
      scene.hidden = step !== next;
      scene.inert = false;
      scene.getAnimations().forEach(animation => animation.cancel());
    }
    overlay.scrollTop = 0;
    $(focusId).focus({preventScroll: true});
    if (!motion.matches) target.animate([
      {opacity: 0, transform: 'translateY(16px) scale(.985)'},
      {opacity: 1, transform: 'none'}
    ], {duration: 460, easing: 'cubic-bezier(.2,.75,.25,1)'});
  };
  if (motion.matches || !current || current.hidden || current === target) { swap(); return; }
  current.inert = true;
  current.animate([
    {opacity: 1, transform: 'none'},
    {opacity: 0, transform: 'translateY(-10px) scale(.99)'}
  ], {duration: 200, easing: 'ease-in', fill: 'forwards'});
  stepSwitch = setTimeout(swap, 200);
}

$('rsvp-open').addEventListener('click', () => showGuestStep('rsvp', 'rsvp-title'));
$('rsvp-back').addEventListener('click', () => showGuestStep('card', 'rsvp-open'));
$('calendar-back').addEventListener('click', () => showGuestStep('card', 'rsvp-open'));

$('calendar-save').addEventListener('click', () => announce('Đang mở Google Calendar…'));

const rsvpSubmit = $('rsvp-submit'), rsvpNote = $('rsvp-note');
const rsvpNoteText = sheetsReady ? 'Gia đình sẽ nhận được phản hồi của bạn ngay khi bạn bấm gửi.' : 'Bản xem thử · Phản hồi chỉ hiển thị trên trang này.';
const rsvpSubmitText = sheetsReady ? 'Gửi phản hồi và xem lịch' : 'Xác nhận và xem lịch';
i18n.text(rsvpNote, rsvpNoteText);
i18n.text(rsvpSubmit, rsvpSubmitText);
const savedName = store.get('aristia-guest'); // pre-filled after the form reset below

function updateRsvp() {
  const attending = rsvp.elements.attendance.value === 'yes';
  $('rsvp-counts').hidden = !attending;
  adultCount.disabled = !attending;
  childCount.disabled = !attending;
  guestName.setCustomValidity('');
  adultCount.setCustomValidity('');
  i18n.text(rsvpResult, '');
  if (!rsvp.classList.contains('sending')) { i18n.text(rsvpNote, rsvpNoteText); rsvpNote.classList.remove('rsvp-error'); }
}

rsvp.addEventListener('input', updateRsvp);
rsvp.addEventListener('submit', async event => {
  event.preventDefault();
  if (rsvp.classList.contains('sending')) return; // ignore double taps while a reply is on its way
  const name = guestName.value.trim();
  if (!name) {
    guestName.setCustomValidity(i18n.t('Vui lòng nhập tên khách mời.'));
    guestName.reportValidity();
    return;
  }
  const attending = rsvp.elements.attendance.value === 'yes';
  const adults = attending ? adultCount.valueAsNumber : 0;
  const children = attending ? childCount.valueAsNumber : 0;
  if (attending && adults + children < 1) {
    adultCount.setCustomValidity(i18n.t('Vui lòng nhập ít nhất một người tham dự.'));
    adultCount.reportValidity();
    return;
  }
  store.set('aristia-guest', name);
  const summary = () => attending ? i18n.t('Sẽ đến · {adults} người lớn, {children} trẻ em.', {adults, children}) : i18n.t('Không thể đến.');
  if (sheetsReady) {
    rsvp.classList.add('sending');
    rsvpSubmit.disabled = true;
    i18n.text(rsvpSubmit, 'Đang gửi…');
    try {
      await sheet.post({type: 'rsvp', guestName: name, attendance: attending ? 'yes' : 'no', adults, children});
      i18n.text(rsvpResult, 'Đã gửi phản hồi: {summary} Cảm ơn bạn!', {summary});
    } catch (error) {
      console.error(error);
      i18n.text(rsvpNote, 'Chưa gửi được phản hồi. Hãy kiểm tra kết nối mạng và thử lại.');
      rsvpNote.classList.add('rsvp-error');
      return;
    } finally {
      rsvp.classList.remove('sending');
      rsvpSubmit.disabled = false;
      i18n.text(rsvpSubmit, rsvpSubmitText);
    }
  } else {
    i18n.text(rsvpResult, 'Phản hồi thử: {summary}', {summary});
  }
  document.dispatchEvent(new CustomEvent('rsvp:sent', {detail: {attending, from: rsvpSubmit.getBoundingClientRect()}}));
  showGuestStep('calendar', 'calendar-title');
});
document.addEventListener('languagechange', () => {
  if (guestName.validity.customError) guestName.setCustomValidity(i18n.t('Vui lòng nhập tên khách mời.'));
  if (adultCount.validity.customError) adultCount.setCustomValidity(i18n.t('Vui lòng nhập ít nhất một người tham dự.'));
});
rsvp.reset();
if (savedName) guestName.value = savedName;
updateRsvp();

// The supplied MP3 soundtrack is controlled by background-audio.js.
$('sound').addEventListener('click',()=>music.playing?music.stop():music.start());
$('sound-dialog').addEventListener('click',()=>music.playing?music.stop():music.start());
// Snow remains above both the landscape and the opened invitation.
// It parts around the finger / cursor and settles into a soft drift along the bottom of the
// moonlit scene; sweeping across the drift brushes it away. The drift melts while the card is open.
const canvas = $('snow'), ctx = canvas.getContext('2d');
let flakes = [], width = 0, height = 0, frame, last = 0, dpr = 1;
const COLUMN = 6;
let drift = new Float32Array(0);
const pointer = {x: -999, y: -999, vx: 0, vy: 0, seen: 0};
// Prepaint flakes with a visible white core and soft edges at three depths.
const snowSprites = Array.from({length: 3}, (_, layer) => {
  const sprite = document.createElement('canvas'); sprite.width = sprite.height = 48;
  const g = sprite.getContext('2d');
  const glow = g.createRadialGradient(23, 22, 1, 24, 24, 21);
  glow.addColorStop(0, 'rgba(255,254,250,1)');
  glow.addColorStop(layer === 2 ? .28 : .48, 'rgba(255,254,250,.95)');
  glow.addColorStop(.75, 'rgba(249,252,255,.3)');
  glow.addColorStop(1, 'rgba(239,247,255,0)');
  g.fillStyle = glow;
  g.beginPath(); g.ellipse(24, 24, 22, 17.6, 0, 0, Math.PI * 2); g.fill();
  return sprite;
});
function resize() {
  width = window.innerWidth; height = window.innerHeight;
  // Phones get 1.5× pixels: soft snowflakes look the same, and there are ~45% fewer pixels to clear.
  dpr = Math.min(devicePixelRatio || 1, width < 700 ? 1.5 : 2);
  canvas.width = width * dpr; canvas.height = height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  flakes = Array.from({length: width < 700 ? 165 : 280}, () => {
    const depth = Math.random(), layer = depth < .4 ? 0 : depth < .84 ? 1 : 2;
    return {x: Math.random() * width, y: Math.random() * height,
      layer, depth, r: [.85, 1.6, 2.8][layer] + Math.random() * [.55, .9, 1.5][layer],
      speed: .4 + depth * 1.35 + Math.random() * .25,
      drift: (Math.random() - .5) * .25, phase: Math.random() * Math.PI * 2,
      sway: .12 + Math.random() * .3, spin: (Math.random() - .5) * .5,
      opacity: .42 + depth * .46, px: 0, py: 0};
  });
  drift = new Float32Array(Math.ceil(width / COLUMN) + 2);
  driftFill = null;
  draw(0);
}
function trackPointer(event) {
  const now = performance.now(), dt = Math.max(8, now - pointer.seen);
  if (now - pointer.seen < 120) { pointer.vx = (event.clientX - pointer.x) / dt * 16; pointer.vy = (event.clientY - pointer.y) / dt * 16; }
  else { pointer.vx = pointer.vy = 0; }
  pointer.x = event.clientX; pointer.y = event.clientY; pointer.seen = now;
}
window.addEventListener('pointermove', trackPointer, {passive: true});
window.addEventListener('pointerdown', trackPointer, {passive: true});
const driftMax = () => width < 700 ? 11 : 16;
function driftAt(x) { return drift[Math.max(0, Math.min(drift.length - 1, Math.round(x / COLUMN)))] || 0; }
// Each landing flake adds a soft mound spread over ~50px; with the melt rate below a drift
// builds up over about a minute and levels off at driftMax().
const MOUND = [-4, -3, -2, -1, 0, 1, 2, 3, 4].map(k => Math.exp(-k * k / 6));
function settle(x, r) {
  const i = Math.round(x / COLUMN), max = driftMax(), add = r * 2.2;
  MOUND.forEach((weight, n) => {
    const j = i + n - 4; if (j < 0 || j >= drift.length) return;
    drift[j] = Math.min(max, drift[j] + add * weight * (1 - drift[j] / (max * 1.15)));
  });
}
function drawDrift(dt, open) {
  let any = false;
  const pointerFresh = performance.now() - pointer.seen < 150;
  for (let i = 0; i < drift.length; i++) {
    if (!drift[i]) continue;
    // Melting: slow in the scene, quicker while the invitation is open.
    drift[i] = Math.max(0, drift[i] - (open ? .05 : .0004) * dt);
    // A sweep of the finger near the bottom brushes the snow aside.
    if (pointerFresh && Math.abs(i * COLUMN - pointer.x) < 26 && pointer.y > height - drift[i] - 30) drift[i] *= .82;
    if (drift[i] > .05) any = true;
  }
  if (!any) return;
  // No shadowBlur here: it costs ~6 ms a frame on phones. A soft glow line along the top edge
  // gives the same moonlit rim for a fraction of the cost.
  ctx.beginPath(); ctx.moveTo(0, height);
  for (let i = 0; i < drift.length; i++) {
    // Smooth the columns into a soft, rounded drift.
    const h = ((drift[i - 1] || drift[i]) + drift[i] * 2 + (drift[i + 1] || drift[i])) / 4;
    ctx.lineTo(i * COLUMN, height - h);
  }
  ctx.lineTo(width, height); ctx.closePath();
  ctx.fillStyle = driftFill || (driftFill = (() => {
    const gradient = ctx.createLinearGradient(0, height - driftMax(), 0, height);
    gradient.addColorStop(0, 'rgba(255,252,246,.92)'); gradient.addColorStop(1, 'rgba(226,234,246,.8)');
    return gradient;
  })());
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,248,232,.32)'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  ctx.stroke();
}
let driftFill = null;
function draw(time) {
  const dt = last ? Math.min((time - last) / 16.67, 3) : 1; last = time;
  const open = !overlay.hidden, still = motion.matches;
  const pointerFresh = performance.now() - pointer.seen < 150;
  ctx.clearRect(0, 0, width, height);
  const wind = Math.sin(time / 8700) * .32 + Math.sin(time / 3100) * .12;
  for (const f of flakes) {
    if (!still) {
      if (pointerFresh) {
        const dx = f.x - pointer.x, dy = f.y - pointer.y, d = Math.hypot(dx, dy), R = width < 700 ? 70 : 95;
        if (d < R && d > .1) {
          const push = (1 - d / R) * .45 * (.4 + f.depth);
          f.px += dx / d * push + pointer.vx * .02 * (1 - d / R);
          f.py += dy / d * push + pointer.vy * .02 * (1 - d / R);
        }
      }
      const damp = Math.pow(.93, dt);
      f.px *= damp; f.py *= damp;
      f.y += (f.speed * (1 + .12 * Math.sin(time / 1600 + f.phase)) + f.py) * dt;
      f.x += (wind * (.35 + f.depth) + f.drift + Math.sin(time / 2400 + f.phase) * f.sway + f.px) * dt;
      const floor = height - (open ? 0 : driftAt(f.x));
      if (f.y > floor) {
        if (!open && f.y < height + 5 && f.x > 0 && f.x < width) settle(f.x, f.r);
        f.y = -5; f.x = Math.random() * width; f.px = f.py = 0;
      }
      if (f.y < -40) f.y = -5;
      if (f.x > width + 5) f.x = -5;
      if (f.x < -5) f.x = width + 5;
    }
    // Set the flake's matrix directly instead of save/translate/rotate/scale/restore per flake
    // (about 3× cheaper). The tiny far flakes are round dots, so they skip the rotation.
    ctx.globalAlpha = f.opacity * (open ? .65 : 1);
    const size = f.r * (f.layer === 2 ? 3 : 2.6), half = size / 2;
    if (f.layer === 0) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.drawImage(snowSprites[0], f.x - half, f.y - half, size, size);
    } else {
      const angle = f.phase + (still ? 0 : time / 1000 * f.spin);
      const flutter = still ? 1 : .8 + .2 * Math.sin(time / 1300 + f.phase);
      const cos = Math.cos(angle) * dpr, sin = Math.sin(angle) * dpr;
      ctx.setTransform(cos, sin, -sin * flutter, cos * flutter, f.x * dpr, f.y * dpr);
      ctx.drawImage(snowSprites[f.layer], -half, -half, size, size);
    }
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
  if (!still) drawDrift(dt, open);
  if (window.sleighTrail && time) window.sleighTrail.draw(ctx, dt);
  if (window.goldBurst && time) window.goldBurst.draw(ctx, dt);
}
function animate(time) { draw(time); frame = requestAnimationFrame(animate); }
function startSnow() { cancelAnimationFrame(frame); last = 0; draw(0); if (!motion.matches && !document.hidden) frame = requestAnimationFrame(animate); }
window.addEventListener('resize', () => { resize(); startSnow(); }); motion.addEventListener('change', startSnow);
document.addEventListener('visibilitychange', () => { startSnow(); if (document.hidden) music.pause(); else music.resume(); });
resize(); startSnow();
