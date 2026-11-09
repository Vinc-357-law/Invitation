'use strict';
// Brings the sleigh illustration to life without cutting it apart: a WebGL shader
// gently warps the single painting so each reindeer gallops (bob, pitch, leg swing) on
// its own rhythm while the reins, harness and sleigh stay continuous.
//
// Nine reindeer from one painting of four: the team is drawn three times from the same texture,
//   1. the far row  – the four reindeer again, a little ahead, higher, smaller and darker,
//   2. the near row – the painting as is (sleigh, Santa and four reindeer),
//   3. Rudolph      – the lead reindeer cut out along LEAD and set ahead, with a glowing red nose,
// each layer galloping on its own phase. The reins that join the layers are drawn on a 2D canvas
// above, re-anchored every frame to where the warp has moved their ends.
// Coordinates are pixels of the source painting (2161 × 728); "team space" is the wider
// canvas the three layers share (TEAM_W × TEAM_H). assets/santa-team.webp is the same
// composition, pre-rendered, for when WebGL or motion is off.
(() => {
  const button = document.getElementById('sleigh');
  const fallback = button && button.querySelector('.sleigh-art');
  if (!button || !fallback) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const SRC_W = 2161, SRC_H = 728;
  const TEAM_W = 2521, TEAM_H = 734;
  const TEAM_X = 700;                                   // the reindeer begin here in the painting
  const FAR = {off: [770, 0], scale: .93, src0: [TEAM_X, 0], clipX: TEAM_X};
  const RUD = [330, 6];                                 // Rudolph's place ahead of the lead pair
  const LEAD = [[1850, 0], [2161, 0], [2161, 560], [1905, 560], [1840, 412], [1815, 432], [1790, 474], [1768, 528],
    [1734, 524], [1738, 478], [1757, 462], [1777, 444], [1794, 420], [1798, 395], [1800, 358], [1803, 314],
    [1822, 290], [1872, 263], [1871, 202], [1850, 180]];
  const NOSE = [2135, 197];
  // [from (painting, layer), to (painting, layer), width, shade]
  const REINS = [
    [[552, 251], 'near', [700, 280], 'far', 2.8, .7],
    [[552, 258], 'near', [700, 312], 'far', 2.8, .7],
    [[552, 259], 'near', [700, 317], 'far', 4.2, .7],
    [[1874, 267], 'near', [1874, 267], 'rud', 3, 1],
    [[1874, 273], 'near', [1874, 273], 'rud', 2.4, 1]
  ];
  const img = new Image();

  // [body, cx, cy, rx, ry, leg (+1 front / -1 hind / 0), hipY, legLength]
  const BLOBS = [
    [0, 330, 380, 380, 300, 0, 0, 0],      // sleigh + Santa
    [0, 650, 500, 70, 125, 0, 0, 0],       // sleigh front scroll
    [1, 960, 380, 230, 85, 0, 0, 0],       // reindeer 1 torso
    [1, 1140, 210, 150, 120, 0, 0, 0],     //   head + antlers
    [1, 790, 490, 80, 80, -1, 430, 130],   //   hind legs
    [1, 1110, 500, 70, 90, 1, 430, 140],   //   front legs
    [2, 1350, 370, 190, 80, 0, 0, 0],      // reindeer 2
    [2, 1480, 190, 140, 130, 0, 0, 0],
    [2, 1180, 490, 50, 70, -1, 440, 110],
    [2, 1430, 480, 70, 60, 1, 430, 100],
    [3, 1650, 350, 160, 80, 0, 0, 0],      // reindeer 3
    [3, 1750, 170, 140, 120, 0, 0, 0],
    [3, 1500, 465, 45, 55, -1, 420, 95],
    [3, 1715, 455, 60, 55, 1, 400, 110],
    [4, 1950, 320, 170, 80, 0, 0, 0],      // reindeer 4 (lead)
    [4, 2040, 160, 140, 120, 0, 0, 0],
    [4, 1780, 450, 40, 60, -1, 400, 110],
    [4, 2020, 420, 70, 55, 1, 380, 90]
  ];
  const PIVOTS = [[420, 610], [960, 370], [1360, 350], [1650, 330], [1940, 310]];
  const LANTERN = [56, 326], TRAIL = [34, 606];
  const N = BLOBS.length, P = LEAD.length;

  const canvas = document.createElement('canvas');
  canvas.className = 'sleigh-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const reinCanvas = document.createElement('canvas');
  reinCanvas.className = 'sleigh-canvas sleigh-reins';
  reinCanvas.setAttribute('aria-hidden', 'true');
  const rctx = reinCanvas.getContext('2d');
  const gl = canvas.getContext('webgl', {premultipliedAlpha: true, alpha: true, antialias: false});
  if (!gl || !rctx) return;

  const vs = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  // q: team space · p: painting space of this layer · s: where the warp samples the painting.
  const fs = `precision highp float;
#define N ${N}
#define P ${P}
uniform sampler2D u_tex;uniform vec2 u_res,u_off,u_src,u_lantern,u_src0,u_nose;
uniform float u_scale,u_bright,u_glow,u_sat,u_noseGlow,u_usePoly;
uniform vec4 u_layer;
uniform vec4 u_geom[N];uniform vec4 u_dyn[N];uniform vec4 u_piv[N];uniform vec2 u_poly[P];
bool inPoly(vec2 s){bool c=false;vec2 b=u_poly[P-1];
  for(int i=0;i<P;i++){vec2 a=u_poly[i];if((a.y>s.y)!=(b.y>s.y)&&s.x<(b.x-a.x)*(s.y-a.y)/(b.y-a.y)+a.x)c=!c;b=a;}
  return c;}
void main(){
  vec2 q=(vec2(gl_FragCoord.x,u_res.y-gl_FragCoord.y)-u_off)/u_scale;
  vec2 p=(q-u_layer.xy)/u_layer.z+u_src0;
  float q4[N];float qmin=1e9;
  for(int i=0;i<N;i++){vec2 r=(p-u_geom[i].xy)/u_geom[i].zw;float qq=dot(r,r);q4[i]=qq*qq;qmin=min(qmin,q4[i]);}
  vec2 d=vec2(0.);float ws=0.;
  for(int i=0;i<N;i++){
    float w=exp(qmin-q4[i]);vec4 m=u_dyn[i];vec4 v=u_piv[i];vec2 rel=p-v.xy;
    vec2 di=vec2(m.z*rel.y+m.x,-m.z*rel.x+m.y);
    if(v.w>0.)di.x+=m.w*clamp((p.y-v.z)/v.w,0.,1.);
    d+=w*di;ws+=w;}
  vec2 s=p-d/ws;vec2 uv=s/u_src;
  vec4 c=vec4(0.);
  if(uv.x>=0.&&uv.x<=1.&&uv.y>=0.&&uv.y<=1.&&s.x>=u_layer.w&&(u_usePoly<.5||inPoly(s)))c=texture2D(u_tex,uv);
  if(c.a>.002){vec3 rgb=c.rgb/c.a;rgb=(rgb*u_bright-.5)*1.1+.5;rgb=mix(vec3(dot(rgb,vec3(.3,.59,.11))),rgb,u_sat);c.rgb=clamp(rgb,0.,1.)*c.a;}
  vec2 l=s-u_lantern;float g=u_glow*exp(-dot(l,l)/1500.);
  vec4 o=c+vec4(vec3(1.,.74,.4)*g*.5,g*.5)*(1.-c.a);
  if(u_noseGlow>0.){vec2 n=s-u_nose;float dn=dot(n,n);
    float core=u_noseGlow*exp(-dn/70.),halo=u_noseGlow*.5*exp(-dn/900.);
    o.rgb=o.rgb*(1.-core*.85)+vec3(1.,.38,.32)*core;o.a=max(o.a,core);
    o+=vec4(vec3(1.,.24,.2)*halo,halo)*(1.-o.a);}
  gl_FragColor=o;
}`;
  const compile = (type, src) => { const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch (error) { console.warn('Sleigh animation unavailable:', error); return; }
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aLoc = gl.getAttribLocation(program, 'a');
  gl.enableVertexAttribArray(aLoc); gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
  const U = name => gl.getUniformLocation(program, name);
  const u = Object.fromEntries(['res', 'off', 'src', 'scale', 'bright', 'glow', 'lantern', 'geom', 'dyn', 'piv', 'src0', 'nose', 'sat', 'noseGlow', 'usePoly', 'layer', 'poly'].map(name => [name, U('u_' + name)]));
  const geom = new Float32Array(N * 4), pivStd = new Float32Array(N * 4), pivRud = new Float32Array(N * 4);
  BLOBS.forEach((b, i) => {
    geom.set([b[1], b[2], b[3], b[4]], i * 4);
    const pv = PIVOTS[b[0]]; pivStd.set([pv[0], pv[1], b[6], b[5] ? b[7] : 0], i * 4);
    // Rudolph is all lead reindeer: every region turns about its pivot; only its own legs swing.
    const own = b[0] === 4, pr = PIVOTS[4]; pivRud.set([pr[0], pr[1], b[6], own && b[5] ? b[7] : 0], i * 4);
  });
  gl.uniform4fv(u.geom, geom);
  gl.uniform2fv(u.poly, new Float32Array(LEAD.flat()));
  gl.uniform2f(u.src, SRC_W, SRC_H); gl.uniform2f(u.lantern, LANTERN[0], LANTERN[1]); gl.uniform2f(u.nose, NOSE[0], NOSE[1]);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied "over": far → near → Rudolph
  const dynNear = new Float32Array(N * 4), dynFar = new Float32Array(N * 4), dynRud = new Float32Array(N * 4);
  const LAYERS = {
    far: {off: FAR.off, scale: FAR.scale, src0: FAR.src0, clipX: FAR.clipX, bright: .62, sat: .8, dyn: dynFar, piv: pivStd},
    near: {off: [0, 0], scale: 1, src0: [0, 0], clipX: -1e4, bright: 1, sat: 1, lantern: true, dyn: dynNear, piv: pivStd},
    rud: {off: RUD, scale: 1, src0: [0, 0], clipX: -1e4, bright: 1, sat: 1, nose: true, poly: true, dyn: dynRud, piv: pivRud}
  };
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);

  const body = button.querySelector('.sleigh-body') || button;
  let layout = null, ready = false, frame = 0, bright = .72, brightTarget = .72;
  function upload() {
    const rect = body.getBoundingClientRect();
    const cssW = body.offsetWidth || rect.width, cssH = body.offsetHeight || rect.height;
    if (!cssW || !cssH) return false;
    // The shader runs per pixel; 1.5× keeps the art crisp at its small on-screen size while
    // halving the work on 3× phone screens.
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = reinCanvas.width = Math.round(cssW * dpr); canvas.height = reinCanvas.height = Math.round(cssH * dpr);
    // Same placement as object-fit: contain of the team space, slightly inset so motion never clips.
    const fit = Math.min(cssW / TEAM_W, cssH / TEAM_H) * .97;
    const offCss = [(cssW - TEAM_W * fit) / 2, (cssH - TEAM_H * fit) / 2];
    layout = {fit, offCss, dpr};
    // Downscale once on the CPU with high-quality smoothing (avoids shimmer when warping).
    const texW = Math.min(SRC_W, Math.ceil(SRC_W * fit * dpr * 1.25)), texH = Math.round(texW * SRC_H / SRC_W);
    const scratch = document.createElement('canvas'); scratch.width = texW; scratch.height = texH;
    const c2 = scratch.getContext('2d'); c2.imageSmoothingQuality = 'high'; c2.drawImage(img, 0, 0, texW, texH);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scratch);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(u.res, canvas.width, canvas.height);
    gl.uniform2f(u.off, offCss[0] * dpr, offCss[1] * dpr);
    gl.uniform1f(u.scale, fit * dpr);
    return true;
  }

  // Gallop rhythm: neighbouring reindeer run nearly opposite (as harnessed teams do), the lead
  // slightly ahead. A slower stride with smaller bends than before keeps the painted bodies from
  // looking rubbery; the second harmonic gives each stride a quick push and a soft float.
  // The far row runs half a beat out of step with its partners; Rudolph keeps his own beat.
  const GALLOP = Math.PI * 2 / .9, STEP = Math.PI - .55;
  function fillDyn(out, t, phase, rudolph) {
    for (let i = 0; i < N; i++) {
      const [bodyIndex, , , , , leg] = BLOBS[i];
      let ty, angle, legDx = 0;
      if (bodyIndex === 0 && !rudolph) {
        const s = GALLOP * t / 2 - .8;
        ty = -4.5 * Math.sin(s); angle = .005 * Math.sin(s + .9);
      } else {
        const th = GALLOP * t + (rudolph ? 5 : bodyIndex) * STEP + phase;
        ty = -9 * (Math.sin(th) + .18 * Math.sin(2 * th)); angle = .022 * Math.cos(th);
        if (!rudolph || bodyIndex === 4) {
          if (leg > 0) legDx = 11 * Math.sin(th + .4);
          if (leg < 0) legDx = -9 * Math.sin(th + .4);
        }
      }
      out.set([0, ty, angle, legDx], i * 4);
    }
  }
  let glow = .7, noseGlow = 1;
  function drawLayer(L) {
    gl.uniform4f(u.layer, L.off[0], L.off[1], L.scale, L.clipX);
    gl.uniform2f(u.src0, L.src0[0], L.src0[1]);
    gl.uniform1f(u.bright, bright * L.bright); gl.uniform1f(u.sat, L.sat);
    gl.uniform1f(u.glow, L.lantern ? glow : 0); gl.uniform1f(u.noseGlow, L.nose ? noseGlow : 0);
    gl.uniform1f(u.usePoly, L.poly ? 1 : 0);
    gl.uniform4fv(u.dyn, L.dyn); gl.uniform4fv(u.piv, L.piv);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // Where a painted point of a layer ends up in team space this frame (the shader's warp, run forward).
  const q4 = new Float64Array(N);
  function toTeam(L, [x, y]) {
    let qmin = Infinity;
    for (let i = 0; i < N; i++) {
      const rx = (x - geom[i * 4]) / geom[i * 4 + 2], ry = (y - geom[i * 4 + 1]) / geom[i * 4 + 3], q = rx * rx + ry * ry;
      q4[i] = q * q; if (q4[i] < qmin) qmin = q4[i];
    }
    let dx = 0, dy = 0, ws = 0;
    for (let i = 0; i < N; i++) {
      const w = Math.exp(qmin - q4[i]), k = i * 4, m = L.dyn, v = L.piv;
      const relx = x - v[k], rely = y - v[k + 1];
      let dix = m[k + 2] * rely + m[k];
      const diy = -m[k + 2] * relx + m[k + 1];
      if (v[k + 3] > 0) dix += m[k + 3] * Math.min(1, Math.max(0, (y - v[k + 2]) / v[k + 3]));
      dx += w * dix; dy += w * diy; ws += w;
    }
    return [(x + dx / ws - L.src0[0]) * L.scale + L.off[0], (y + dy / ws - L.src0[1]) * L.scale + L.off[1]];
  }
  // Reins that join the layers: soft leather with a faint sheen, sagging a little between their ends.
  function drawReins() {
    const {fit, offCss, dpr} = layout, k = fit * dpr, lit = bright / .72;
    rctx.setTransform(1, 0, 0, 1, 0, 0); rctx.clearRect(0, 0, reinCanvas.width, reinCanvas.height);
    rctx.setTransform(k, 0, 0, k, offCss[0] * dpr, offCss[1] * dpr);
    rctx.lineCap = 'round';
    for (const [from, fromLayer, to, toLayer, width, shade] of REINS) {
      const [x1, y1] = toTeam(LAYERS[fromLayer], from), [x2, y2] = toTeam(LAYERS[toLayer], to);
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + Math.abs(x2 - x1) * .025, s = shade * lit;
      rctx.strokeStyle = `rgba(${26 * s | 0},${16 * s | 0},${12 * s | 0},.95)`; rctx.lineWidth = width;
      rctx.beginPath(); rctx.moveTo(x1, y1); rctx.quadraticCurveTo(mx, my, x2, y2); rctx.stroke();
      rctx.strokeStyle = `rgba(${120 * s | 0},${80 * s | 0},${56 * s | 0},.3)`; rctx.lineWidth = Math.max(.6, width * .3);
      const o = width * .25;
      rctx.beginPath(); rctx.moveTo(x1, y1 - o); rctx.quadraticCurveTo(mx, my - o, x2, y2 - o); rctx.stroke();
    }
  }

  function render(time) {
    const t = time / 1000;
    fillDyn(dynNear, t, 0, false);
    fillDyn(dynFar, t, 1.6, false);
    fillDyn(dynRud, t, 0, true);
    bright += (brightTarget - bright) * .15;
    glow = .7 + .14 * Math.sin(t * 7.3) + .09 * Math.sin(t * 13.7 + 1.3) + .05 * Math.sin(t * 23.1);
    noseGlow = .78 + .22 * Math.sin(t * 3.1) + .05 * Math.sin(t * 11.3);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    drawLayer(LAYERS.far); drawLayer(LAYERS.near); drawLayer(LAYERS.rud);
    drawReins();
  }
  const overlay = document.getElementById('overlay');
  const active = () => !motion.matches && !document.hidden && (!overlay || overlay.hidden);
  function loop(time) { render(time); frame = active() ? requestAnimationFrame(loop) : 0; }
  function restart() {
    cancelAnimationFrame(frame); frame = 0;
    if (!ready) return;
    if (active()) frame = requestAnimationFrame(loop); else render(0);
  }
  function start() {
    if (!upload()) return;
    body.append(canvas, reinCanvas); button.classList.add('webgl'); ready = true; restart();
  }
  img.addEventListener('load', start, {once: true});
  img.src = 'assets/santa-realistic.webp'; // the painting the layers are drawn from (the <img> shows the pre-rendered team)
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (ready && upload()) restart(); }, 120); });
  document.addEventListener('visibilitychange', restart);
  motion.addEventListener('change', restart);
  if (overlay) new MutationObserver(restart).observe(overlay, {attributes: true, attributeFilter: ['hidden']});
  button.addEventListener('pointerenter', () => { brightTarget = .9; });
  button.addEventListener('pointerleave', () => { brightTarget = .72; });
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); ready = false; button.classList.remove('webgl'); reinCanvas.remove(); cancelAnimationFrame(frame); });

  // Each pass across the sky takes a slightly different lane (changed while off-screen).
  button.addEventListener('animationiteration', event => {
    if (event.target === button && event.animationName.startsWith('cross-sky')) button.style.setProperty('--lane', `${Math.round(Math.random() * 7 - 3.5)}vh`);
  });

  // Golden stardust trailing from the runners, drawn on the snow canvas by app.js.
  const dust = [];
  window.sleighTrail = {
    draw(ctx, dt) {
      if (!ready || motion.matches || (overlay && !overlay.hidden)) { dust.length = 0; ribbon.length = 0; return; }
      const rect = canvas.getBoundingClientRect();
      const now = performance.now();
      if (rect.right > -200 && rect.left < window.innerWidth + 50 && layout) {
        const sx = rect.width / (body.offsetWidth || rect.width);
        const x = rect.left + (layout.offCss[0] + TRAIL[0] * layout.fit) * sx;
        const y = rect.top + (layout.offCss[1] + TRAIL[1] * layout.fit) * sx;
        ribbon.push({x, y, t: now});
        for (let i = 0; i < 3; i++) if (dust.length < 460) dust.push({x: x + Math.random() * 12 - 6, y: y + Math.random() * 8 - 4, vx: -.06 - Math.random() * .22, vy: Math.random() * .22 - .04, life: 0, max: 130 + Math.random() * 110, r: .45 + Math.random() * 1.35, tw: Math.random() * 6});
      }
      // Comet ribbon: a soft glowing band along the recent flight path, fading with age.
      while (ribbon.length && now - ribbon[0].t > RIBBON_MS) ribbon.shift();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (let pass = 0; pass < 3; pass++) {
        const width = [14, 6, 1.8][pass], alpha = [.045, .09, .28][pass];
        ctx.lineWidth = width;
        for (let i = 1; i < ribbon.length; i++) {
          const a = ribbon[i - 1], b = ribbon[i];
          if (Math.abs(b.x - a.x) > 80) continue; // sleigh wrapped to the other side
          const k = 1 - (now - b.t) / RIBBON_MS;
          const sag = (now - b.t) * .012; // the glow settles slightly as it fades
          ctx.strokeStyle = `rgba(255,214,150,${(alpha * k * k).toFixed(3)})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y + (now - a.t) * .012); ctx.lineTo(b.x, b.y + sag); ctx.stroke();
        }
      }
      for (let i = dust.length - 1; i >= 0; i--) {
        const p = dust[i]; p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += .0018 * dt;
        const k = 1 - p.life / p.max;
        if (k <= 0) { dust.splice(i, 1); continue; }
        const a = Math.min(1, k * 1.3) * (.5 + .5 * Math.sin(p.life * .28 + p.tw));
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (.55 + k * .65), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,224,162,${a.toFixed(3)})`; ctx.fill();
      }
      ctx.restore();
    }
  };
  const ribbon = [], RIBBON_MS = 3400;
})();
