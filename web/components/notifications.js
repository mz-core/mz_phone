window.PhoneUI = window.PhoneUI || {};

function getNotificationMeta(data = {}) {
  const type = data.type || "info";

  const map = {
    success: {
      icon: "circle-check-big",
      className: "success",
    },
    error: {
      icon: "circle-x",
      className: "error",
    },
    warning: {
      icon: "triangle-alert",
      className: "warning",
    },
    info: {
      icon: "info",
      className: "info",
    },
    message: {
      icon: "message-square",
      className: "message",
    },
    call: {
      icon: "phone",
      className: "call",
    },
  };

  return map[type] || map.info;
}

function getNotificationContainer() {
  let container = document.getElementById("phone-notifications");
  if (container) return container;

  const phoneScreen = document.querySelector(".phone-screen") || document.body;

  container = document.createElement("div");
  container.id = "phone-notifications";
  phoneScreen.appendChild(container);

  return container;
}

function isPhoneOpenForNotification() {
  const appOpen = window.PhoneApp?.isActuallyOpen?.() === true;
  const stateOpen = window.PhoneApp?.getState?.()?.isOpen === true;

  return appOpen || stateOpen;
}

window.PhoneUI.notify = function (payload = {}) {
  const container = getNotificationContainer();
  const meta = getNotificationMeta(payload);

  const title = payload.title || "";
  const message = payload.message || "";
  const icon = payload.icon || meta.icon;
  const typeClass = meta.className;
  const avatar = payload.avatar || "";
  const appLabel = payload.appLabel || "";
  const duration =
    typeof payload.duration === "number" ? payload.duration : 3200;

  const el = document.createElement("div");
  el.className = `phone-notify ${typeClass}`;

  const avatarHtml = avatar
    ? `
      <div class="phone-notify-avatar">
        <img src="${window.Utils.escapeHtmlAttr(avatar)}" alt="Avatar" />
      </div>
    `
    : `
      <div class="phone-notify-icon">
        <i data-lucide="${window.Utils.escapeHtmlAttr(icon)}"></i>
      </div>
    `;

  const appHtml = appLabel
    ? `<div class="phone-notify-app ${window.Utils.escapeHtmlAttr(typeClass)}-app">${window.Utils.escapeHtml(appLabel)}</div>`
    : "";

  el.innerHTML = `
    <div class="phone-notify-media">
      ${avatarHtml}
    </div>

    <div class="phone-notify-content">
      ${appHtml}
      <div class="phone-notify-title">${window.Utils.escapeHtml(title)}</div>
      <div class="phone-notify-msg">${window.Utils.escapeHtml(message)}</div>
    </div>
  `;

  container.appendChild(el);

  const phoneOpen = isPhoneOpenForNotification();
  const preventPreview = payload.preventPreview === true;
  const keepPhoneOpen = payload.keepPhoneOpen === true;
  const isInApp = payload.scope === "in-app" || preventPreview || keepPhoneOpen;

  if (phoneOpen) {
    window.PhoneApp?.clearNotificationPreview?.("notify_phone_open");
    window.PhoneApp?.maintainOpenIfAlreadyOpen?.("notify_phone_open");
  } else if (isInApp) {
    window.PhoneApp?.clearNotificationPreview?.("notify_in_app_closed");
  } else if (window.PhoneApp?.showNotificationPreview) {
    window.PhoneApp.showNotificationPreview(duration);
  }

  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }

  requestAnimationFrame(() => {
    el.classList.add("show");
  });

  setTimeout(() => {
    el.classList.remove("show");

    setTimeout(() => {
      el.remove();
    }, 260);
  }, duration);
};
