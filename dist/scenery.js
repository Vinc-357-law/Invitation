'use strict';
// Living backdrop for the moonlit landscape: twinkling stars, frequent shooting stars,
// fairy lights that flicker exactly where the painting has them, a breathing moon halo
// and gentle pointer parallax. Everything is anchored to winter-moon.png (1536 × 1024)
// through the same "cover" placement CSS uses, so it stays aligned at any screen size.
(() => {
  const world = document.getElementById('world');
  const backdrop = world && world.querySelector('.backdrop');
  const canvas = document.getElementById('sky');
  if (!backdrop || !canvas) return;
  const ctx = canvas.getContext('2d');
  const halo = backdrop.querySelector('.moon-halo');
  const overlay = document.getElementById('overlay');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = window.matchMedia('(max-width: 700px)');
  const IMG_W = 1536, IMG_H = 1024;
  const MOON = {x: .5, y: .33, r: .122};      // centre and radius in image units (r × image width)
  const SKY_BOTTOM = .45;                      // below this the mountains begin
  let W = 0, H = 0, place = null, stars = [], lights = [], lightSeeds = [], meteors = [], nextMeteor = 0, frame = 0;

  // Same maths as background-size: cover + background-position.
  function cover() {
    const s = Math.max(W / IMG_W, H / IMG_H), w = IMG_W * s, h = IMG_H * s;
    const py = narrow.matches ? .5 : .53;
    return {s, w, h, x: (W - w) * .5, y: (H - h) * py};
  }
  const toScreen = (u, v) => [place.x + u * place.w, place.y + v * place.h];

  function layout() {
    W = backdrop.offsetWidth; H = backdrop.offsetHeight;
    if (!W || !H) return;
    const dpr = Math.min(window.devicePixelRatio || 1, narrow.matches ? 1.5 : 2); // phones: 1.5× is plenty for soft stars
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    place = cover();
    const [mx, my] = toScreen(MOON.x, MOON.y), mr = MOON.r * place.w;
    if (halo) {
      const size = mr * 3.6;
      halo.style.width = halo.style.height = `${size}px`;
      halo.style.left = `${mx - size / 2}px`; halo.style.top = `${my - size / 2}px`;
    }
    // Stars only in open sky: above the mountains and off the moon's face.
    const skyBottom = place.y + SKY_BOTTOM * place.h, count = W < 700 ? 46 : 80;
    stars = [];
    for (let tries = 0; stars.length < count && tries < count * 20; tries++) {
      const x = Math.random() * W, y = Math.random() * Math.min(skyBottom, H);
      if (Math.hypot(x - mx, y - my) < mr * 1.25) continue;
      const big = Math.random() < .12;
      stars.push({x, y, r: big ? 1.1 + Math.random() * .7 : .45 + Math.random() * .6, base: big ? .75 : .35 + Math.random() * .35, speed: .6 + Math.random() * 1.6, phase: Math.random() * 7, big});
    }
    lights = lightSeeds.map(([u, v, strength]) => { const [x, y] = toScreen(u, v); return {x, y, strength, speed: 1.4 + Math.random() * 2.6, phase: Math.random() * 7, r: (narrow.matches ? 8 : 11) * (.7 + strength * .5)}; })
      .filter(l => l.x > -10 && l.x < W + 10 && l.y > -10 && l.y < H + 10);
    canvas.dataset.lights = String(lights.length);
    draw(performance.now());
  }

  // Find the painted fairy lights: small warm, bright spots on the trees at both sides.
  function findLights(img) {
    const sw = 768, sh = 512, c = document.createElement('canvas'); c.width = sw; c.height = sh;
    const g = c.getContext('2d', {willReadFrequently: true}); g.drawImage(img, 0, 0, sw, sh);
    let data; try { data = g.getImageData(0, 0, sw, sh).data; } catch { return []; }
    const score = new Float32Array(sw * sh);
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      const u = x / sw, v = y / sh;
      if (v < .12 || v > .9 || (u > .27 && u < .73)) continue; // trees frame the left and right
      const i = (y * sw + x) * 4, r = data[i], gr = data[i + 1], b = data[i + 2];
      const warm = r - b, bright = (r + gr + b) / 3;
      if (r > 175 && gr > 115 && warm > 45 && bright > 125) score[y * sw + x] = bright + warm;
    }
    const found = [], R = 4;
    for (let y = R; y < sh - R; y++) for (let x = R; x < sw - R; x++) {
      const s = score[y * sw + x]; if (!s) continue;
      let peak = true;
      for (let dy = -R; dy <= R && peak; dy++) for (let dx = -R; dx <= R; dx++) if ((dx || dy) && score[(y + dy) * sw + x + dx] >= s && (dy < 0 || (dy === 0 && dx < 0) || score[(y + dy) * sw + x + dx] > s)) { peak = false; break; }
      if (peak) found.push([(x + .5) / sw, (y + .5) / sh, s]);
    }
    found.sort((a, b) => b[2] - a[2]);
    const max = found.length ? found[0][2] : 1;
    return found.slice(0, 90).map(([u, v, s]) => [u, v, Math.min(1, s / max)]);
  }

  // A soft warm glow sprite, drawn once.
  const sprite = document.createElement('canvas'); sprite.width = sprite.height = 64;
  { const g = sprite.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,236,190,1)'); grad.addColorStop(.18, 'rgba(255,205,120,.75)'); grad.addColorStop(.5, 'rgba(255,170,80,.18)'); grad.addColorStop(1, 'rgba(255,160,70,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64); }

  function draw(time) {
    if (!place) return;
    const t = time / 1000, still = motion.matches;
    ctx.clearRect(0, 0, W, H);
    for (const s of stars) {
      const a = still ? s.base : s.base * (.45 + .55 * (.5 + .5 * Math.sin(t * s.speed + s.phase)));
      ctx.fillStyle = `rgba(255,250,236,${a.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      if (s.big && a > .6) { // tiny cross glint on the brightest stars
        ctx.strokeStyle = `rgba(255,248,230,${((a - .6) * .9).toFixed(3)})`; ctx.lineWidth = .6;
        ctx.beginPath(); ctx.moveTo(s.x - s.r * 4, s.y); ctx.lineTo(s.x + s.r * 4, s.y); ctx.moveTo(s.x, s.y - s.r * 4); ctx.lineTo(s.x, s.y + s.r * 4); ctx.stroke();
      }
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      const wave = .5 + .5 * Math.sin(t * l.speed + l.phase), shimmer = .7 + .3 * Math.sin(t * l.speed * 2.7 + l.phase * 3);
      const flicker = still ? .45 : .12 + .88 * wave * wave * shimmer;
      ctx.globalAlpha = Math.min(1, flicker * (.6 + l.strength * .4));
      const r = l.r * (.85 + flicker * .35);
      ctx.drawImage(sprite, l.x - r, l.y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    if (!still) drawMeteor(time);
    ctx.restore();
  }

  function drawMeteor(time) {
    // Stagger small showers instead of waiting for one trail to finish.
    if (time >= nextMeteor) {
      const skyBottom = place.y + SKY_BOTTOM * place.h, dir = -1;
      const count = Math.random() < .4 ? 2 : 1;
      for (let i = 0; i < count && meteors.length < 4; i++) {
        const meteor = {x: W * (.1 + Math.random() * .8), y: Math.max(20, skyBottom * (.05 + Math.random() * .3)), dx: dir * (.55 + Math.random() * .3), dy: .32 + Math.random() * .18, len: Math.min(220, W * (.13 + Math.random() * .06)), start: time + i * 280, dur: 900 + Math.random() * 500};
        const n = Math.hypot(meteor.dx, meteor.dy); meteor.dx /= n; meteor.dy /= n;
        meteors.push(meteor);
      }
      nextMeteor = time + 1400 + Math.random() * 1400;
    }
    meteors = meteors.filter(meteor => time < meteor.start + meteor.dur);
    for (const meteor of meteors) {
    const p = (time - meteor.start) / meteor.dur;
    if (p <= 0) continue;
    const travel = Math.min(W, H) * .5 * p, hx = meteor.x + meteor.dx * travel, hy = meteor.y + meteor.dy * travel;
    const tail = meteor.len * Math.min(1, p * 3), fade = p < .15 ? p / .15 : 1 - Math.max(0, (p - .6) / .4);
    const grad = ctx.createLinearGradient(hx, hy, hx - meteor.dx * tail, hy - meteor.dy * tail);
    grad.addColorStop(0, `rgba(255,252,240,${(.9 * fade).toFixed(3)})`); grad.addColorStop(1, 'rgba(255,240,210,0)');
    ctx.strokeStyle = grad; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - meteor.dx * tail, hy - meteor.dy * tail); ctx.stroke();
    }
  }

  const active = () => !motion.matches && !document.hidden && (!overlay || overlay.hidden);
  function loop(time) { draw(time); frame = active() ? requestAnimationFrame(loop) : 0; }
  function restart() { cancelAnimationFrame(frame); frame = 0; meteors = []; if (active()) { nextMeteor = performance.now() + 600 + Math.random() * 800; frame = requestAnimationFrame(loop); } else draw(performance.now()); }

  // Pointer parallax (mouse only): the whole backdrop drifts a few pixels against the cursor.
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    window.addEventListener('pointermove', event => {
      if (motion.matches || (overlay && !overlay.hidden)) return;
      backdrop.style.setProperty('--px', `${((event.clientX / innerWidth) - .5) * -16}px`);
      backdrop.style.setProperty('--py', `${((event.clientY / innerHeight) - .5) * -10}px`);
    }, {passive: true});
  }

  const img = new Image();
  img.onload = () => { lightSeeds = findLights(img); layout(); };
  img.src = 'assets/winter-moon.webp';
  layout(); restart();
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(layout, 120); });
  narrow.addEventListener('change', layout);
  document.addEventListener('visibilitychange', restart);
  motion.addEventListener('change', restart);
  if (overlay) new MutationObserver(restart).observe(overlay, {attributes: true, attributeFilter: ['hidden']});
})();
