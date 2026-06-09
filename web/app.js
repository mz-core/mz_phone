const homeScreen = document.getElementById("homeScreen");
const appScreen = document.getElementById("appScreen");
const appContent = document.getElementById("appContent");
const homeIndicator = document.getElementById("homeIndicator");
const statusClock = document.getElementById("statusClock");
const phoneShell = document.getElementById("phoneShell");
const callOverlay = document.getElementById("callOverlay");
const cameraHud = document.getElementById("cameraHud");
const cameraTransitionMask = document.getElementById("cameraTransitionMask");

const DEFAULT_PHONE_STATE = {
  isOpen: false,
  currentApp: null,
  appParams: {},

  settingsView: "main",
  settingsModal: null,
  settingsInputDraft: "",

  profilePhoto: "",
  customWallpaper: "",

  playerProfile: {
    firstname: "",
    lastname: "",
    phoneNumber: "",
    citizenid: "",
    nationality: "",
    birthdate: "",
  },

  notes: [],
  notesView: "list",
  noteSearch: "",
  selectedNoteId: null,
  noteDraft: {
    title: "",
    content: "",
  },

  contacts: [],
  contactsView: "list",
  contactSearch: "",
  selectedContactId: null,
  contactDraft: {
    id: null,
    name: "",
    number: "",
    avatar: "",
    favorite: false,
  },

  conversations: [],
  messages: {},
  selectedConversationId: null,
  messageDraft: "",
  messagesSearch: "",
  messagesPickingContact: false,
  messagesEmojiOpen: false,
  messagesActionModal: false,
  messagesMediaDraft: "",
  messagesMediaPreview: null,
  messagesImageViewer: null,

  calls: [],
  callsTab: "recents",
  dialerValue: "",
  gallery: [],
  gallerySelectedPhotoId: null,
  galleryPicker: false,
  cameraBusy: false,
  cameraError: "",
  cameraLastPhoto: null,
  pendingMediaPurpose: "",
  pendingMediaRequest: null,
  callSession: null,
  incomingCall: null,
  previousApp: null,
  notificationPreview: null,
  pendingOpenConversationNumber: null,
  lastMessageSoundKey: null,

  theme: "dark",
  wallpaper: "default",

  status: {
    time: "",
    signal: 4,
    battery: 100,
  },
};

let phoneState = window.Utils.deepClone(DEFAULT_PHONE_STATE);
let activeMediaRequest = null;

window.PhoneAudio = window.PhoneAudio || {
  players: {},

  play(key, src, options = {}) {
    this.stop(key);

    const audio = new Audio(src);
    audio.loop = Boolean(options.loop);
    audio.volume = typeof options.volume === "number" ? options.volume : 1;

    audio.play().catch(() => {});
    this.players[key] = audio;
  },

  stop(key) {
    const audio = this.players[key];
    if (!audio) return;

    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (_) {}

    delete this.players[key];
  },

  stopAll() {
    Object.keys(this.players).forEach((key) => this.stop(key));
  },
};

function mergeStateWithDefaults(data) {
  return window.Utils.deepMerge(
    window.Utils.deepClone(DEFAULT_PHONE_STATE),
    data || {},
  );
}

function setPhoneState(newState) {
  phoneState = mergeStateWithDefaults(newState);
}

function getPhoneState() {
  return phoneState;
}

function patchPhoneState(partial) {
  phoneState = mergeStateWithDefaults({
    ...phoneState,
    ...partial,
  });
}

function logNui(scope, message) {
  if (window.localStorage?.getItem("mzPhoneDebug") !== "1") return;
  console.debug(`[mz_phone][nui/${scope}] ${message}`);
}

function applyShellState() {
  if (!phoneShell) return;

  const isOpen = phoneState.isOpen === true;
  const hasIncoming = Boolean(phoneState.incomingCall);
  const hasCallSession = Boolean(phoneState.callSession);
  const isPeeking = Boolean(phoneState.notificationPreview);
  const shouldShow = isOpen || hasIncoming || hasCallSession || isPeeking;

  phoneShell.style.display = shouldShow ? "flex" : "none";
  phoneShell.classList.toggle("phone-open", isOpen);
  phoneShell.classList.toggle("phone-closed", !isOpen && !hasIncoming && !hasCallSession && !isPeeking);
  phoneShell.classList.toggle("phone-peek", !isOpen && isPeeking && !hasIncoming && !hasCallSession);
  phoneShell.classList.toggle("has-incoming-call", hasIncoming);
  phoneShell.classList.toggle("has-active-call", !hasIncoming && hasCallSession);
}

function showPhonePreview(duration = 3600) {
  if (phoneState.isOpen || phoneState.incomingCall) {
    applyShellState();
    return;
  }

  const previewId = Date.now();
  phoneState.notificationPreview = previewId;
  logNui("notify", "peek phone for notification");
  applyShellState();

  setTimeout(() => {
    if (phoneState.notificationPreview !== previewId) return;
    phoneState.notificationPreview = null;
    applyShellState();
  }, duration);
}

function renderCallOverlay() {
  if (!callOverlay) return;

  const call = phoneState.incomingCall;
  if (!call) {
    callOverlay.style.display = "none";
    callOverlay.innerHTML = "";
    applyShellState();
    return;
  }

  const displayName = call.name || call.number || "Desconhecido";
  const first = (displayName || "?").trim().charAt(0).toUpperCase() || "?";

  callOverlay.innerHTML = `
    <div class="phone-call-overlay-inner">
      <div class="call-ring-pulse" aria-hidden="true">
        <span></span>
        <span></span>
      </div>

      <div class="call-session-avatar overlay-avatar">
        ${window.Utils.escapeHtml(first)}
      </div>

      <div class="call-session-name">${window.Utils.escapeHtml(displayName)}</div>
      <div class="call-session-number">${window.Utils.escapeHtml(call.number || "")}</div>
      <div class="call-session-status incoming">Chamada recebida</div>

      <div class="call-session-actions overlay-actions">
        <button class="call-session-btn decline" onclick="window.CallsApp.declineIncomingCall()">
          <i data-lucide="phone-off"></i>
        </button>

        <button class="call-session-btn accept" onclick="window.CallsApp.acceptIncomingCall()">
          <i data-lucide="phone"></i>
        </button>
      </div>
    </div>
  `;

  callOverlay.style.display = "flex";

  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }

  logNui("call", "open incoming overlay");
  applyShellState();
}

function clearCallOverlay() {
  phoneState.incomingCall = null;
  renderCallOverlay();
}

function getIncomingRingtoneOptions() {
  const audio = phoneState.audio || {};
  const enabled = audio.enabled !== false;
  const selectedRingtone = phoneState.ringtone || "default";
  const ringtone =
    selectedRingtone === "default"
      ? audio.defaultRingtone || "ringtone"
      : selectedRingtone;

  return {
    enabled,
    source: ringtone,
    volume:
      typeof audio.ringtoneVolume === "number"
        ? audio.ringtoneVolume
        : 0.45,
  };
}

function playIncomingRingtone() {
  const options = getIncomingRingtoneOptions();
  if (options.enabled !== true) return;

  if (window.PhoneAudio?.playIncomingRingtone) {
    window.PhoneAudio.playIncomingRingtone(options);
    return;
  }

  window.PhoneAudio?.play?.("ringtone", "sounds/ringtone.ogg", {
    loop: true,
    volume: options.volume,
  });
}

function stopIncomingRingtone() {
  if (window.PhoneAudio?.stopIncomingRingtone) {
    window.PhoneAudio.stopIncomingRingtone();
    return;
  }

  window.PhoneAudio?.stop?.("ringtone");
}

function updateClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const time = `${hh}:${mm}`;

  phoneState.status.time = time;

  if (statusClock) {
    statusClock.textContent = time;
  }
}

function applyTheme() {
  const theme = phoneState.theme || "dark";
  const wallpaper = phoneState.wallpaper || "default";
  const customWallpaper = phoneState.customWallpaper || "";

  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.setAttribute("data-wallpaper", wallpaper);

  if (wallpaper === "custom" && customWallpaper) {
    document.documentElement.style.setProperty(
      "--home-wallpaper",
      `url("${customWallpaper}")`,
    );
  } else {
    document.documentElement.style.removeProperty("--home-wallpaper");
  }
}

function renderHome() {
  if (!homeScreen) return;

  const apps = window.AppRegistry.getInstalledApps(phoneState);

  homeScreen.innerHTML = `
    <div class="home-grid">
      ${apps
        .map((app) => {
          const icon = app.icon || "circle";
          const name = app.name || app.id;

          const isLucide =
            typeof icon === "string" &&
            !/[\u2190-\u2BFF\u{1F000}-\u{1FAFF}]/u.test(icon);

          return `
            <button class="app-icon-button" onclick="window.openApp('${app.id}')">
              <div class="app-icon">
                ${
                  isLucide
                    ? `<i data-lucide="${icon}"></i>`
                    : `<span class="app-icon-emoji">${icon}</span>`
                }
              </div>
              <span class="app-label">${name}</span>
            </button>
          `;
        })
        .join("")}
    </div>
  `;

  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

function createAppContext(appId) {
  return {
    appId,

    getState: () => phoneState,

    patchState: (partial) => {
      patchPhoneState(partial);
    },

    setState: (nextState) => {
      setPhoneState(nextState);
    },

    saveState: async () => {
      if (window.PhoneAPI?.saveData) {
        await window.PhoneAPI.saveData(phoneState);
      }
    },

    renderCurrentApp: () => {
      renderCurrentApp();
    },

    openApp: (id) => {
      window.openApp(id);
    },

    closeApp: () => {
      window.goHome();
    },

    goHome: () => {
      window.goHome();
    },

    contract: window.AppContract,
    utils: window.Utils,
  };
}

function renderCurrentApp() {
  const appId = phoneState.currentApp;
  if (!appId || !appContent) return;

  const app = window.AppRegistry.getApp(appId);
  if (!app) return;

  const ctx = createAppContext(appId);
  const html = app.render ? app.render(ctx) : `<div class="app-page"></div>`;

  appContent.innerHTML = html;

  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

function mediaPhotoUrl(photo) {
  return photo?.image_url || photo?.imageUrl || photo?.url || photo?.thumbnail_url || photo?.thumbnailUrl || "";
}

function normalizeMediaResult(photo, source = "gallery") {
  if (!photo || typeof photo !== "object") return null;
  const imageUrl = mediaPhotoUrl(photo);
  if (!imageUrl) return null;

  return {
    id: photo.id ?? null,
    url: imageUrl,
    imageUrl,
    thumbnailUrl: photo.thumbnail_url || photo.thumbnailUrl || "",
    caption: photo.caption || "",
    type: "image",
    source,
  };
}

function mediaReturnState() {
  return {
    settingsView: phoneState.settingsView,
    settingsModal: null,
    settingsInputDraft: "",
    selectedConversationId: phoneState.selectedConversationId,
    messagesActionModal: false,
    messagesMediaDraft: phoneState.messagesMediaDraft || "",
    messagesMediaPreview: phoneState.messagesMediaPreview || null,
    messagesImageViewer: null,
    contactsView: phoneState.contactsView,
    selectedContactId: phoneState.selectedContactId,
    contactDraft: phoneState.contactDraft,
  };
}

function beginMediaRequest(kind, options = {}) {
  const request = {
    kind,
    purpose: options.purpose || "",
    returnApp: options.returnApp || phoneState.currentApp || null,
    returnState: {
      ...mediaReturnState(),
      ...(options.returnState || {}),
    },
    createdAt: Date.now(),
  };

  activeMediaRequest = request;
  patchPhoneState({
    previousApp: request.returnApp,
    pendingMediaPurpose: request.purpose,
    pendingMediaRequest: {
      kind: request.kind,
      purpose: request.purpose,
      returnApp: request.returnApp,
    },
    galleryPicker: kind === "gallery",
    gallerySelectedPhotoId: null,
  });

  return request;
}

function dispatchMediaResult(result, request) {
  if (!result || !request) return;
  const handlerMap = {
    settings: () => window.SettingsApp?.applyMediaResult?.(result, request),
    messages: () => window.MessagesApp?.applyMediaResult?.(result, request),
    contacts: () => window.ContactsApp?.applyMediaResult?.(result, request),
  };

  window.setTimeout(() => {
    const handled = handlerMap[request.returnApp]?.();
    if (handled === false || handled === undefined) {
      window.PhoneUI?.notify?.({
        type: "info",
        title: "Imagem",
        message: "Esta tela ainda nao usa imagem.",
      });
    }
  }, 0);
}

function completeMediaRequest(photo, source = "gallery") {
  const result = normalizeMediaResult(photo, source);
  const request = activeMediaRequest;
  if (!request || !result) return;

  activeMediaRequest = null;
  patchPhoneState({
    ...(request.returnState || {}),
    galleryPicker: false,
    gallerySelectedPhotoId: null,
    pendingMediaPurpose: "",
    pendingMediaRequest: null,
  });

  if (request.returnApp) {
    window.openApp(request.returnApp, { skipMediaRequest: true });
  } else {
    window.goHome();
  }

  dispatchMediaResult(result, request);
}

function cancelMediaRequest() {
  const request = activeMediaRequest;
  if (!request) return;

  activeMediaRequest = null;
  patchPhoneState({
    ...(request.returnState || {}),
    galleryPicker: false,
    gallerySelectedPhotoId: null,
    pendingMediaPurpose: "",
    pendingMediaRequest: null,
  });

  if (request.returnApp) {
    window.openApp(request.returnApp, { skipMediaRequest: true });
  } else {
    window.goHome();
  }
}

window.PhoneMedia = {
  openGalleryForResult(options = {}) {
    beginMediaRequest("gallery", options);
    window.openApp("gallery", { picker: true });
  },

  openCameraForResult(options = {}) {
    beginMediaRequest("camera", options);
    window.openApp("camera", { mediaRequest: true });
  },

  complete: completeMediaRequest,
  cancel: cancelMediaRequest,
  current: () => activeMediaRequest,
};

window.openApp = function (appId, params = {}) {
  const app = window.AppRegistry.getApp(appId);
  if (!app) return;

  const previousAppId = phoneState.currentApp;

  if (previousAppId && previousAppId !== appId) {
    const previousApp = window.AppRegistry.getApp(previousAppId);
    if (previousApp && typeof previousApp.onClose === "function") {
      previousApp.onClose(createAppContext(previousAppId));
    }
  }

  const isSameApp = previousAppId === appId;

  phoneState.currentApp = appId;
  phoneState.appParams = params || {};

  if (homeScreen) homeScreen.style.display = "none";
  if (appScreen) appScreen.style.display = "flex";

  if (!isSameApp && typeof app.onOpen === "function") {
    app.onOpen(createAppContext(appId));
  }

  renderCurrentApp();
};

window.goHome = function () {
  const currentAppId = phoneState.currentApp;

  if (currentAppId) {
    const app = window.AppRegistry.getApp(currentAppId);
    if (app && typeof app.onClose === "function") {
      app.onClose(createAppContext(currentAppId));
    }
  }

  phoneState.currentApp = null;

  if (appScreen) appScreen.style.display = "none";
  if (homeScreen) homeScreen.style.display = "block";

  renderHome();
};

window.rerenderHome = function () {
  renderHome();
};

window.reloadPhoneState = async function () {
  if (!window.PhoneAPI?.loadData) return;

  const data = await window.PhoneAPI.loadData();
  setPhoneState(data || DEFAULT_PHONE_STATE);

  applyTheme();
  updateClock();

  if (phoneState.currentApp) {
    if (homeScreen) homeScreen.style.display = "none";
    if (appScreen) appScreen.style.display = "flex";
    renderCurrentApp();
  } else {
    if (appScreen) appScreen.style.display = "none";
    if (homeScreen) homeScreen.style.display = "block";
    renderHome();
  }
};

window.resetPhoneState = async function () {
  setPhoneState(DEFAULT_PHONE_STATE);
  applyTheme();
  updateClock();

  if (appScreen) appScreen.style.display = "none";
  if (homeScreen) homeScreen.style.display = "block";

  renderHome();

  if (window.PhoneAPI?.saveData) {
    await window.PhoneAPI.saveData(phoneState);
  }
};

function handlePhoneOpen() {
  phoneState.isOpen = true;

  phoneState.currentApp = null;

  phoneState.settingsView = "main";
  phoneState.settingsModal = null;
  phoneState.settingsInputDraft = "";

  phoneState.notesView = "list";
  phoneState.selectedNoteId = null;
  phoneState.noteDraft = {
    title: "",
    content: "",
  };

  phoneState.contactsView = "list";
  phoneState.selectedContactId = null;
  phoneState.contactDraft = {
    id: null,
    name: "",
    number: "",
    avatar: "",
    favorite: false,
  };

  phoneState.selectedConversationId = null;
  phoneState.messageDraft = "";
  phoneState.messagesDeepOpen = false;

  phoneState.notificationPreview = null;
  applyShellState();

  if (appScreen) appScreen.style.display = "none";
  if (homeScreen) homeScreen.style.display = "block";

  updateClock();
  applyTheme();
  renderHome();
  renderCallOverlay();
}

function handlePhoneClose() {
  phoneState.isOpen = false;
  window.PhoneAudio?.stopAll();
  setCameraTransitionMask(false, { instant: true });
  renderCameraHud(false);
  const currentAppId = phoneState.currentApp;
  if (currentAppId) {
    const app = window.AppRegistry.getApp(currentAppId);
    if (app && typeof app.onClose === "function") {
      app.onClose(createAppContext(currentAppId));
    }
  }

  phoneState.currentApp = null;
  phoneState.notificationPreview = null;

  if (appScreen) appScreen.style.display = "none";
  if (homeScreen) homeScreen.style.display = "block";

  renderCallOverlay();
  applyShellState();
}

function renderCameraHud(visible, data = {}) {
  if (!cameraHud) return;

  if (!visible) {
    cameraHud.classList.remove("is-visible");
    cameraHud.style.display = "none";
    cameraHud.innerHTML = "";
    return;
  }

  const status = data.status || "ready";
  const isError = status === "error";
  const isCapturing = status === "capturing";
  const showZoom = data.zoomEnabled !== false && data.zoom?.Enabled === true;
  const showSwitch = data.switchCamera?.Enabled === true;
  const facingLabel = data.facing === "front" ? "SELFIE" : "POV";
  const zoomLabel = showZoom ? data.zoomLabel || "" : "";
  const errorLabel =
    typeof window.cameraErrorMessage === "function"
      ? window.cameraErrorMessage(data.error)
      : "Nao foi possivel usar a camera.";

  cameraHud.style.display = "block";
  cameraHud.classList.add("is-visible");

  cameraHud.innerHTML = `
    <div class="camera-hud__frame" aria-hidden="true">
      <span class="camera-hud__grid-horizontal"></span>
      <span class="camera-hud__grid-horizontal"></span>
    </div>

    <div class="camera-hud__top">
      <span class="camera-hud__record-dot"></span>
      <span>MZ CAM</span>
      <span>${window.Utils.escapeHtml(facingLabel)}</span>
      ${zoomLabel ? `<span>${window.Utils.escapeHtml(zoomLabel)}</span>` : ""}
    </div>

    ${
      isCapturing || isError
        ? `
          <div class="camera-hud__status ${isError ? "is-error" : ""}">
            <span>${window.Utils.escapeHtml(isError ? errorLabel : "Capturando...")}</span>
          </div>
        `
        : `<div class="camera-hud__reticle" aria-hidden="true"></div>`
    }

    <div class="camera-hud__bottom">
      <span>Clique/ENTER: tirar foto</span>
      ${showZoom ? "<span>Scroll: zoom</span>" : ""}
      ${showSwitch ? "<span>E: inverter</span>" : ""}
      <span>ESC/Backspace: cancelar</span>
    </div>
  `;
}

function setCameraTransitionMask(active, options = {}) {
  if (!cameraTransitionMask) return;

  const instant = options.instant === true;
  const fadeMs = Number(options.fadeMs);

  cameraTransitionMask.classList.toggle("is-instant", instant);

  if (!instant && Number.isFinite(fadeMs) && fadeMs >= 0) {
    cameraTransitionMask.style.setProperty("--camera-mask-fade", `${fadeMs}ms`);
  } else if (instant) {
    cameraTransitionMask.style.setProperty("--camera-mask-fade", "0ms");
  } else {
    cameraTransitionMask.style.removeProperty("--camera-mask-fade");
  }

  cameraTransitionMask.classList.toggle("is-active", active === true);

  if (instant) {
    requestAnimationFrame(() => {
      cameraTransitionMask.classList.remove("is-instant");
      cameraTransitionMask.style.removeProperty("--camera-mask-fade");
    });
  }
}

function handleCameraStatus(data = {}) {
  if (data.ok === true) {
    phoneState.cameraBusy = false;
    phoneState.cameraError = "";
    phoneState.cameraLastPhoto = data.photo || null;

    if (activeMediaRequest && activeMediaRequest.kind === "camera") {
      completeMediaRequest(data.photo, "camera");
    }

    return;
  }

  phoneState.cameraBusy = false;
  phoneState.cameraError = data.error || "save_failed";

  if (
    activeMediaRequest &&
    activeMediaRequest.kind === "camera" &&
    (data.error === "camera_cancelled" || data.error === "camera_mode_inactive")
  ) {
    cancelMediaRequest();
  }
}

function bootPhone() {
  updateClock();

  setInterval(() => {
    updateClock();
  }, 15000);

  if (homeIndicator) {
    homeIndicator.addEventListener("click", () => {
      window.goHome();
    });
  }

  if (window.PhoneAPI?.onOpen) {
    window.PhoneAPI.onOpen(() => {
      handlePhoneOpen();
    });
  }

  if (window.PhoneAPI?.onClose) {
    window.PhoneAPI.onClose(() => {
      handlePhoneClose();
    });
  }

  window.addEventListener("message", (event) => {
    const data = event.data || {};

    if (data.action === "cameraHud") {
      renderCameraHud(data.visible === true, data.data || {});
    }

    if (data.action === "cameraTransitionMask") {
      setCameraTransitionMask(data.active === true, {
        instant: data.instant === true,
        fadeMs: data.fadeMs,
      });
    }

    if (data.action === "cameraStatus") {
      handleCameraStatus(data.data || {});
    }
  });

  if (window.PhoneAPI?.onReceiveCalls) {
    window.PhoneAPI.onReceiveCalls((data) => {
      phoneState.calls = Array.isArray(data) ? data : [];

      if (phoneState.currentApp === "calls") {
        renderCurrentApp();
      }
    });
  }

  if (window.PhoneAPI?.onReceiveGallery) {
    window.PhoneAPI.onReceiveGallery((data) => {
      phoneState.gallery = Array.isArray(data) ? data : [];

      if (phoneState.currentApp === "gallery") {
        renderCurrentApp();
      }
    });
  }

  if (window.PhoneAPI?.onIncomingCall) {
    window.PhoneAPI.onIncomingCall((data) => {
      logNui("call", "incomingCall received");

      const number = String(data.fromNumber || "");
      const contact = (phoneState.contacts || []).find(
        (item) => String(item.number || "") === number,
      );

      const displayName =
        data.displayName || data.contactName || contact?.name || number || data.fallbackName || "Desconhecido";

      window.PhoneApp.patchState({
        previousApp: phoneState.currentApp,
        incomingCall: {
          callId: data.callId,
          number,
          name: displayName,
          contact_id: contact?.id || null,
        },
        callSession: null,
      });

      renderCallOverlay();

      playIncomingRingtone();

      applyShellState();
    });
  }

  if (window.PhoneAPI?.onOutgoingCallStarted) {
    window.PhoneAPI.onOutgoingCallStarted((data) => {
      logNui("call", "outgoing started");

      const number = String(data.targetNumber || "");
      const contact = (phoneState.contacts || []).find(
        (item) => String(item.number || "") === number,
      );

      window.PhoneApp.patchState({
        currentApp: "calls",
        incomingCall: null,
        callSession: {
          callId: data.callId,
          number,
          name: data.displayName || data.contactName || contact?.name || number || data.fallbackName || "Desconhecido",
          state: "dialing",
          startedAt: null,
          duration: 0,
          contact_id: contact?.id || null,
        },
      });

      if (homeScreen) homeScreen.style.display = "none";
      if (appScreen) appScreen.style.display = "flex";
      renderCallOverlay();
      renderCurrentApp();
      applyShellState();

      window.PhoneAudio?.play(
        "calling",
        "https://fivem.mazinho.org/mz_phone_server/audio/phone/calling.ogg",
        { loop: true, volume: 1 },
      );
    });
  }

  if (window.PhoneAPI?.onCallAccepted) {
    window.PhoneAPI.onCallAccepted((data) => {
      const state = window.PhoneApp.getState();
      const session = state.callSession;
      const incoming = state.incomingCall;

      stopIncomingRingtone();
      window.PhoneAudio?.stop("calling");

      if (
        session &&
        String(session.callId || "") === String(data.callId || "")
      ) {
        window.PhoneApp.patchState({
          callSession: {
            ...session,
            state: "active",
            startedAt: Date.now(),
            duration: 0,
          },
        });

        applyShellState();
        renderCurrentApp();
        window.CallsApp?.startDurationTicker?.();
        return;
      }

      if (
        incoming &&
        String(incoming.callId || "") === String(data.callId || "")
      ) {
        window.PhoneApp.patchState({
          incomingCall: null,
          currentApp: "calls",
          callsTab: "recents",
          callSession: {
            callId: data.callId,
            number: incoming.number || "",
            name: incoming.name || incoming.number || "Contato",
            state: "active",
            startedAt: Date.now(),
            duration: 0,
            contact_id: incoming.contact_id || null,
          },
        });

        if (homeScreen) homeScreen.style.display = "none";
        if (appScreen) appScreen.style.display = "flex";
        renderCallOverlay();
        applyShellState();
        renderCurrentApp();
        window.CallsApp?.startDurationTicker?.();
        window.PhoneUI?.notify?.({
          type: "success",
          title: "Chamada conectada",
          message: "Ligação em andamento",
          duration: 2000,
        });
      }
    });
  }

  if (window.PhoneAPI?.onCallDeclined) {
    window.PhoneAPI.onCallDeclined(() => {
      const wasIncoming = Boolean(phoneState.incomingCall);
      const previousApp = phoneState.previousApp || null;

      stopIncomingRingtone();
      window.PhoneAudio?.stop("calling");

      window.PhoneApp.patchState({
        incomingCall: null,
        callSession: null,
        callsTab: "recents",
        currentApp: wasIncoming ? previousApp : "calls",
        previousApp: null,
      });

      renderCallOverlay();
      applyShellState();

      if (phoneState.currentApp) {
        if (homeScreen) homeScreen.style.display = "none";
        if (appScreen) appScreen.style.display = "flex";
        renderCurrentApp();
      } else {
        if (appScreen) appScreen.style.display = "none";
        if (homeScreen) homeScreen.style.display = "block";
        renderHome();
      }

      window.PhoneUI?.notify?.({
        type: "info",
        title: "Chamada encerrada",
        message: "Ligação recusada",
        duration: 2500,
      });
    });
  }

  if (window.PhoneAPI?.onCallEnded) {
    window.PhoneAPI.onCallEnded(() => {
      stopIncomingRingtone();
      window.PhoneAudio?.stop("calling");

      if (window.CallsApp?._durationInterval) {
        clearInterval(window.CallsApp._durationInterval);
        window.CallsApp._durationInterval = null;
      }

      window.PhoneApp.patchState({
        incomingCall: null,
        callSession: null,
        callsTab: "recents",
        currentApp: "calls",
        previousApp: null,
      });

      renderCallOverlay();
      applyShellState();
      if (homeScreen) homeScreen.style.display = "none";
      if (appScreen) appScreen.style.display = "flex";
      renderCurrentApp();
      window.PhoneAPI?.getCalls?.();
    });
  }

  if (window.PhoneAPI?.onCallMissed) {
    window.PhoneAPI.onCallMissed(() => {
      const wasIncoming = Boolean(phoneState.incomingCall);
      const previousApp = phoneState.previousApp || null;

      stopIncomingRingtone();
      window.PhoneAudio?.stop("calling");

      if (window.CallsApp?._durationInterval) {
        clearInterval(window.CallsApp._durationInterval);
        window.CallsApp._durationInterval = null;
      }

      window.PhoneApp.patchState({
        incomingCall: null,
        callSession: null,
        callsTab: "recents",
        currentApp: wasIncoming ? previousApp : "calls",
        previousApp: null,
      });

      renderCallOverlay();
      applyShellState();

      if (phoneState.currentApp) {
        if (homeScreen) homeScreen.style.display = "none";
        if (appScreen) appScreen.style.display = "flex";
        renderCurrentApp();
      } else {
        if (appScreen) appScreen.style.display = "none";
        if (homeScreen) homeScreen.style.display = "block";
        renderHome();
      }

      window.PhoneAPI?.getCalls?.();

      window.PhoneUI?.notify?.({
        type: "warning",
        title: "Chamada perdida",
        message: "A chamada nao foi atendida",
        duration: 2500,
      });
    });
  }

  if (window.PhoneAPI?.onCallUnanswered) {
    window.PhoneAPI.onCallUnanswered(() => {
      stopIncomingRingtone();
      window.PhoneAudio?.stop("calling");

      if (window.CallsApp?._durationInterval) {
        clearInterval(window.CallsApp._durationInterval);
        window.CallsApp._durationInterval = null;
      }

      window.PhoneApp.patchState({
        incomingCall: null,
        callSession: null,
        callsTab: "recents",
        currentApp: "calls",
        previousApp: null,
      });

      renderCallOverlay();
      applyShellState();
      if (homeScreen) homeScreen.style.display = "none";
      if (appScreen) appScreen.style.display = "flex";
      renderCurrentApp();
      window.PhoneAPI?.getCalls?.();

      window.PhoneUI?.notify?.({
        type: "warning",
        title: "Chamada nao atendida",
        message: "Ninguem atendeu a chamada",
        duration: 2500,
      });
    });
  }

  if (window.PhoneAPI?.onCallUnavailable) {
    window.PhoneAPI.onCallUnavailable(() => {
      stopIncomingRingtone();
      window.PhoneAudio?.stop("calling");

      window.PhoneApp.patchState({
        incomingCall: null,
        callSession: null,
        callsTab: "recents",
        currentApp: "calls",
        previousApp: null,
      });

      renderCallOverlay();
      applyShellState();
      if (homeScreen) homeScreen.style.display = "none";
      if (appScreen) appScreen.style.display = "flex";
      renderCurrentApp();

      window.PhoneUI?.notify?.({
        type: "warning",
        title: "Número indisponível",
        message: "Não foi possível completar a chamada",
        duration: 2500,
      });
    });
  }

  if (window.PhoneAPI?.onCallBusy) {
    window.PhoneAPI.onCallBusy(() => {
      stopIncomingRingtone();
      window.PhoneAudio?.stop("calling");

      window.PhoneApp.patchState({
        incomingCall: null,
        callSession: null,
        callsTab: "recents",
        currentApp: "calls",
        previousApp: null,
      });

      renderCallOverlay();
      applyShellState();
      if (homeScreen) homeScreen.style.display = "none";
      if (appScreen) appScreen.style.display = "flex";
      renderCurrentApp();

      window.PhoneUI?.notify?.({
        type: "warning",
        title: "Linha ocupada",
        message: "A pessoa já está em chamada",
        duration: 2500,
      });
    });
  }

  if (window.PhoneAPI?.onLoadData) {
    window.PhoneAPI.onLoadData((data) => {
      setPhoneState(data || DEFAULT_PHONE_STATE);

      phoneState.currentApp = null;

      phoneState.settingsView = "main";
      phoneState.settingsModal = null;
      phoneState.settingsInputDraft = "";

      phoneState.notesView = "list";
      phoneState.selectedNoteId = null;
      phoneState.noteDraft = {
        title: "",
        content: "",
      };

      phoneState.contactsView = "list";
      phoneState.selectedContactId = null;
      phoneState.contactDraft = {
        id: null,
        name: "",
        number: "",
        avatar: "",
        favorite: false,
      };

      phoneState.selectedConversationId = null;
      phoneState.messageDraft = "";
      phoneState.messagesDeepOpen = false;

      applyTheme();
      updateClock();

      if (appScreen) appScreen.style.display = "none";
      if (homeScreen) homeScreen.style.display = "block";

      renderHome();
    });
  }

  if (window.PhoneAPI?.onNotify) {
    window.PhoneAPI.onNotify((data) => {
      if (window.PhoneUI?.notify) {
        window.PhoneUI.notify(data);
      }
    });
  }

  applyShellState();

  if (window.PhoneAPI?.ready) {
    window.PhoneAPI.ready();
  }

  if (window.PhoneAPI?.onReceiveConversations) {
    window.PhoneAPI.onReceiveConversations((data) => {
      phoneState.conversations = Array.isArray(data) ? data : [];

      if (phoneState.pendingOpenConversationNumber) {
        const targetNumber = String(phoneState.pendingOpenConversationNumber);
        const foundConversation = phoneState.conversations.find(
          (item) => String(item.target_number || "") === targetNumber,
        );

        if (foundConversation) {
          phoneState.currentApp = "messages";
          phoneState.messagesPickingContact = false;
          phoneState.selectedConversationId = foundConversation.id;
          phoneState.pendingOpenConversationNumber = null;

          if (window.PhoneAPI?.getConversationMessages) {
            window.PhoneAPI.getConversationMessages(foundConversation.id);
          }

          if (window.PhoneAPI?.markConversationRead) {
            window.PhoneAPI.markConversationRead(foundConversation.id);
          }
        }
      }

      if (phoneState.currentApp === "messages") {
        renderCurrentApp();
      }
    });
  }

  if (window.PhoneAPI?.onReceiveConversationMessages) {
    window.PhoneAPI.onReceiveConversationMessages((data) => {
      if (!data || !data.conversationId) return;

      phoneState.messages = phoneState.messages || {};
      const previousMessages = phoneState.messages[data.conversationId] || [];
      const nextMessages = Array.isArray(data.messages) ? data.messages : [];

      phoneState.messages[data.conversationId] = nextMessages;

      const lastMessage = nextMessages[nextMessages.length - 1];
      const previousLastMessage = previousMessages[previousMessages.length - 1];

      const currentLastKey = lastMessage
        ? `${lastMessage.id || ""}:${lastMessage.created_at || ""}:${lastMessage.sender || ""}`
        : null;

      const previousLastKey = previousLastMessage
        ? `${previousLastMessage.id || ""}:${previousLastMessage.created_at || ""}:${previousLastMessage.sender || ""}`
        : null;

      if (
        currentLastKey &&
        currentLastKey !== previousLastKey &&
        lastMessage &&
        lastMessage.sender !== "me"
      ) {
        window.PhoneAudio?.play(
          "message-notify",
          "https://fivem.mazinho.org/mz_phone_server/audio/ui/notification.mp3",
          { volume: 1 },
        );

        phoneState.lastMessageSoundKey = currentLastKey;
      }

      const isMessagesAppOpen = phoneState.currentApp === "messages";
      const isSameConversation =
        String(phoneState.selectedConversationId || "") ===
        String(data.conversationId);

      if (isMessagesAppOpen && !phoneState.messagesPickingContact) {
        if (!phoneState.selectedConversationId || isSameConversation) {
          phoneState.selectedConversationId = data.conversationId;
        }
      }

      if (
        isMessagesAppOpen &&
        String(phoneState.selectedConversationId || "") ===
          String(data.conversationId)
      ) {
        renderCurrentApp();

        setTimeout(() => {
          const chat = document.querySelector(".msg-chat");
          if (chat) {
            chat.scrollTop = chat.scrollHeight;
          }
        }, 0);
      }
    });
  }
}

window.PhoneApp = {
  getState: getPhoneState,
  setState: setPhoneState,
  patchState: patchPhoneState,
  renderCurrentApp,
  renderHome,
  applyTheme,
  applyShellState,
  showNotificationPreview: showPhonePreview,
};

bootPhone();
