'use strict';
// Finishing touches layered on top of app.js: loading veil, countdown to the party, the
// "what will Hà Linh pick" guessing game, gold-foil confetti and the tilting invitation card.
(() => {
  const $ = id => document.getElementById(id);
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  const overlay = $('overlay');
  const invitation = document.querySelector('.invitation');
  const cardScene = $('card-scene');
  const clamp = (v, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, v));

  /* ---------- Loading veil: wait for the painting, the sleigh and the fonts (max 7s) ---------- */
  const loader = $('loader');
  const imageReady = src => new Promise(resolve => {
    const image = new Image();
    image.onload = () => (image.decode ? image.decode().catch(() => {}) : Promise.resolve()).then(resolve);
    image.onerror = resolve;
    image.src = src;
  });
  const sleighImage = document.querySelector('.sleigh-art');
  // Fonts come from Google and may be slow: wait for them only briefly, then let them swap in.
  const fontsBriefly = document.fonts ? Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 1200))]) : null;
  Promise.race([
    Promise.all([imageReady('assets/winter-moon.webp'), imageReady(sleighImage ? sleighImage.currentSrc || sleighImage.src : ''), fontsBriefly]),
    new Promise(resolve => setTimeout(resolve, 7000))
  ]).then(() => {
    loader.classList.add('leaving');
    root.classList.remove('is-loading');
    setTimeout(() => loader.remove(), 900);
  });

  /* ---------- Countdown to 18:00, 20 December 2026 (GMT+7) ---------- */
  const EVENT_START = Date.UTC(2026, 11, 20, 11, 0, 0);
  const EVENT_END = EVENT_START + 3 * 3600e3;
  const countdown = $('countdown');
  const UNITS = [['d', 'NGÀY'], ['h', 'GIỜ'], ['m', 'PHÚT'], ['s', 'GIÂY']];
  let countdownMode = '';
  function setCountdownMode(mode) {
    if (mode === countdownMode) return;
    countdownMode = mode;
    countdown.className = `footer-date countdown is-${mode}`;
    if (mode === 'before') {
      countdown.innerHTML = `<span class="cd-label" aria-hidden="true">${i18n.t('CÒN')} <i>·</i> ${i18n.t('ĐẾN 20.12.2026')}</span><span class="cd-row" aria-hidden="true">${UNITS.map(([key, label]) => `<span class="cd-unit"><b data-unit="${key}">00</b><small>${i18n.t(label)}</small></span>`).join('')}</span>`;
      countdown.setAttribute('role', 'timer');
    } else {
      countdown.removeAttribute('role');
      countdown.removeAttribute('aria-label');
      countdown.innerHTML = mode === 'during'
        ? `<span class="cd-label">${i18n.t('HÔM NAY')} <i>·</i> 20.12.2026</span><span class="cd-now">${i18n.t('Tiệc đang diễn ra ✧')}</span>`
        : `<span class="cd-label">20 <i>·</i> 12 <i>·</i> 2026</span><span class="cd-now">${i18n.t('Cảm ơn bạn đã chung vui cùng Hà Linh')}</span>`;
    }
  }
  let lastLabel = '';
  function tick() {
    const now = Date.now();
    if (now >= EVENT_END) { setCountdownMode('after'); return; }
    if (now >= EVENT_START) { setCountdownMode('during'); return; }
    setCountdownMode('before');
    let left = Math.floor((EVENT_START - now) / 1000);
    const values = {d: Math.floor(left / 86400), h: Math.floor(left % 86400 / 3600), m: Math.floor(left % 3600 / 60), s: left % 60};
    for (const [key] of UNITS) {
      const cell = countdown.querySelector(`[data-unit="${key}"]`);
      const text = String(values[key]).padStart(2, '0');
      if (cell.textContent === text) continue;
      cell.textContent = text;
      if (!motion.matches) cell.animate([{transform: 'translateY(-38%)', opacity: 0}, {transform: 'none', opacity: 1}], {duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)'});
    }
    const label = i18n.t('Còn {d} ngày {h} giờ {m} phút đến tiệc thôi nôi', values);
    if (label !== lastLabel) { countdown.setAttribute('aria-label', label); lastLabel = label; }
  }
  tick();
  setInterval(tick, 1000);
  document.addEventListener('languagechange', () => { countdownMode = ''; lastLabel = ''; tick(); });

  /* ---------- Gold-foil confetti, drawn on the snow canvas by app.js ---------- */
  const GOLD = ['#f6dc9c', '#e2b866', '#c9973f', '#fff1cf', '#d7a952', '#b8873a'];
  const pieces = [];
  window.goldBurst = {
    burst(x, y, {count = 80, power = 1} = {}) {
      if (motion.matches) return;
      for (let i = 0; i < count; i++) {
        const angle = -Math.PI / 2 + (Math.random() - .5) * Math.PI * 1.25;
        const speed = (3 + Math.random() * 7.5) * power;
        const kind = Math.random();
        pieces.push({
          x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1.5,
          rot: Math.random() * Math.PI, vr: (Math.random() - .5) * .3,
          flip: Math.random() * Math.PI, vf: .08 + Math.random() * .16,
          w: 4 + Math.random() * 5, h: 2 + Math.random() * 3,
          shape: kind < .55 ? 'foil' : kind < .8 ? 'star' : 'dot',
          color: GOLD[Math.floor(Math.random() * GOLD.length)],
          life: 0, max: 120 + Math.random() * 80
        });
      }
    },
    draw(ctx, dt) {
      if (!pieces.length) return;
      ctx.save();
      const base = ctx.getTransform(); // device-pixel scale set by app.js
      for (let i = pieces.length - 1; i >= 0; i--) {
        const p = pieces[i];
        p.life += dt;
        if (p.life > p.max) { pieces.splice(i, 1); continue; }
        const drag = Math.pow(.975, dt);
        p.vx *= drag; p.vy = p.vy * drag + .16 * dt;
        p.x += p.vx * dt + Math.sin(p.life * .05 + p.flip) * .4; p.y += p.vy * dt;
        p.rot += p.vr * dt; p.flip += p.vf * dt;
        ctx.globalAlpha = Math.min(1, (1 - p.life / p.max) * 2.2);
        ctx.fillStyle = p.color;
        ctx.setTransform(base);
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        if (p.shape === 'foil') { ctx.scale(1, Math.cos(p.flip)); ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
        else if (p.shape === 'star') {
          const r = p.w * .55, k = .5 + .5 * Math.abs(Math.cos(p.flip));
          ctx.beginPath();
          for (let j = 0; j < 8; j++) { const a = j * Math.PI / 4, rr = j % 2 ? r * .3 : r * k; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
          ctx.closePath(); ctx.fill();
        } else { ctx.beginPath(); ctx.arc(0, 0, p.h * .6, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.restore();
    }
  };
  const burstFrom = (rect, options) => window.goldBurst.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, options);
  document.addEventListener('envelope:open', () => {
    const rect = $('seal').getBoundingClientRect();
    setTimeout(() => burstFrom(rect, {count: 90}), 140);
  });
  document.addEventListener('rsvp:sent', event => { if (event.detail.attending) burstFrom(event.detail.from, {count: 90}); });

  /* ---------- Tilting card with a foil sheen ---------- */
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const target = {x: 0, y: 0}, current = {x: 0, y: 0};
  let tiltFrame = 0, lastTilt = 0, orientationSeen = 0, base = null;
  const tiltActive = () => !motion.matches && stage === 'card' && !cardScene.hidden && !cardScene.classList.contains('extracting-card');
  function tiltLoop(time) {
    const dt = lastTilt ? Math.min((time - lastTilt) / 16.67, 3) : 1; lastTilt = time;
    if (!tiltActive()) { target.x = target.y = 0; }
    else if (!finePointer.matches && time - orientationSeen > 1500) {
      // No gyroscope data (e.g. iPhone without motion permission): a slow, gentle sway.
      target.x = Math.sin(time / 2300) * .45; target.y = Math.cos(time / 3100) * .3;
    }
    const k = 1 - Math.pow(.9, dt);
    current.x += (target.x - current.x) * k; current.y += (target.y - current.y) * k;
    invitation.style.setProperty('--ry', `${(current.x * 6).toFixed(2)}deg`);
    invitation.style.setProperty('--rx', `${(-current.y * 5).toFixed(2)}deg`);
    invitation.style.setProperty('--shine', `${(50 - current.x * 45 - current.y * 15).toFixed(1)}%`);
    invitation.style.setProperty('--shine-o', Math.min(1, Math.hypot(current.x, current.y) * 1.6).toFixed(2));
    const resting = !tiltActive() && Math.abs(current.x) < .002 && Math.abs(current.y) < .002;
    tiltFrame = resting || overlay.hidden ? 0 : requestAnimationFrame(tiltLoop);
  }
  function kickTilt() { if (!tiltFrame && !overlay.hidden) { lastTilt = 0; tiltFrame = requestAnimationFrame(tiltLoop); } }
  overlay.addEventListener('pointermove', event => {
    if (!finePointer.matches || event.pointerType !== 'mouse') return;
    const rect = invitation.getBoundingClientRect();
    target.x = clamp((event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2));
    target.y = clamp((event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2));
    kickTilt();
  }, {passive: true});
  overlay.addEventListener('pointerleave', () => { target.x = target.y = 0; });
  window.addEventListener('deviceorientation', event => {
    if (finePointer.matches || event.gamma == null || event.beta == null) return;
    // Measure against a slowly moving rest position, so any comfortable way of holding the phone works.
    if (!base) base = {g: event.gamma, b: event.beta};
    base.g += (event.gamma - base.g) * .01; base.b += (event.beta - base.b) * .01;
    target.x = clamp((event.gamma - base.g) / 16); target.y = clamp((event.beta - base.b) / 16);
    orientationSeen = performance.now();
    kickTilt();
  });
  // Android delivers motion data without asking. iOS would show a permission prompt, which feels
  // out of place on an invitation, so iPhones get the gentle automatic sway instead.
  new MutationObserver(kickTilt).observe(cardScene, {attributes: true, attributeFilter: ['hidden', 'class']});
  new MutationObserver(kickTilt).observe(overlay, {attributes: true, attributeFilter: ['hidden']});

  /* ---------- Calendar: the button for this device comes first ---------- */
  const apple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
  if (!apple) $('calendar-ics').parentElement.append($('calendar-ics'));
  $('calendar-ics').addEventListener('click', () => announce('Đang mở lịch trên thiết bị…'));

  /* ---------- "Đoán xem bé bốc gì?" ---------- */
  const sheet = window.sheet;
  const grid = $('game-grid'), results = $('game-results'), bars = $('game-bars');
  const pick = $('game-pick'), note = $('game-note'), change = $('game-change'), intro = $('game-intro');
  const items = [...grid.querySelectorAll('.game-item')];
  const ITEM = Object.fromEntries(items.map(button => [button.dataset.item, {get name() { return button.querySelector('b').textContent; }, get meaning() { return button.querySelector('small').textContent; }}]));
  let choosing = false, tally = null;
  const myVote = () => { const vote = sheet.store.get('aristia-vote'); return ITEM[vote] ? vote : null; };

  function renderGame() {
    const vote = myVote(), showResults = vote && !choosing;
    items.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.item === vote)));
    grid.hidden = !!showResults; intro.hidden = !!showResults; results.hidden = !showResults;
    if (!showResults) return;
    pick.innerHTML = `${i18n.t('Bạn đoán Hà Linh sẽ bốc')} <b>${ITEM[vote].name}</b> · ${ITEM[vote].meaning}`;
    bars.innerHTML = ''; bars.hidden = true;
    if (!sheet.ready) {
      i18n.text(note, 'Bản xem thử · Khi nối Google Sheets, dự đoán của mọi người sẽ hiện ở đây. Kết quả thật được bật mí trong tiệc tối 20.12.');
      return;
    }
    i18n.text(note, 'Đang tải dự đoán của mọi người…');
    sheet.get({action: 'tally'}).then(data => showTally(data.counts || {}, vote)).catch(() => {
      i18n.text(note, 'Chưa tải được dự đoán của mọi người. Kết quả thật được bật mí trong tiệc tối 20.12.');
    });
  }
  function showTally(counts, vote) {
    tally = counts;
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0) || 1;
    const rows = Object.keys(ITEM).map(key => ({key, n: counts[key] || 0})).sort((a, b) => b.n - a.n);
    bars.innerHTML = rows.map(({key, n}) => {
      const share = Math.round(n / total * 100);
      return `<li class="${key === vote ? 'mine' : ''}"><span class="gb-name">${ITEM[key].name}</span><span class="gb-track"><i style="--p:0%" data-p="${share}%"></i></span><span class="gb-value">${share}%</span></li>`;
    }).join('');
    bars.hidden = false;
    i18n.text(note, '{total} lượt đoán · Kết quả thật được bật mí trong tiệc tối 20.12.', {total});
    requestAnimationFrame(() => requestAnimationFrame(() => bars.querySelectorAll('i').forEach(bar => bar.style.setProperty('--p', bar.dataset.p))));
  }
  items.forEach(button => button.addEventListener('click', async () => {
    if (items.some(item => item.disabled)) return;
    const vote = button.dataset.item;
    if (sheet.ready) {
      items.forEach(item => { item.disabled = true; });
      try { await sheet.post({type: 'vote', item: vote}); }
      catch (error) { console.error(error); announce('Chưa gửi được dự đoán. Hãy thử lại sau.'); return; }
      finally { items.forEach(item => { item.disabled = false; }); }
    }
    sheet.store.set('aristia-vote', vote);
    choosing = false;
    burstFrom(button.getBoundingClientRect(), {count: 46, power: .75});
    renderGame();
    pick.focus({preventScroll: true});
  }));
  change.addEventListener('click', () => {
    choosing = true; renderGame();
    (grid.querySelector('[aria-pressed="true"]') || items[0]).focus({preventScroll: true});
  });
  document.addEventListener('languagechange', () => {
    const vote = myVote();
    if (!vote || choosing) return;
    pick.innerHTML = `${i18n.t('Bạn đoán Hà Linh sẽ bốc')} <b>${ITEM[vote].name}</b> · ${ITEM[vote].meaning}`;
    if (tally) showTally(tally, vote);
  });
  const openGame = () => { choosing = false; renderGame(); showGuestStep('game', 'game-title'); };
  $('calendar-game').addEventListener('click', openGame);
  $('game-back').addEventListener('click', () => showGuestStep('card', 'rsvp-open'));
})();
