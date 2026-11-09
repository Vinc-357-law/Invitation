'use strict';
// The supplied soundtrack, played after the guest's first interaction.
const music = (() => {
  const audio = document.getElementById('background-music');
  audio.volume = .55;
  let started = false, playing = false, userMuted = false, attempt = 0;

  function update() {
    const main = document.getElementById('sound');
    const dialog = document.getElementById('sound-dialog');
    main.setAttribute('aria-pressed', String(playing));
    main.setAttribute('aria-label', i18n.t(playing ? 'Tắt nhạc Giáng sinh' : 'Bật nhạc Giáng sinh'));
    i18n.text(document.getElementById('sound-label'), playing ? 'Tắt nhạc' : 'Bật nhạc');
    dialog.setAttribute('aria-pressed', String(playing));
    i18n.text(dialog, playing ? 'Tắt nhạc' : 'Bật nhạc');
  }

  async function playAudio() {
    const current = ++attempt;
    try {
      await audio.play();
      if (current !== attempt) return;
      started = true;
      update();
    } catch (error) {
      if (current !== attempt) return;
      playing = false;
      update();
      if (typeof announce === 'function') announce('Trình duyệt chưa phát được nhạc. Hãy thử lại.');
    }
  }

  function start() {
    playing = true;
    userMuted = false;
    return playAudio();
  }

  function stop() {
    ++attempt;
    playing = false;
    userMuted = true;
    audio.pause();
    update();
  }

  document.addEventListener('languagechange', update);
  update();
  return {
    get started() { return started; },
    get playing() { return playing; },
    get userMuted() { return userMuted; },
    start,
    stop,
    chime() {},
    pause() { ++attempt; audio.pause(); },
    resume() { if (playing && !document.hidden) return playAudio(); }
  };
})();
