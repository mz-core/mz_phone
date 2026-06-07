const SETTINGS_WALLPAPERS = [
  { id: "default", label: "Default" },
  { id: "firewatch", label: "Firewatch" },
  { id: "iphone14", label: "iPhone 14" },
  { id: "iphone1444", label: "iPhone 14 4" },
  { id: "iphonex", label: "iPhone X" },
  { id: "maravilhosa", label: "Maravilhosa" },
  { id: "moon", label: "Moon" },
  { id: "mtfuji", label: "Mt. Fuji" },
  { id: "s20", label: "Galaxy S20" },
  { id: "s9", label: "Galaxy S9" },
  { id: "taiwan", label: "Taiwan" },
  { id: "vaporwave", label: "Vaporwave" },
];

function formatBirthdate(value) {
  if (!value) return "Não informado";

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }

  return value;
}

function getProfileName(profile) {
  const first = String(profile.firstname || "").trim();
  const last = String(profile.lastname || "").trim();
  const fullName = `${first} ${last}`.trim();

  return fullName || "Sem nome";
}

function renderSettingsMain(ctx, settings) {
  return `
    <div class="app-page settings-page">
      <div class="app-header app-header--standard">
        <div class="app-header-left"></div>

        <div class="app-header-center">
          <div class="app-title">Ajustes</div>
        </div>

        <div class="app-header-right"></div>
      </div>

      <div class="app-content settings-content">
        <div class="settings-group">
          <button class="settings-row-button" onclick="window.SettingsApp.openView('profile')">
            <div class="settings-row-left">
              <div class="settings-row-icon bg-blue">
                <i data-lucide="user-round"></i>
              </div>
              <div class="settings-row-texts">
                <div class="settings-row-title">Perfil</div>
                <div class="settings-row-subtitle">${getProfileName(settings.playerProfile)}</div>
              </div>
            </div>

            <div class="settings-row-right">
              <i data-lucide="chevron-right"></i>
            </div>
          </button>
        </div>

        <div class="settings-group">
          <button class="settings-row-button" onclick="window.SettingsApp.openView('theme')">
            <div class="settings-row-left">
              <div class="settings-row-icon bg-violet">
                <i data-lucide="moon-star"></i>
              </div>
              <div class="settings-row-texts">
                <div class="settings-row-title">Tema</div>
                <div class="settings-row-subtitle">${settings.theme === "light" ? "White" : "Black"}</div>
              </div>
            </div>

            <div class="settings-row-right">
              <i data-lucide="chevron-right"></i>
            </div>
          </button>

          <button class="settings-row-button" onclick="window.SettingsApp.openView('wallpaper')">
            <div class="settings-row-left">
              <div class="settings-row-icon bg-cyan">
                <i data-lucide="image"></i>
              </div>
              <div class="settings-row-texts">
                <div class="settings-row-title">Papel de parede</div>
                <div class="settings-row-subtitle">${
                  settings.wallpaper === "custom"
                    ? "URL personalizada"
                    : SETTINGS_WALLPAPERS.find(
                        (item) => item.id === settings.wallpaper,
                      )?.label || settings.wallpaper
                }</div>
              </div>
            </div>

            <div class="settings-row-right">
              <i data-lucide="chevron-right"></i>
            </div>
          </button>
        </div>

        <div class="settings-group">
          <button class="settings-row-button" onclick="window.SettingsApp.openView('about')">
            <div class="settings-row-left">
              <div class="settings-row-icon bg-slate">
                <i data-lucide="info"></i>
              </div>
              <div class="settings-row-texts">
                <div class="settings-row-title">Sobre</div>
                <div class="settings-row-subtitle">Versão do celular</div>
              </div>
            </div>

            <div class="settings-row-right">
              <i data-lucide="chevron-right"></i>
            </div>
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderSettingsProfile(ctx, settings, state) {
  const profile = settings.playerProfile;
  const fullName = getProfileName(profile);
  const profilePhoto = settings.profilePhoto || "";
  const modal = state.settingsModal;
  const draft = state.settingsInputDraft || "";

  return `
    <div class="app-page settings-page">
      <div class="app-header app-header--standard">
        <div class="app-header-left">
          <button class="app-header-icon-btn" onclick="window.SettingsApp.back()">
            <i data-lucide="chevron-left"></i>
          </button>
        </div>

        <div class="app-header-center">
          <div class="app-title">Perfil</div>
        </div>

        <div class="app-header-right"></div>
      </div>

      <div class="app-content settings-content">
        <div class="settings-profile-card">
          <div class="settings-profile-avatar-wrap">
            ${
              profilePhoto
                ? `<img class="settings-profile-avatar" src="${window.Utils.escapeHtmlAttr(profilePhoto)}" alt="Foto do perfil" />`
                : `
                  <div class="settings-profile-avatar placeholder">
                    <i data-lucide="user-round"></i>
                  </div>
                `
            }

            <button class="settings-avatar-add" onclick="window.SettingsApp.openModal('profilePhoto')">
              <i data-lucide="plus"></i>
            </button>
          </div>

          <div class="settings-profile-name">${window.Utils.escapeHtml(fullName)}</div>
          <div class="settings-profile-number">${window.Utils.escapeHtml(window.Utils.formatPhone(profile.phoneNumber || "")) || "Sem número"}</div>
        </div>

        <div class="settings-group">
          <div class="settings-info-row">
            <span class="settings-info-label">Nome</span>
            <span class="settings-info-value">${window.Utils.escapeHtml(fullName)}</span>
          </div>

          <div class="settings-info-row">
            <span class="settings-info-label">Número</span>
            <span class="settings-info-value">${window.Utils.escapeHtml(window.Utils.formatPhone(profile.phoneNumber || "")) || "Não informado"}</span>
          </div>

          <div class="settings-info-row">
            <span class="settings-info-label">CPF</span>
            <span class="settings-info-value">${window.Utils.escapeHtml(profile.citizenid || "Não informado")}</span>
          </div>

          <div class="settings-info-row">
            <span class="settings-info-label">Nacionalidade</span>
            <span class="settings-info-value">${window.Utils.escapeHtml(profile.nationality || "Não informado")}</span>
          </div>

          <div class="settings-info-row">
            <span class="settings-info-label">Nascimento</span>
            <span class="settings-info-value">${window.Utils.escapeHtml(formatBirthdate(profile.birthdate))}</span>
          </div>
        </div>
      </div>

      ${
        modal === "profilePhoto"
          ? `
            <div class="settings-inline-modal-backdrop" onclick="window.SettingsApp.closeModal()">
              <div class="settings-inline-modal" onclick="event.stopPropagation()">
                <div class="settings-inline-modal-title">Adicionar foto</div>

                <button class="settings-modal-option" onclick="window.SettingsApp.fakePhotoAction('gallery')">
                  <i data-lucide="images"></i>
                  <span>Galeria</span>
                </button>

                <button class="settings-modal-option" onclick="window.SettingsApp.fakePhotoAction('camera')">
                  <i data-lucide="camera"></i>
                  <span>Câmera</span>
                </button>

                <button class="settings-modal-option" onclick="window.SettingsApp.openModal('profilePhotoUrl')">
                  <i data-lucide="link"></i>
                  <span>Inserir URL</span>
                </button>

                ${
                  profilePhoto
                    ? `
                      <button class="settings-modal-option" onclick="window.SettingsApp.removeProfilePhoto()">
                        <i data-lucide="trash-2"></i>
                        <span>Remover foto</span>
                      </button>
                    `
                    : ""
                }

                <button class="settings-modal-cancel" onclick="window.SettingsApp.closeModal()">
                  Cancelar
                </button>
              </div>
            </div>
          `
          : ""
      }

      ${
        modal === "profilePhotoUrl"
          ? `
            <div class="settings-inline-modal-backdrop" onclick="window.SettingsApp.closeModal()">
              <div class="settings-inline-modal" onclick="event.stopPropagation()">
                <div class="settings-inline-modal-title">Inserir URL da foto</div>

                <input
                  class="settings-modal-input"
                  type="text"
                  placeholder="https://..."
                  value="${window.Utils.escapeHtmlAttr(draft)}"
                  oninput="window.SettingsApp.setInputDraft(this.value)"
                />

                <button class="settings-modal-option primary" onclick="window.SettingsApp.confirmProfilePhotoUrl()">
                  <i data-lucide="check"></i>
                  <span>Salvar foto</span>
                </button>

                <button class="settings-modal-cancel" onclick="window.SettingsApp.closeModal()">
                  Cancelar
                </button>
              </div>
            </div>
          `
          : ""
      }
    </div>
  `;
}

function renderSettingsTheme(ctx, settings) {
  return `
    <div class="app-page settings-page">
      <div class="app-header app-header--standard">
        <div class="app-header-left">
          <button class="app-header-icon-btn" onclick="window.SettingsApp.back()">
            <i data-lucide="chevron-left"></i>
          </button>
        </div>

        <div class="app-header-center">
          <div class="app-title">Tema</div>
        </div>

        <div class="app-header-right"></div>
      </div>

      <div class="app-content settings-content">
        <div class="settings-group">
          <button
            class="settings-theme-button ${settings.theme === "dark" ? "is-active" : ""}"
            onclick="window.SettingsApp.setTheme('dark')"
          >
            <div class="settings-theme-preview dark"></div>
            <div class="settings-theme-title">Black</div>
          </button>

          <button
            class="settings-theme-button ${settings.theme === "light" ? "is-active" : ""}"
            onclick="window.SettingsApp.setTheme('light')"
          >
            <div class="settings-theme-preview light"></div>
            <div class="settings-theme-title">White</div>
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderSettingsWallpaper(ctx, settings, state) {
  const modal = state.settingsModal;
  const draft = state.settingsInputDraft || "";

  return `
    <div class="app-page settings-page">
      <div class="app-header app-header--standard">
        <div class="app-header-left">
          <button class="app-header-icon-btn" onclick="window.SettingsApp.back()">
            <i data-lucide="chevron-left"></i>
          </button>
        </div>

        <div class="app-header-center">
          <div class="app-title">Papel de Parede</div>
        </div>

        <div class="app-header-right"></div>
      </div>

      <div class="app-content settings-content">
        <div class="settings-wallpaper-grid">
          <button class="settings-wallpaper-add" onclick="window.SettingsApp.openModal('wallpaperSource')">
            <div class="settings-wallpaper-add-icon">
              <i data-lucide="plus"></i>
            </div>
            <div class="settings-wallpaper-name">Adicionar</div>
          </button>

          ${SETTINGS_WALLPAPERS.map((item) => {
            const selected = settings.wallpaper === item.id;

            return `
              <button
                class="settings-wallpaper-item ${selected ? "is-selected" : ""}"
                onclick="window.SettingsApp.setWallpaper('${item.id}')"
              >
                <div
                  class="settings-wallpaper-preview"
                  style="background-image: var(--settings-wallpaper-${item.id});"
                ></div>

                <div class="settings-wallpaper-name">${window.Utils.escapeHtml(item.label)}</div>
              </button>
            `;
          }).join("")}

          ${
            settings.customWallpaper
              ? `
                <button
                  class="settings-wallpaper-item ${settings.wallpaper === "custom" ? "is-selected" : ""}"
                  onclick="window.SettingsApp.useCustomWallpaper()"
                >
                  <div
                    class="settings-wallpaper-preview"
                    style="background-image: url('${window.Utils.escapeHtmlAttr(settings.customWallpaper)}');"
                  ></div>

                  <div class="settings-wallpaper-name">URL personalizada</div>
                </button>
              `
              : ""
          }
        </div>
      </div>

      ${
        modal === "wallpaperSource"
          ? `
            <div class="settings-inline-modal-backdrop" onclick="window.SettingsApp.closeModal()">
              <div class="settings-inline-modal" onclick="event.stopPropagation()">
                <div class="settings-inline-modal-title">Adicionar papel de parede</div>

                <button class="settings-modal-option" onclick="window.SettingsApp.fakeWallpaperAction('gallery')">
                  <i data-lucide="images"></i>
                  <span>Galeria</span>
                </button>

                <button class="settings-modal-option" onclick="window.SettingsApp.fakeWallpaperAction('camera')">
                  <i data-lucide="camera"></i>
                  <span>Câmera</span>
                </button>

                <button class="settings-modal-option" onclick="window.SettingsApp.openModal('wallpaperUrl')">
                  <i data-lucide="link"></i>
                  <span>Inserir URL</span>
                </button>

                <button class="settings-modal-cancel" onclick="window.SettingsApp.closeModal()">
                  Cancelar
                </button>
              </div>
            </div>
          `
          : ""
      }

      ${
        modal === "wallpaperUrl"
          ? `
            <div class="settings-inline-modal-backdrop" onclick="window.SettingsApp.closeModal()">
              <div class="settings-inline-modal" onclick="event.stopPropagation()">
                <div class="settings-inline-modal-title">Inserir URL do papel de parede</div>

                <input
                  class="settings-modal-input"
                  type="text"
                  placeholder="https://..."
                  value="${window.Utils.escapeHtmlAttr(draft)}"
                  oninput="window.SettingsApp.setInputDraft(this.value)"
                />

                <button class="settings-modal-option primary" onclick="window.SettingsApp.confirmWallpaperUrl()">
                  <i data-lucide="check"></i>
                  <span>Salvar papel de parede</span>
                </button>

                ${
                  settings.customWallpaper
                    ? `
                      <button class="settings-modal-option" onclick="window.SettingsApp.removeCustomWallpaper()">
                        <i data-lucide="trash-2"></i>
                        <span>Remover URL personalizada</span>
                      </button>
                    `
                    : ""
                }

                <button class="settings-modal-cancel" onclick="window.SettingsApp.closeModal()">
                  Cancelar
                </button>
              </div>
            </div>
          `
          : ""
      }
    </div>
  `;
}

function renderSettingsAbout() {
  return `
    <div class="app-page settings-page">
      <div class="app-header app-header--standard">
        <div class="app-header-left">
          <button class="app-header-icon-btn" onclick="window.SettingsApp.back()">
            <i data-lucide="chevron-left"></i>
          </button>
        </div>

        <div class="app-header-center">
          <div class="app-title">Sobre</div>
        </div>

        <div class="app-header-right"></div>
      </div>

      <div class="app-content settings-content">
        <div class="settings-about-card">
          <div class="settings-about-icon">
            <i data-lucide="smartphone"></i>
          </div>

          <div class="settings-about-title">MZ Phone</div>
          <div class="settings-about-version">Versão 0.1.0</div>
        </div>
      </div>
    </div>
  `;
}

registerApp({
  id: "settings",
  name: "Ajustes",
  icon: "settings",
  order: 1,

  render: (ctx) => {
    const state = ctx.getState();
    const settings = ctx.contract.settings.get(state);
    const view = state.settingsView || "main";

    if (view === "profile") {
      return renderSettingsProfile(ctx, settings, state);
    }

    if (view === "theme") {
      return renderSettingsTheme(ctx, settings);
    }

    if (view === "wallpaper") {
      return renderSettingsWallpaper(ctx, settings, state);
    }

    if (view === "about") {
      return renderSettingsAbout();
    }

    return renderSettingsMain(ctx, settings);
  },

  onOpen: (ctx) => {
    async function persistSettings(nextSettings, extraState = {}) {
      const currentState = ctx.getState();
      const nextState = ctx.contract.settings.set(
        {
          ...currentState,
          ...extraState,
        },
        nextSettings,
      );

      ctx.setState(nextState);
      window.PhoneApp.applyTheme();

      await ctx.saveState();
      ctx.renderCurrentApp();
    }

    window.SettingsApp = {
      openView: (view) => {
        ctx.patchState({
          settingsView: view,
          settingsModal: null,
          settingsInputDraft: "",
        });
        ctx.renderCurrentApp();
      },

      back: () => {
        ctx.patchState({
          settingsView: "main",
          settingsModal: null,
          settingsInputDraft: "",
        });
        ctx.renderCurrentApp();
      },

      openModal: (modalName) => {
        const currentSettings = ctx.contract.settings.get(ctx.getState());

        let draftValue = ctx.getState().settingsInputDraft || "";

        if (modalName === "profilePhotoUrl") {
          draftValue = currentSettings.profilePhoto || "";
        }

        if (modalName === "wallpaperUrl") {
          draftValue = currentSettings.customWallpaper || "";
        }

        ctx.patchState({
          settingsModal: modalName,
          settingsInputDraft: draftValue,
        });
        ctx.renderCurrentApp();
      },

      closeModal: () => {
        ctx.patchState({
          settingsModal: null,
          settingsInputDraft: "",
        });
        ctx.renderCurrentApp();
      },

      setInputDraft: (value) => {
        ctx.patchState({
          settingsInputDraft: value,
        });
      },

      setTheme: async (theme) => {
        const allowedThemes = ["dark", "light"];
        const safeTheme = allowedThemes.includes(theme) ? theme : "dark";
        const currentSettings = ctx.contract.settings.get(ctx.getState());

        await persistSettings(
          {
            ...currentSettings,
            theme: safeTheme,
          },
          {
            settingsView: "theme",
            settingsModal: null,
            settingsInputDraft: "",
          },
        );
      },

      setWallpaper: async (wallpaper) => {
        const allowedWallpapers = SETTINGS_WALLPAPERS.map((item) => item.id);
        const safeWallpaper = allowedWallpapers.includes(wallpaper)
          ? wallpaper
          : "default";

        const currentSettings = ctx.contract.settings.get(ctx.getState());

        await persistSettings(
          {
            ...currentSettings,
            wallpaper: safeWallpaper,
          },
          {
            settingsView: "wallpaper",
            settingsModal: null,
            settingsInputDraft: "",
          },
        );
      },

      useCustomWallpaper: async () => {
        const currentSettings = ctx.contract.settings.get(ctx.getState());

        if (!currentSettings.customWallpaper) return;

        await persistSettings(
          {
            ...currentSettings,
            wallpaper: "custom",
          },
          {
            settingsView: "wallpaper",
            settingsModal: null,
            settingsInputDraft: "",
          },
        );
      },

      confirmWallpaperUrl: async () => {
        const currentSettings = ctx.contract.settings.get(ctx.getState());
        const draft = String(ctx.getState().settingsInputDraft || "").trim();

        await persistSettings(
          {
            ...currentSettings,
            customWallpaper: draft,
            wallpaper: draft ? "custom" : "default",
          },
          {
            settingsView: "wallpaper",
            settingsModal: null,
            settingsInputDraft: "",
          },
        );
      },

      removeCustomWallpaper: async () => {
        const currentSettings = ctx.contract.settings.get(ctx.getState());

        await persistSettings(
          {
            ...currentSettings,
            customWallpaper: "",
            wallpaper:
              currentSettings.wallpaper === "custom"
                ? "default"
                : currentSettings.wallpaper,
          },
          {
            settingsView: "wallpaper",
            settingsModal: null,
            settingsInputDraft: "",
          },
        );
      },

      confirmProfilePhotoUrl: async () => {
        const currentSettings = ctx.contract.settings.get(ctx.getState());
        const draft = String(ctx.getState().settingsInputDraft || "").trim();

        await persistSettings(
          {
            ...currentSettings,
            profilePhoto: draft,
          },
          {
            settingsView: "profile",
            settingsModal: null,
            settingsInputDraft: "",
          },
        );
      },

      removeProfilePhoto: async () => {
        const currentSettings = ctx.contract.settings.get(ctx.getState());

        await persistSettings(
          {
            ...currentSettings,
            profilePhoto: "",
          },
          {
            settingsView: "profile",
            settingsModal: null,
            settingsInputDraft: "",
          },
        );
      },

      fakePhotoAction: () => {
        ctx.patchState({
          settingsModal: null,
          settingsInputDraft: "",
        });
        ctx.renderCurrentApp();
      },

      fakeWallpaperAction: () => {
        ctx.patchState({
          settingsModal: null,
          settingsInputDraft: "",
        });
        ctx.renderCurrentApp();
      },
    };
  },

  onClose: () => {
    delete window.SettingsApp;
  },
});
