window.PhoneAudio = (() => {
  const active = new Map();

  function stop(key) {
    const audio = active.get(key);
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    active.delete(key);
  }

  function stopAll() {
    for (const key of active.keys()) {
      stop(key);
    }
  }

  function play(key, url, options = {}) {
    stop(key);

    const audio = new Audio(url);

    audio.volume = typeof options.volume === "number" ? options.volume : 1;

    audio.loop = !!options.loop;

    audio.play().catch(() => {});

    active.set(key, audio);

    audio.addEventListener("ended", () => {
      if (!audio.loop) {
        active.delete(key);
      }
    });

    return audio;
  }

  return {
    play,
    stop,
    stopAll,
  };
})();
