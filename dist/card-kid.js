'use strict';
// The poster's fonts are only used inside the card, so a browser would not fetch them until the
// card appears and guests would see the fallback first. Ask for them (Vietnamese glyphs included)
// now, and again once the font stylesheet, which loads in the background, has arrived.
(() => {
  // The guest pages wear the poster's illustrations: copy them rather than repeat the drawings.
  const poster = document.querySelector('.kid-card');
  const copy = (part, className) => {
    const art = poster.querySelector(`[data-part="${part}"]`).cloneNode(true);
    art.removeAttribute('style'); art.removeAttribute('data-part');
    art.setAttribute('class', className);
    return art;
  };
  document.querySelectorAll('.kid-panel').forEach(panel => {
    const ground = copy('ground', 'kp-art kp-ground');
    ground.querySelectorAll('ellipse').forEach(shadow => shadow.remove()); // they sit under the poster's tree, reindeer and cake; here they would cross the text
    panel.prepend(ground, copy('snow', 'kp-art kp-snow'), copy('icing', 'kp-art kp-icing'), copy('baubles', 'kp-art kp-baubles'), copy('tree-small', 'kp-art kp-tree'), copy('gift', 'kp-art kp-gift'));
    panel.querySelector('.kp-body').prepend(copy(panel.dataset.hero || 'reindeer', 'kp-hero'));
  });

  // A light, evenly scattered snowfall behind the envelope and the guest pages.
  const sky = document.querySelector('.ke-sky');
  for (let i = 0; i < 16; i++) {
    const flake = document.createElement('i');
    flake.style.cssText = `--x:${((i * 67 + 24) % 1060) / 10.8}%;--s:${10 + (i * 7) % 14};--d:${9 + (i * 5) % 8}s;--t:${-((i * 37) % 17)}s`;
    sky.prepend(flake);
  }

  if (!document.fonts || !document.fonts.load) return;
  const sample = 'Thân mời Tiệc thôi nôi Tháng 12 Chủ Nhật Nhà hàng Xuân Hòa Hồ Chí Minh Sự hiện diện Xác nhận tham dự';
  const fetchFonts = () => {
    document.fonts.load('400 40px "Cherry Bomb One"', 'Hà Linh 18:00 20 2026').catch(() => {});
    ['600', '700', '800'].forEach(weight => document.fonts.load(`${weight} 40px "Baloo 2"`, sample).catch(() => {}));
  };
  fetchFonts();
  const fontsCss = document.getElementById('fonts-css');
  if (fontsCss) fontsCss.addEventListener('load', fetchFonts, {once: true});
})();
