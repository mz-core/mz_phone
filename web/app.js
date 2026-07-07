const homeScreen = document.getElementById("homeScreen");
const appScreen = document.getElementById("appScreen");
const appContent = document.getElementById("appContent");
const homeIndicator = document.getElementById("homeIndicator");
const statusClock = document.getElementById("statusClock");
const phoneShell = document.getElementById("phoneShell");
const callOverlay = document.getElementById("callOverlay");
const phoneDialogRoot = document.getElementById("phoneDialogRoot");
const cameraHud = document.getElementById("cameraHud");
const cameraTransitionMask = document.getElementById("cameraTransitionMask");

const DEFAULT_PHONE_STATE = {
  isOpen: false,
  currentApp: null,
  appParams: {},
  dialog: null,

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
  realEstateListings: [],
  realEstateSelectedListing: null,
  realEstateMyListings: [],
  realEstateProperties: [],
  realEstatePropertiesLoading: false,
  realEstatePropertiesError: "",
  realEstateAccess: null,
  realEstateView: "list",
  realEstateTab: "all",
  realEstateReturnView: "list",
  realEstateFormMode: "create",
  realEstateForm: {},
  realEstateActionBusy: false,
  realEstateSaving: false,
  realEstateLastError: null,
  realEstatePhotoBusy: false,
  realEstatePhotoPickerOpen: false,
  realEstatePhotoPickerLoading: false,
  realEstateLoading: false,
  realEstateError: "",
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
  audio: {
    enabled: true,
    defaultRingtone: "ringtone",
    ringtoneVolume: 0.45,
    locationClick: {
      enabled: true,
      sound: "notification",
      source: "sounds/notification.mp3",
      volume: 0.35,
    },
  },

  status: {
    time: "",
    signal: 4,
    battery: 100,
  },
};

let phoneState = window.Utils.deepClone(DEFAULT_PHONE_STATE);
let activeMediaRequest = null;
let notificationPreviewTimer = null;
let dialogCounter = 0;
const phoneDialogCallbacks = new Map();

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

function listFromPayload(payload, keys = []) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  for (const key of keys) {
    if (Array.isArray(payload[key])) return payload[key];
  }

  if (payload.data && typeof payload.data === "object") {
    const nested = listFromPayload(payload.data, keys);
    if (nested.length) return nested;
  }

  if (payload.result && typeof payload.result === "object") {
    const nested = listFromPayload(payload.result, keys);
    if (nested.length) return nested;
  }

  return [];
}

function logNui(scope, message) {
  if (window.localStorage?.getItem("mzPhoneDebug") !== "1") return;
  console.debug(`[mz_phone][nui/${scope}] ${message}`);
}

function normalizeDialogTone(tone) {
  if (tone === "danger" || tone === "warning" || tone === "success") {
    return tone;
  }

  return "default";
}

function renderPhoneDialog() {
  if (!phoneDialogRoot) return;

  const dialog = phoneState.dialog;
  if (!dialog) {
    phoneDialogRoot.innerHTML = "";
    phoneDialogRoot.style.display = "none";
    return;
  }

  const tone = normalizeDialogTone(dialog.tone);
  phoneDialogRoot.style.display = "block";
  phoneDialogRoot.innerHTML = `
    <div class="phone-dialog-backdrop" data-phone-dialog-action="cancel">
      <div class="phone-dialog phone-dialog--${window.Utils.escapeHtmlAttr(tone)}" role="dialog" aria-modal="true" aria-labelledby="phone-dialog-title">
        <div id="phone-dialog-title" class="phone-dialog__title">${window.Utils.escapeHtml(dialog.title || "Confirmar acao")}</div>
        ${
          dialog.message
            ? `<div class="phone-dialog__message">${window.Utils.escapeHtml(dialog.message)}</div>`
            : ""
        }
        <div class="phone-dialog__actions">
          <button type="button" class="phone-dialog__button phone-dialog__button--cancel" data-phone-dialog-action="cancel">
            ${window.Utils.escapeHtml(dialog.cancelText || "Cancelar")}
          </button>
          <button type="button" class="phone-dialog__button phone-dialog__button--confirm phone-dialog__button--${window.Utils.escapeHtmlAttr(tone)}" data-phone-dialog-action="confirm">
            ${window.Utils.escapeHtml(dialog.confirmText || "Confirmar")}
          </button>
        </div>
      </div>
    </div>
  `;
}

function closePhoneDialog(action = "cancel") {
  const dialog = phoneState.dialog;
  if (!dialog) return false;

  const callbacks = phoneDialogCallbacks.get(dialog.id);
  phoneDialogCallbacks.delete(dialog.id);
  phoneState.dialog = null;
  renderPhoneDialog();
  maintainOpenIfAlreadyOpen(`phone_dialog_${action}`);

  const confirmed = action === "confirm";
  if (confirmed && typeof callbacks?.onConfirm === "function") {
    callbacks.onConfirm();
  }
  if (!confirmed && typeof callbacks?.onCancel === "function") {
    callbacks.onCancel();
  }
  if (typeof callbacks?.resolve === "function") {
    callbacks.resolve(confirmed);
  }

  return true;
}

function openPhoneDialog(options = {}) {
  const id = `dialog-${Date.now()}-${++dialogCounter}`;
  const dialog = {
    id,
    type: options.type || "confirm",
    title: options.title || "Confirmar acao",
    message: options.message || "",
    confirmText: options.confirmText || "Confirmar",
    cancelText: options.cancelText || "Cancelar",
    tone: normalizeDialogTone(options.tone),
    app: options.app || phoneState.currentApp || null,
  };

  return new Promise((resolve) => {
    phoneDialogCallbacks.set(id, {
      onConfirm: options.onConfirm,
      onCancel: options.onCancel,
      resolve,
    });

    phoneState.dialog = dialog;
    maintainOpenIfAlreadyOpen("phone_dialog_open");
    renderPhoneDialog();
  });
}

function hasOpenPhoneDialog() {
  return Boolean(phoneState.dialog);
}

window.PhoneDialog = {
  confirm(options = {}) {
    return openPhoneDialog({ ...options, type: "confirm" });
  },
  cancel() {
    return closePhoneDialog("cancel");
  },
  close() {
    return closePhoneDialog("cancel");
  },
  isOpen: hasOpenPhoneDialog,
};

function realEstateActionSuccessMessage(action, result = {}) {
  if (action === "create" && result?.status === "pending")
    return "Anuncio criado como pendente.";
  if (action === "create" && result?.status === "active")
    return "Anuncio publicado.";
  if (action === "create") return "Anuncio criado.";
  if (action === "update") return "Anuncio atualizado.";
  if (action === "status" && result?.status === "archived")
    return "Anuncio removido da lista publica.";
  if (action === "status" && result?.status === "paused")
    return "Anuncio pausado.";
  if (action === "status" && result?.status === "active")
    return "Anuncio ativado.";
  if (action === "status") return "Status atualizado.";
  if (action === "photo_attach") return "Foto adicionada ao anuncio.";
  if (action === "photo_primary") return "Foto principal atualizada.";
  if (action === "photo_remove") return "Foto removida do anuncio.";
  return "Acao concluida.";
}

function realEstateActionErrorMessage(error) {
  if (error === "business_required" || error === "broker_required") {
    return "Area disponivel apenas para corretores.";
  }
  if (error === "invalid_property" || error === "not_listable") {
    return "Imovel indisponivel para anuncio.";
  }
  if (error === "property_not_found" || error === "house_not_found")
    return "Imovel base nao encontrado.";
  if (
    error === "property_not_advertisable" ||
    error === "disabled" ||
    error === "archived" ||
    error === "hidden" ||
    error === "not_residential" ||
    error === "not_player_property" ||
    error === "org_property"
  ) {
    return "Este imovel nao esta liberado para anuncio.";
  }
  if (error === "property_required")
    return "Selecione um Imovel base.";
  if (error === "invalid_title")
    return "Informe um titulo com pelo menos 3 letras.";
  if (error === "invalid_listing_type")
    return "Escolha venda, aluguel, visita ou vitrine.";
  if (error === "invalid_price")
    return "Informe um preco valido.";
  if (error === "invalid_status") return "Status invalido.";
  if (error === "listing_not_found") return "Anuncio nao encontrado.";
  if (error === "listing_archived")
    return "Este anuncio foi removido e nao aceita esta acao.";
  if (error === "invalid_photo" || error === "photo_not_found")
    return "Foto indisponivel.";
  if (error === "photo_not_owned")
    return "Esta foto nao pertence a sua galeria.";
  if (error === "photo_limit_reached")
    return "Limite de fotos atingido para este anuncio.";
  if (error === "invalid_image_url")
    return "A foto aparece na sua galeria, mas nao possui URL publica valida para anuncio.";
  if (error === "scheme_not_allowed")
    return "Esta foto foi salva em formato local e nao pode ser usada em anuncio publico.";
  if (error === "too_long")
    return "A URL publica desta foto e maior do que o limite permitido para anuncio.";
  if (error === "upload_public_url_missing")
    return "Esta foto nao possui URL publica. Configure o upload do mz_phone_server ou Discord para usar fotos em anuncios.";
  if (error === "photo_insert_failed")
    return "Nao foi possivel salvar a foto no anuncio.";
  if (error === "business_permission_required") {
    return "Sua imobiliaria nao pode criar este anuncio.";
  }
  if (error === "permission_denied") {
    return "Voce nao pode alterar este anuncio.";
  }
  if (error === "create_failed")
    return "Nao foi possivel criar o anuncio.";
  if (error === "realestate_unavailable")
    return "Sistema de imoveis indisponivel.";
  if (error === "rate_limited")
    return "Aguarde um instante para tentar de novo.";
  if (String(error || "").startsWith("listing_duplicate")) {
    return "Este imovel ja possui anuncio ativo ou pausado.";
  }
  return "Nao foi possivel concluir a acao.";
}

function realEstateListingTypeFromTab(tab) {
  if (tab === "sale" || tab === "rent" || tab === "visit" || tab === "showcase") {
    return tab;
  }

  return "";
}

function applyShellState() {
  if (!phoneShell) return;

  const isOpen = isPhoneActuallyOpen();
  const hasIncoming = Boolean(phoneState.incomingCall);
  const hasCallSession = Boolean(phoneState.callSession);
  const isPeeking = !isOpen && Boolean(phoneState.notificationPreview);
  const shouldShow = isOpen || hasIncoming || hasCallSession || isPeeking;

  phoneShell.style.display = shouldShow ? "flex" : "none";
  phoneShell.classList.toggle("phone-open", isOpen);
  phoneShell.classList.toggle(
    "phone-closed",
    !isOpen && !hasIncoming && !hasCallSession && !isPeeking,
  );
  phoneShell.classList.toggle(
    "phone-peek",
    !isOpen && isPeeking && !hasIncoming && !hasCallSession,
  );
  phoneShell.classList.toggle("has-incoming-call", hasIncoming);
  phoneShell.classList.toggle(
    "has-active-call",
    !hasIncoming && hasCallSession,
  );

  document.body?.classList?.toggle("phone-open", isOpen);
  document.body?.classList?.toggle(
    "phone-closed",
    !isOpen && !hasIncoming && !hasCallSession && !isPeeking,
  );
  document.body?.classList?.toggle(
    "phone-peek",
    !isOpen && isPeeking && !hasIncoming && !hasCallSession,
  );
}

function isPhoneActuallyOpen() {
  return phoneState.isOpen === true;
}

function maintainOpenIfAlreadyOpen(reason = "maintain_open_if_already_open") {
  if (!isPhoneActuallyOpen()) return false;

  clearNotificationPreview(reason);

  document.body?.classList?.remove("phone-peek", "phone-closed");
  document.body?.classList?.add("phone-open");

  phoneShell?.classList?.remove("phone-peek", "phone-closed");
  phoneShell?.classList?.add("phone-open");

  applyShellState();
  return true;
}

function clearNotificationPreview(reason = "clear") {
  if (notificationPreviewTimer) {
    clearTimeout(notificationPreviewTimer);
    notificationPreviewTimer = null;
  }

  if (phoneState.notificationPreview) {
    logNui("notify", `clear preview reason=${reason}`);
  }

  phoneState.notificationPreview = null;
  applyShellState();
}

function showPhonePreview(duration = 3600) {
  if (
    isPhoneActuallyOpen() ||
    phoneState.incomingCall ||
    phoneState.callSession
  ) {
    clearNotificationPreview("phone_open_notification");
    return;
  }

  const previewId = Date.now();
  if (notificationPreviewTimer) {
    clearTimeout(notificationPreviewTimer);
    notificationPreviewTimer = null;
  }

  phoneState.notificationPreview = previewId;
  logNui("notify", "peek phone for notification");
  applyShellState();

  notificationPreviewTimer = setTimeout(() => {
    notificationPreviewTimer = null;
    if (phoneState.notificationPreview !== previewId) return;
    if (isPhoneActuallyOpen()) {
      clearNotificationPreview("phone_open_before_preview_timeout");
      return;
    }

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
      typeof audio.ringtoneVolume === "number" ? audio.ringtoneVolume : 0.45,
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

  let html = `<div class="app-page"></div>`;
  try {
    const ctx = createAppContext(appId);
    html = app.render ? app.render(ctx) : html;
  } catch (error) {
    console.error("[mz_phone] render app error", appId, error);
    phoneState.isOpen = true;
    clearNotificationPreview("render_app_error");
    applyShellState();
    html = `
      <div class="app-page app-error-page">
        <div class="app-content realestate-content">
          <div class="realestate-empty">
            <i data-lucide="triangle-alert"></i>
            <div>Nao foi possivel carregar esta tela.</div>
            <button class="realestate-action" onclick="window.goHome()">
              <i data-lucide="chevron-left"></i>
              <span>Voltar</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  appContent.innerHTML = html;

  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

function realEstateListingFromPayload(data) {
  if (!data || typeof data !== "object" || data.ok === false) return null;

  const candidates = [
    data.listing,
    data.result?.listing,
    data.data?.listing,
    data.result,
    data.data,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object") {
      return candidate;
    }
  }

  return null;
}

function realEstateActionResultFromPayload(data) {
  if (!data || typeof data !== "object") return {};

  const raw =
    data.result && typeof data.result === "object"
      ? data.result
      : data.data && typeof data.data === "object"
        ? data.data
        : data.listing && typeof data.listing === "object"
          ? data.listing
          : {};
  const listing =
    raw.listing && typeof raw.listing === "object"
      ? raw.listing
      : data.listing && typeof data.listing === "object"
        ? data.listing
        : raw;
  const listingCode = String(
    raw.listingCode ||
      raw.listing_code ||
      raw.code ||
      data.listingCode ||
      data.listing_code ||
      data.code ||
      listing?.listingCode ||
      listing?.listing_code ||
      listing?.code ||
      "",
  ).trim();

  return {
    ...raw,
    listing,
    listingCode,
    status: raw.status || listing?.status || "",
  };
}

function mediaPhotoUrl(photo) {
  return (
    photo?.image_url ||
    photo?.imageUrl ||
    photo?.url ||
    photo?.thumbnail_url ||
    photo?.thumbnailUrl ||
    ""
  );
}

function mediaPhotoId(photo) {
  const id =
    photo?.galleryPhotoId ??
    photo?.gallery_photo_id ??
    photo?.id ??
    photo?.photoId ??
    photo?.photo_id ??
    null;

  if (id === "" || id === undefined || id === null) return null;
  return id;
}

function normalizeMediaResult(photo, source = "gallery") {
  if (!photo || typeof photo !== "object") return null;
  const imageUrl = mediaPhotoUrl(photo);
  if (!imageUrl) return null;
  const id = mediaPhotoId(photo);

  return {
    id,
    galleryPhotoId: id,
    url: imageUrl,
    imageUrl,
    thumbnailUrl:
      photo.thumbnail_url ||
      photo.thumbnailUrl ||
      photo.imageUrl ||
      photo.image_url ||
      imageUrl,
    caption: photo.caption || "",
    type: "image",
    source,
    createdAt: photo.createdAt || photo.created_at || "",
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
  const returnTo =
    options.returnTo || options.returnApp || phoneState.currentApp || null;
  const request = {
    kind,
    purpose: options.purpose || "",
    type: options.type || "image",
    returnTo,
    returnApp: returnTo,
    context: options.context && typeof options.context === "object" ? options.context : {},
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
      type: request.type,
      returnTo: request.returnTo,
      returnApp: request.returnApp,
    },
    galleryPicker: kind === "gallery",
    gallerySelectedPhotoId: null,
  });

  return request;
}

function dispatchMediaResult(result, request) {
  if (!result || !request) return;
  const returnTo = request.returnTo || request.returnApp;
  const handlerMap = {
    settings: () => window.SettingsApp?.applyMediaResult?.(result, request),
    messages: () => window.MessagesApp?.applyMediaResult?.(result, request),
    contacts: () => window.ContactsApp?.applyMediaResult?.(result, request),
    realestate: () =>
      window.RealEstateApp?.applyMediaResult?.(result, request.context, request),
  };

  window.setTimeout(() => {
    const consumer = window.PhoneMedia?.consumers?.[returnTo];
    const handled =
      typeof consumer?.applyMediaResult === "function"
        ? consumer.applyMediaResult(result, request.context, request)
        : handlerMap[returnTo]?.();
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
  const returnState =
    request.returnState && typeof request.returnState === "object"
      ? request.returnState
      : {};

  patchPhoneState({
    ...returnState,
    isOpen: true,
    notificationPreview: null,
    galleryPicker: false,
    gallerySelectedPhotoId: null,
    pendingMediaPurpose: "",
    pendingMediaRequest: null,
  });

  if (request.returnApp) {
    window.openApp(request.returnApp, {
      skipMediaRequest: true,
      mediaContext: request.context || {},
      mediaRequest: {
        kind: request.kind,
        purpose: request.purpose,
        type: request.type,
        returnTo: request.returnTo,
        returnApp: request.returnApp,
      },
      mediaResult: result,
    });
  } else {
    window.goHome();
  }

  maintainOpenIfAlreadyOpen("media_result_complete");
  applyShellState();
  dispatchMediaResult(result, request);
}

function cancelMediaRequest() {
  const request = activeMediaRequest;
  if (!request) return;

  activeMediaRequest = null;
  const returnState =
    request.returnState && typeof request.returnState === "object"
      ? request.returnState
      : {};

  patchPhoneState({
    ...returnState,
    isOpen: true,
    notificationPreview: null,
    galleryPicker: false,
    gallerySelectedPhotoId: null,
    pendingMediaPurpose: "",
    pendingMediaRequest: null,
  });

  if (request.returnApp) {
    window.openApp(request.returnApp, {
      skipMediaRequest: true,
      mediaContext: request.context || {},
      mediaRequest: {
        kind: request.kind,
        purpose: request.purpose,
        type: request.type,
        returnTo: request.returnTo,
        returnApp: request.returnApp,
      },
    });
  } else {
    window.goHome();
  }

  maintainOpenIfAlreadyOpen("media_result_cancel");
  applyShellState();
}

window.PhoneMedia = {
  consumers: {},

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
  if (closePhoneDialog("cancel")) return;

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
  phoneState.dialog = null;
  phoneDialogCallbacks.clear();

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

  clearNotificationPreview("phone_open");

  if (appScreen) appScreen.style.display = "none";
  if (homeScreen) homeScreen.style.display = "block";

  updateClock();
  applyTheme();
  renderHome();
  renderCallOverlay();
}

function handlePhoneClose() {
  if (closePhoneDialog("cancel")) return;

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
  clearNotificationPreview("phone_close");

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
      if (closePhoneDialog("cancel")) return;
      window.goHome();
    });
  }

  if (phoneDialogRoot) {
    phoneDialogRoot.addEventListener("click", (event) => {
      const actionTarget = event.target?.closest?.(
        "[data-phone-dialog-action]",
      );
      const isInsideDialog = Boolean(event.target?.closest?.(".phone-dialog"));
      if (isInsideDialog && !event.target?.closest?.(".phone-dialog__button")) {
        return;
      }

      const action = actionTarget?.dataset?.phoneDialogAction;
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      closePhoneDialog(action === "confirm" ? "confirm" : "cancel");
    });
  }

  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!hasOpenPhoneDialog()) return;

    event.preventDefault();
    event.stopPropagation();
    closePhoneDialog("cancel");
  });

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
      phoneState.gallery = listFromPayload(data, ["photos", "items", "gallery"]);

      if (phoneState.currentApp === "gallery") {
        renderCurrentApp();
      }
    });
  }

  if (window.PhoneAPI?.onReceiveRealEstateListings) {
    window.PhoneAPI.onReceiveRealEstateListings((payload) => {
      const data = payload && typeof payload === "object" ? payload : {};

      phoneState = window.AppContract.realestate.setListings(
        phoneState,
        Array.isArray(data.listings) ? data.listings : [],
      );
      phoneState.realEstateLoading = false;
      phoneState.realEstateError =
        data.ok === false ? data.error || "unavailable" : "";

      if (phoneState.currentApp === "realestate") {
        renderCurrentApp();
      }
    });
  }

  if (window.PhoneAPI?.onReceiveRealEstateListing) {
    window.PhoneAPI.onReceiveRealEstateListing((payload) => {
      const data = payload && typeof payload === "object" ? payload : {};

      phoneState = window.AppContract.realestate.setSelected(
        phoneState,
        realEstateListingFromPayload(data),
      );
      phoneState.realEstateLoading = false;
      phoneState.realEstateError =
        data.ok === false ? data.error || "unavailable" : "";

      if (phoneState.currentApp === "realestate") {
        renderCurrentApp();
      }
    });
  }

  if (window.PhoneAPI?.onReceiveRealEstateBrokerAccess) {
    window.PhoneAPI.onReceiveRealEstateBrokerAccess((payload) => {
      const data = payload && typeof payload === "object" ? payload : {};

      phoneState.realEstateAccess =
        data.ok === false
          ? { allowed: false }
          : data.access || { allowed: false };

      if (phoneState.currentApp === "realestate") {
        renderCurrentApp();
      }
    });
  }

  if (window.PhoneAPI?.onReceiveRealEstateProperties) {
    window.PhoneAPI.onReceiveRealEstateProperties((payload) => {
      const data = payload && typeof payload === "object" ? payload : {};

      phoneState.realEstateProperties = Array.isArray(data.properties)
        ? data.properties
        : [];
      phoneState.realEstatePropertiesLoading = false;
      phoneState.realEstatePropertiesError =
        data.ok === false ? data.error || "properties_failed" : "";

      if (phoneState.currentApp === "realestate") {
        renderCurrentApp();
      }
    });
  }

  if (window.PhoneAPI?.onReceiveMyRealEstateListings) {
    window.PhoneAPI.onReceiveMyRealEstateListings((payload) => {
      const data = payload && typeof payload === "object" ? payload : {};

      phoneState.realEstateMyListings = (Array.isArray(data.listings)
        ? data.listings
        : []
      )
        .map((listing) =>
          window.AppContract.realestate.setSelected({}, listing)
            .realEstateSelectedListing,
        )
        .filter(Boolean);
      phoneState.realEstateLoading = false;
      phoneState.realEstateError =
        data.ok === false ? data.error || "broker_required" : "";

      if (phoneState.currentApp === "realestate") {
        renderCurrentApp();
      }
    });
  }

  if (window.PhoneAPI?.onReceiveMyRealEstateListing) {
    window.PhoneAPI.onReceiveMyRealEstateListing((payload) => {
      const data = payload && typeof payload === "object" ? payload : {};
      const listing =
        window.AppContract.realestate.setSelected(
          {},
          realEstateListingFromPayload(data),
        ).realEstateSelectedListing || null;

      phoneState.realEstateSelectedListing = listing;
      phoneState.realEstateLoading = false;
      phoneState.realEstateError =
        data.ok === false ? data.error || "listing_not_found" : "";

      if (listing && phoneState.realEstateView === "form") {
        phoneState.realEstateForm = {
          listingType: listing.listingType || "sale",
          propertyCode: listing.propertyCode || "",
          title: listing.title || "",
          description: listing.description || "",
          price: listing.price || "",
          signPhone: listing.signPhone || listing.brokerPhone || "",
          signBrokerName: listing.signBrokerName || listing.brokerName || "",
          showSign: listing.showSign === true,
        };
      }

      if (phoneState.currentApp === "realestate") {
        renderCurrentApp();
      }
    });
  }

  if (window.PhoneAPI?.onReceiveRealEstateAction) {
    window.PhoneAPI.onReceiveRealEstateAction((payload) => {
      const data = payload && typeof payload === "object" ? payload : {};
      const action = String(data.action || "");
      const result = realEstateActionResultFromPayload(data);
      const isPhotoAction =
        action === "photo_attach" ||
        action === "photo_primary" ||
        action === "photo_remove" ||
        action === "photos" ||
        action === "gallery";
      window.RealEstateApp?.clearSaveTimeout?.();
      phoneState.realEstateActionBusy = false;
      phoneState.realEstateSaving = false;
      if (isPhotoAction) {
        phoneState.realEstatePhotoBusy = false;
      }
      if (action === "gallery") {
        phoneState.realEstatePhotoPickerLoading = false;
      }

      if (phoneState.currentApp === "realestate") {
        phoneState.isOpen = true;
        clearNotificationPreview("realestate_action_keep_open");
        applyShellState();
      }

      if (isPhoneActuallyOpen()) {
        maintainOpenIfAlreadyOpen("realestate_action");
      }

      if (data.ok === false) {
        phoneState.realEstateLastError = data.error || "action_failed";
        if (window.localStorage?.getItem("mzPhoneDebug") === "1") {
          console.debug("[realestate:create]", {
            action: "response ok=false",
            error: phoneState.realEstateLastError,
          });
        }
        window.PhoneUI?.notify?.({
          type: "error",
          title: "Imoveis",
          message: realEstateActionErrorMessage(data.error),
          preventPreview: true,
          keepPhoneOpen: true,
          scope: "in-app",
        });
        if (isPhoneActuallyOpen()) {
          maintainOpenIfAlreadyOpen("realestate_action_error");
        }
      } else if (isPhotoAction) {
        const listingCode =
          result.listingCode || phoneState.realEstateSelectedListing?.listingCode || "";

        if (action === "photos") {
          phoneState.realEstateSelectedListing = {
            ...(phoneState.realEstateSelectedListing || {}),
            listingCode,
            photos: (Array.isArray(result.photos) ? result.photos : [])
              .map((photo) =>
                window.AppContract.realestate.setSelected(
                  {},
                  { listingCode, photos: [photo] },
                ).realEstateSelectedListing?.photos?.[0],
              )
              .filter(Boolean),
          };
        } else if (action !== "gallery") {
          phoneState.realEstatePhotoPickerOpen = false;

          window.PhoneUI?.notify?.({
            type: "success",
            title: "Imoveis",
            message: realEstateActionSuccessMessage(action, result),
            preventPreview: true,
            keepPhoneOpen: true,
            scope: "in-app",
          });

          if (listingCode) {
            window.PhoneAPI?.getMyRealEstateListing?.(listingCode);
            window.PhoneAPI?.getRealEstateListingPhotos?.(listingCode);
          }

          window.PhoneAPI?.getMyRealEstateListings?.();
          window.PhoneAPI?.getRealEstateListings?.({
            listingType: realEstateListingTypeFromTab(phoneState.realEstateTab),
          });
        }
      } else {
        const resultListingCode = String(result.listingCode || "").trim();

        if ((action === "create" || action === "update") && resultListingCode) {
          if (window.localStorage?.getItem("mzPhoneDebug") === "1") {
            console.debug("[realestate:create]", {
              action: "response ok=true",
              listingCode: resultListingCode,
            });
          }
          phoneState.realEstateView = "form";
          phoneState.realEstateFormMode = "edit";
          phoneState.realEstateEditingListingCode = resultListingCode;
          phoneState.realEstateReturnView = "mine";
          phoneState.realEstateSelectedListing = null;
          phoneState.realEstateForm = { listingCode: resultListingCode };
          phoneState.realEstateLoading = true;
          window.PhoneAPI?.getMyRealEstateListing?.(resultListingCode);
          window.PhoneAPI?.getRealEstateListingPhotos?.(resultListingCode);
        } else if (action === "create" || action === "update") {
          phoneState.realEstateView = "mine";
          phoneState.realEstateSelectedListing = null;
          phoneState.realEstateForm = {};
          phoneState.realEstateLastError = "missing_listing_code";

          window.PhoneUI?.notify?.({
            type: "warning",
            title: "Imoveis",
            message:
              action === "create"
                ? "Anuncio criado, mas nao foi possivel abrir a edicao."
                : "Anuncio atualizado, mas nao foi possivel abrir a edicao.",
            preventPreview: true,
            keepPhoneOpen: true,
            scope: "in-app",
          });
        } else {
          phoneState.realEstateView = "mine";
          phoneState.realEstateSelectedListing = null;
          phoneState.realEstateForm = {};
        }
        phoneState.realEstateError = "";

        if (resultListingCode || (action !== "create" && action !== "update")) {
          window.PhoneUI?.notify?.({
            type: "success",
            title: "Imoveis",
            message: realEstateActionSuccessMessage(action, result),
            preventPreview: true,
            keepPhoneOpen: true,
            scope: "in-app",
          });
        }

        window.PhoneAPI?.getMyRealEstateListings?.();
        window.PhoneAPI?.getRealEstateListings?.({
          listingType: realEstateListingTypeFromTab(phoneState.realEstateTab),
        });
      }

      if (phoneState.currentApp === "realestate") {
        if (isPhoneActuallyOpen()) {
          maintainOpenIfAlreadyOpen("realestate_action_before_render");
        }
        renderCurrentApp();
        if (isPhoneActuallyOpen()) {
          maintainOpenIfAlreadyOpen("realestate_action_after_render");
        }
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
        data.displayName ||
        data.contactName ||
        contact?.name ||
        number ||
        data.fallbackName ||
        "Desconhecido";

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
          name:
            data.displayName ||
            data.contactName ||
            contact?.name ||
            number ||
            data.fallbackName ||
            "Desconhecido",
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
        const messageAudio = phoneState.audio || {};
        const messageNotification = messageAudio.messageNotification || {};
        window.PhoneAudio?.play(
          "message-notify",
          messageNotification.source || "sounds/notification.mp3",
          {
            volume:
              typeof messageNotification.volume === "number"
                ? messageNotification.volume
                : 1,
          },
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
  isActuallyOpen: isPhoneActuallyOpen,
  showNotificationPreview: showPhonePreview,
  clearNotificationPreview,
  maintainOpenIfAlreadyOpen,
  enforceOpenPhoneState: maintainOpenIfAlreadyOpen,
};

bootPhone();
