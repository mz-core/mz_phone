registerApp({
  id: "calls",
  name: "Telefone",
  icon: "phone",
  order: 5,

  onOpen(ctx) {
    ctx.patchState({
      callsTab: "recents",
      dialerValue: "",
    });

    if (window.PhoneAPI?.getCalls) {
      window.PhoneAPI.getCalls();
    }
  },

  render(ctx) {
    const state = ctx.getState();

    return `
      <div class="app-page calls-page">
        <div class="app-header app-header--standard">
          <div class="app-header-left"></div>

          <div class="app-header-center">
            <div class="app-title">Telefone</div>
          </div>

          <div class="app-header-right">
            ${
              state.callsTab === "recents"
                ? `
                  <button class="app-header-icon-btn" onclick="window.CallsApp.clearRecents()">
                    <i data-lucide="trash-2"></i>
                  </button>
                `
                : ""
            }
          </div>
        </div>

        <div class="app-content calls-content">
          ${renderContent(state)}
        </div>

        ${renderTabs(state)}
      </div>
    `;
  },
});

function renderContent(state) {
  if (state.incomingCall) {
    return renderIncomingCall(state);
  }

  if (state.callSession) {
    return renderCallSession(state);
  }

  switch (state.callsTab) {
    case "favorites":
      return renderFavorites(state);
    case "contacts":
      return renderContacts(state);
    case "dialer":
      return renderDialer(state);
    default:
      return renderRecents(state);
  }
}

function renderIncomingCall(state) {
  const call = state.incomingCall;
  const displayName = call.name || call.number || "Desconhecido";

  return `
    <div class="call-session-screen">
      <div class="call-session-avatar">
        ${window.Utils.escapeHtml((displayName || "?").charAt(0).toUpperCase())}
      </div>

      <div class="call-session-name">${window.Utils.escapeHtml(displayName)}</div>
      <div class="call-session-number">${window.Utils.escapeHtml(call.number || "")}</div>
      <div class="call-session-status">Chamada recebida</div>

      <div class="call-session-actions">
        <button class="call-session-btn decline" onclick="window.CallsApp.declineIncomingCall()">
          <i data-lucide="phone-off"></i>
        </button>

        <button class="call-session-btn accept" onclick="window.CallsApp.acceptIncomingCall()">
          <i data-lucide="phone"></i>
        </button>
      </div>
    </div>
  `;
}

function renderTabs(state) {
  return `
    <div class="calls-tabs">
      ${renderTab("favorites", "star", "Favoritos", state)}
      ${renderTab("recents", "clock-3", "Recentes", state)}
      ${renderTab("contacts", "users", "Contatos", state)}
      ${renderTab("dialer", "phone", "Teclado", state)}
    </div>
  `;
}

function renderTab(id, icon, label, state) {
  return `
    <button class="calls-tab ${state.callsTab === id ? "is-active" : ""}" onclick="window.CallsApp.setTab('${id}')">
      <i data-lucide="${icon}"></i>
      <span>${label}</span>
    </button>
  `;
}

function resolveContactByNumber(state, number) {
  const contacts = state.contacts || [];
  return contacts.find((c) => String(c.number || "") === String(number || ""));
}

function resolveCallDisplayName(state, call) {
  const contact = resolveContactByNumber(state, call.number);
  return contact?.name || call.number || "Desconhecido";
}

function getContactAvatarHtml(contact, fallbackText) {
  const first =
    String(fallbackText || "?")
      .trim()
      .charAt(0)
      .toUpperCase() || "?";

  if (contact?.avatar) {
    return `<img class="calls-avatar is-image" src="${window.Utils.escapeHtmlAttr(contact.avatar)}" alt="Avatar" />`;
  }

  return `<div class="calls-avatar">${window.Utils.escapeHtml(first)}</div>`;
}

function formatCallTime(timestamp, createdAt) {
  if (timestamp) {
    return window.Utils.formatTime(timestamp);
  }

  if (createdAt) {
    return window.Utils.formatTime(createdAt);
  }

  return "--:--";
}

function formatCallSubtitle(call) {
  const duration = Number(call.duration || 0);

  if (call.status === "unanswered") {
    return "Nao atendida";
  }

  if (call.status === "failed") {
    return "Falhou";
  }

  if (call.status === "declined") {
    return "Recusada";
  }

  if (call.direction === "missed") {
    return "Não atendida";
  }

  if (duration > 0) {
    const mm = String(Math.floor(duration / 60)).padStart(2, "0");
    const ss = String(duration % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  if (call.direction === "incoming") {
    return "Recebida";
  }

  return "Efetuada";
}

function getCallDirectionIcon(direction) {
  if (direction === "missed") return "phone-missed";
  if (direction === "incoming") return "phone-incoming";
  return "phone-outgoing";
}

function renderRecents(state) {
  const calls = state.calls || [];

  if (!calls.length) {
    return `<div class="empty-state">Sem chamadas.</div>`;
  }

  return `
    <div class="calls-list">
      ${calls
        .map((call) => {
          const contact = resolveContactByNumber(state, call.number);
          const title = resolveCallDisplayName(state, call);
          const subtitle = formatCallSubtitle(call);
          const time = formatCallTime(call.timestamp, call.created_at);
          const rowClass =
            call.direction === "missed" || call.status === "unanswered"
              ? "is-missed"
              : "";

          return `
            <button class="call-row ${rowClass}" onclick="window.CallsApp.callNumber('${window.Utils.escapeHtmlAttr(call.number || "")}')">
              <div class="call-row-left">
                ${getContactAvatarHtml(contact, title)}

                <div class="call-row-body">
                  <div class="call-row-title">${window.Utils.escapeHtml(title)}</div>
                  <div class="call-row-subtitle">
                    <i data-lucide="${getCallDirectionIcon(call.direction)}"></i>
                    <span>${window.Utils.escapeHtml(subtitle)}</span>
                  </div>
                </div>
              </div>

              <div class="call-row-right">
                <div class="call-row-time">${window.Utils.escapeHtml(time)}</div>
                <div class="call-row-call">
                  <i data-lucide="phone"></i>
                </div>
              </div>
            </button>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderFavorites(state) {
  const contacts = (state.contacts || []).filter((c) => !!c.favorite);

  if (!contacts.length) {
    return `<div class="empty-state">Sem favoritos.</div>`;
  }

  return `
    <div class="calls-list">
      ${contacts
        .map(
          (contact) => `
            <button class="calls-contact-row" onclick="window.CallsApp.callContact('${contact.id}')">
              <div class="calls-contact-left">
                ${getContactAvatarHtml(contact, contact.name)}

                <div class="calls-contact-texts">
                  <div class="calls-contact-name">${window.Utils.escapeHtml(contact.name || "Sem nome")}</div>
                  <div class="calls-contact-number">${window.Utils.escapeHtml(contact.number || "")}</div>
                </div>
              </div>

              <div class="calls-contact-actions">
                <div class="calls-contact-star">
                  <i data-lucide="star" fill="currentColor"></i>
                </div>

                <div class="calls-contact-call">
                  <i data-lucide="phone"></i>
                </div>
              </div>
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderContacts(state) {
  const contacts = state.contacts || [];

  if (!contacts.length) {
    return `<div class="empty-state">Sem contatos.</div>`;
  }

  return `
    <div class="calls-list">
      ${contacts
        .map(
          (contact) => `
            <button class="calls-contact-row" onclick="window.CallsApp.callContact('${contact.id}')">
              <div class="calls-contact-left">
                ${getContactAvatarHtml(contact, contact.name)}

                <div class="calls-contact-texts">
                  <div class="calls-contact-name">${window.Utils.escapeHtml(contact.name || "Sem nome")}</div>
                  <div class="calls-contact-number">${window.Utils.escapeHtml(contact.number || "")}</div>
                </div>
              </div>

              <div class="calls-contact-actions">
                ${
                  contact.favorite
                    ? `
                      <div class="calls-contact-star">
                        <i data-lucide="star" fill="currentColor"></i>
                      </div>
                    `
                    : ""
                }

                <div class="calls-contact-call">
                  <i data-lucide="phone"></i>
                </div>
              </div>
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderCallSession(state) {
  const session = state.callSession;
  const displayName = session.name || session.number || "Desconhecido";

  return `
    <div class="call-session-screen">
      <div class="call-session-avatar">
        ${window.Utils.escapeHtml((displayName || "?").charAt(0).toUpperCase())}
      </div>

      <div class="call-session-name">${window.Utils.escapeHtml(displayName)}</div>
      <div class="call-session-number">${window.Utils.escapeHtml(session.number || "")}</div>
      <div class="call-session-status">${window.Utils.escapeHtml(getCallSessionStatusLabel(session))}</div>

      <div class="call-session-actions">
        <button class="call-session-btn muted" onclick="window.CallsApp.fakeMute()">
          <i data-lucide="mic-off"></i>
        </button>

        <button class="call-session-btn muted" onclick="window.CallsApp.fakeSpeaker()">
          <i data-lucide="volume-2"></i>
        </button>

        <button class="call-session-btn end" onclick="window.CallsApp.endCall()">
          <i data-lucide="phone-off"></i>
        </button>
      </div>
    </div>
  `;
}

function getCallSessionStatusLabel(session) {
  if (!session) return "";

  if (session.state === "dialing") {
    return "Ligando...";
  }

  if (session.state === "active") {
    return formatLiveDuration(session.duration || 0);
  }

  if (session.state === "ended") {
    return "Encerrada";
  }

  return "";
}

function formatLiveDuration(seconds) {
  const total = Number(seconds || 0);
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function renderDialer(state) {
  const value = state.dialerValue || "";
  const digits = [
    { value: "1", sub: "" },
    { value: "2", sub: "ABC" },
    { value: "3", sub: "DEF" },
    { value: "4", sub: "GHI" },
    { value: "5", sub: "JKL" },
    { value: "6", sub: "MNO" },
    { value: "7", sub: "PQRS" },
    { value: "8", sub: "TUV" },
    { value: "9", sub: "WXYZ" },
    { value: "*", sub: "" },
    { value: "0", sub: "+" },
    { value: "#", sub: "" },
  ];

  return `
    <div class="dialer-wrap">
      <div class="dialer-display">${window.Utils.escapeHtml(value || "Digite o número")}</div>

      <div class="dialer-grid">
        ${digits
          .map(
            (digit) => `
              <button class="dialer-key" onclick="window.CallsApp.addDigit('${digit.value}')">
                <span class="dialer-key-main">${window.Utils.escapeHtml(digit.value)}</span>
                <span class="dialer-key-sub">${window.Utils.escapeHtml(digit.sub)}</span>
              </button>
            `,
          )
          .join("")}
      </div>

      <div class="dialer-actions">
        <button class="dialer-call-btn" onclick="window.CallsApp.callDialer()">
          <i data-lucide="phone"></i>
        </button>

        <button class="dialer-delete-btn" onclick="window.CallsApp.removeDigit()">
          <i data-lucide="delete"></i>
        </button>
      </div>
    </div>
  `;
}

window.CallsApp = {
  _durationInterval: null,

  RINGTONE_URL:
    "https://fivem.mazinho.org/mz_phone_server/audio/phone/ringtone-default.mp3",

  async startCallFromApp(number, name = null, contactId = null) {
    const clean = String(number || "").trim();
    if (!clean) return;

    window.PhoneApp.patchState({
      currentApp: "calls",
      callsTab: "recents",
      incomingCall: null,
      callSession: null,
    });

    window.PhoneApp.renderCurrentApp();

    if (window.PhoneAPI?.callUser) {
      await window.PhoneAPI.callUser(clean);
    }
  },

  goHome() {
    window.PhoneApp.goHome();
  },

  setTab(tab) {
    window.PhoneApp.patchState({ callsTab: tab });
    window.PhoneApp.renderCurrentApp();
  },

  addDigit(digit) {
    const state = window.PhoneApp.getState();

    window.PhoneApp.patchState({
      dialerValue: `${state.dialerValue || ""}${digit}`,
    });

    window.PhoneApp.renderCurrentApp();
  },

  removeDigit() {
    const state = window.PhoneApp.getState();
    const current = String(state.dialerValue || "");

    window.PhoneApp.patchState({
      dialerValue: current.slice(0, -1),
    });

    window.PhoneApp.renderCurrentApp();
  },

  async callDialer() {
    const state = window.PhoneApp.getState();
    const number = String(state.dialerValue || "").trim();
    if (!number) return;

    window.PhoneApp.patchState({
      dialerValue: "",
    });

    window.PhoneApp.renderCurrentApp();

    if (window.PhoneAPI?.callUser) {
      await window.PhoneAPI.callUser(number);
    }
  },

  async callContact(contactId) {
    const state = window.PhoneApp.getState();
    const contact = (state.contacts || []).find(
      (c) => String(c.id) === String(contactId),
    );
    if (!contact || !contact.number) return;

    if (window.PhoneAPI?.callUser) {
      await window.PhoneAPI.callUser(contact.number);
    }
  },

  async callNumber(number) {
    const clean = String(number || "").trim();
    if (!clean) return;

    if (window.PhoneAPI?.callUser) {
      await window.PhoneAPI.callUser(clean);
    }
  },

  startFakeCallFlow(number, name, contactId = null) {
    window.PhoneUI?.notify?.({
      type: "call",
      title: "Ligação",
      message: `Ligando para ${name || number}`,
    });

    const willBeMissed = Math.random() < 0.35;

    setTimeout(async () => {
      const state = window.PhoneApp.getState();

      if (!state.callSession || state.callSession.number !== number) {
        return;
      }

      if (willBeMissed) {
        if (window.PhoneAPI?.createCall) {
          await window.PhoneAPI.createCall({
            number,
            contact_id: contactId,
            direction: "missed",
            duration: 0,
            timestamp: Date.now(),
          });
        }

        if (window.PhoneAPI?.getCalls) {
          await window.PhoneAPI.getCalls();
        }

        window.PhoneApp.patchState({
          callSession: null,
          callsTab: "recents",
        });

        window.PhoneApp.renderCurrentApp();

        window.PhoneUI?.notify?.({
          type: "warning",
          title: "Ligação",
          message: `Chamada não atendida por ${name || number}`,
        });

        return;
      }

      window.PhoneApp.patchState({
        callSession: {
          ...state.callSession,
          state: "active",
          startedAt: Date.now(),
          duration: 0,
          contact_id: contactId,
        },
      });

      window.PhoneApp.renderCurrentApp();
      this.startDurationTicker();
    }, 1800);
  },

  startDurationTicker() {
    if (this._durationInterval) {
      clearInterval(this._durationInterval);
    }

    this._durationInterval = setInterval(() => {
      const state = window.PhoneApp.getState();
      const session = state.callSession;

      if (!session || session.state !== "active" || !session.startedAt) {
        clearInterval(this._durationInterval);
        this._durationInterval = null;
        return;
      }

      const duration = Math.floor((Date.now() - session.startedAt) / 1000);

      window.PhoneApp.patchState({
        callSession: {
          ...session,
          duration,
        },
      });

      window.PhoneApp.renderCurrentApp();
    }, 1000);
  },

  simulateIncomingCall(number, name = null, contactId = null) {
    if (this._durationInterval) {
      clearInterval(this._durationInterval);
      this._durationInterval = null;
    }

    window.PhoneAudio?.play("ringtone", this.RINGTONE_URL, {
      loop: true,
      volume: 1,
    });

    window.PhoneApp.patchState({
      incomingCall: {
        number,
        name: name || number,
        contact_id: contactId,
        timestamp: Date.now(),
      },
      callSession: null,
    });

    window.PhoneApp.renderCurrentApp();

    window.PhoneUI?.notify?.({
      type: "call",
      title: "Ligação recebida",
      message: `${name || number} está ligando`,
    });
  },

  async acceptIncomingCall() {
    window.PhoneAudio?.stop("ringtone");

    const state = window.PhoneApp.getState();
    const incoming = state.incomingCall;
    if (!incoming?.callId) return;

    if (window.PhoneAPI?.acceptCall) {
      await window.PhoneAPI.acceptCall(incoming.callId);
    }
  },

  async declineIncomingCall() {
    window.PhoneAudio?.stop("ringtone");

    const state = window.PhoneApp.getState();
    const incoming = state.incomingCall;
    if (!incoming?.callId) return;

    if (window.PhoneAPI?.declineCall) {
      await window.PhoneAPI.declineCall(incoming.callId);
    }
  },

  async endCall() {
    window.PhoneAudio?.stop("ringtone");

    const state = window.PhoneApp.getState();
    const session = state.callSession;
    if (!session?.callId) return;

    if (this._durationInterval) {
      clearInterval(this._durationInterval);
      this._durationInterval = null;
    }

    if (window.PhoneAPI?.endVoiceCall) {
      await window.PhoneAPI.endVoiceCall(session.callId);
    }
  },

  async clearRecents() {
    if (window.PhoneAPI?.clearCalls) {
      await window.PhoneAPI.clearCalls();
    }

    if (window.PhoneAPI?.getCalls) {
      await window.PhoneAPI.getCalls();
    }
  },

  fakeMute() {
    window.PhoneUI?.notify?.({
      type: "info",
      title: "Ligação",
      message: "Função de mute vem depois.",
    });
  },

  fakeSpeaker() {
    window.PhoneUI?.notify?.({
      type: "info",
      title: "Ligação",
      message: "Função de viva-voz vem depois.",
    });
  },
};
