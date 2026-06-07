window.PhoneAudio = (() => {
  const active = new Map();
  let ringtoneSource = "sounds/ringtone.ogg";

  function getRingtoneElement() {
    return document.getElementById("phone-ringtone");
  }

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

  function setRingtoneSource(nameOrPath) {
    const value = String(nameOrPath || "").trim();
    if (!value) {
      ringtoneSource = "sounds/ringtone.ogg";
      return ringtoneSource;
    }

    if (
      value.startsWith("http://") ||
      value.startsWith("https://") ||
      value.startsWith("nui://") ||
      value.startsWith("sounds/") ||
      value.includes("/")
    ) {
      ringtoneSource = value;
      return ringtoneSource;
    }

    ringtoneSource = value.includes(".") ? `sounds/${value}` : `sounds/${value}.ogg`;
    return ringtoneSource;
  }

  function playIncomingRingtone(options = {}) {
    stop("ringtone");

    const audio = getRingtoneElement() || new Audio();
    const source = setRingtoneSource(options.source || ringtoneSource);

    audio.src = source;
    audio.loop = true;
    audio.volume = typeof options.volume === "number" ? options.volume : 0.45;

    try {
      audio.currentTime = 0;
    } catch (_) {}

    active.set("ringtone", audio);
    audio.play().catch(() => {});

    return audio;
  }

  function stopIncomingRingtone() {
    stop("ringtone");
  }

  return {
    play,
    stop,
    stopAll,
    setRingtoneSource,
    playIncomingRingtone,
    stopIncomingRingtone,
  };
})();
