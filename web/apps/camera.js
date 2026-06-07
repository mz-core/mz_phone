registerApp({
  id: "camera",
  name: "Camera",
  icon: "camera",
  order: 45,

  onOpen(ctx) {
    ctx.patchState({
      cameraBusy: false,
      cameraError: "",
      cameraLastPhoto: null,
    });
  },

  render(ctx) {
    const state = ctx.getState();

    return `
      <div class="app-page camera-page">
        <div class="app-header app-header--standard camera-header">
          <div class="app-header-left"></div>

          <div class="app-header-center">
            <div class="app-title">Camera</div>
          </div>

          <div class="app-header-right">
            <button class="app-header-icon-btn" onclick="window.CameraApp.openGallery()" aria-label="Abrir galeria">
              <i data-lucide="images"></i>
            </button>
          </div>
        </div>

        <div class="app-content camera-content">
          <div class="camera-launcher">
            <div class="camera-launcher-icon">
              <i data-lucide="camera"></i>
            </div>

            ${renderCameraFeedback(state)}

            <button
              class="camera-primary-btn"
              onclick="window.CameraApp.openCameraMode()"
              ${state.cameraBusy ? "disabled" : ""}
            >
              <i data-lucide="${state.cameraBusy ? "loader-circle" : "aperture"}"></i>
              <span>${state.cameraBusy ? "Abrindo..." : "Abrir camera"}</span>
            </button>

            <button class="camera-secondary-action" onclick="window.CameraApp.openGallery()">
              <i data-lucide="images"></i>
              <span>Galeria</span>
            </button>
          </div>
        </div>
      </div>
    `;
  },
});

function cameraErrorMessage(error) {
  const messages = {
    camera_disabled: "Camera desativada.",
    camera_unavailable: "Camera indisponivel.",
    camera_mode_active: "Camera ja esta aberta.",
    camera_mode_inactive: "Camera nao esta aberta.",
    camera_busy: "Camera ocupada.",
    camera_cancelled: "Camera cancelada.",
    camera_adapter_unavailable: "Camera indisponivel.",
    screenshot_basic_not_started: "screenshot-basic nao iniciado.",
    screenshot_basic_failed: "screenshot-basic falhou.",
    camera_upload_not_configured: "Upload da camera nao configurado.",
    camera_save_mode_unsupported: "Modo de salvamento nao suportado.",
    cooldown: "Aguarde antes de tirar outra foto.",
    camera_timeout: "Tempo de captura esgotado.",
    empty_upload_response: "Upload nao retornou imagem.",
    invalid_upload_response: "Resposta do upload invalida.",
    upload_url_not_found: "URL da foto nao encontrada.",
    gallery_limit_reached: "Limite de fotos atingido.",
    invalid_url: "URL da foto invalida.",
    scheme_not_allowed: "URL da foto nao permitida.",
    local_path_not_allowed: "Caminho da foto nao permitido.",
    internal_error: "Erro interno ao salvar foto.",
    save_failed: "Nao foi possivel salvar a foto.",
  };

  return messages[error] || "Nao foi possivel usar a camera.";
}

window.cameraErrorMessage = cameraErrorMessage;

function renderCameraFeedback(state) {
  if (state.cameraBusy) {
    return `
      <div class="camera-feedback is-loading">
        <i data-lucide="loader-circle"></i>
        <span>Abrindo modo camera...</span>
      </div>
    `;
  }

  if (state.cameraError) {
    return `
      <div class="camera-feedback is-error">
        <i data-lucide="triangle-alert"></i>
        <span>${window.Utils.escapeHtml(cameraErrorMessage(state.cameraError))}</span>
      </div>
    `;
  }

  if (state.cameraLastPhoto) {
    return `
      <div class="camera-feedback is-success">
        <i data-lucide="check-circle-2"></i>
        <span>Foto salva na galeria</span>
      </div>
    `;
  }

  return `
    <div class="camera-feedback">
      <i data-lucide="focus"></i>
      <span>O celular sera escondido ao abrir.</span>
    </div>
  `;
}

window.CameraApp = {
  async openCameraMode() {
    const state = window.PhoneApp.getState();
    if (state.cameraBusy) return;

    window.PhoneApp.patchState({
      cameraBusy: true,
      cameraError: "",
      cameraLastPhoto: null,
    });
    window.PhoneApp.renderCurrentApp();

    const result = window.PhoneAPI?.openCameraMode
      ? await window.PhoneAPI.openCameraMode({ restoreApp: "camera" })
      : { ok: false, error: "camera_unavailable" };

    if (result && result.ok === true) {
      window.PhoneApp.patchState({
        cameraBusy: false,
        cameraError: "",
      });
    } else {
      window.PhoneApp.patchState({
        cameraBusy: false,
        cameraError: result?.error || "camera_unavailable",
      });
    }

    window.PhoneApp.renderCurrentApp();
  },

  openGallery() {
    window.openApp("gallery");
  },
};
