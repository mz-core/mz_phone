registerApp({
  id: "messages",
  name: "Mensagens",
  icon: "message-circle",
  order: 4,

  onOpen(ctx) {
    const state = ctx.getState();

    ctx.patchState({
      messagesSearch: "",
      selectedConversationId: state.pendingOpenConversationNumber
        ? null
        : state.selectedConversationId,
      messageDraft: "",
      messagesPickingContact: false,
      messagesActionModal: false,
      messagesMediaDraft: "",
    });

    if (window.PhoneAPI?.getConversations) {
      window.PhoneAPI.getConversations();
    }
  },

  render(ctx) {
    const state = ctx.getState();

    if (state.messagesPickingContact) {
      return renderPickContact(ctx, state);
    }

    if (!state.selectedConversationId) {
      return renderList(ctx, state);
    }

    return renderChat(ctx, state);
  },
});

function getConversationMessages(state, conversationId) {
  return (state.messages && state.messages[conversationId]) || [];
}

function getLastMessagePreview(state, conversationId) {
  const messages = getConversationMessages(state, conversationId);
  if (!messages.length) return "Toque para abrir a conversa";

  const last = messages[messages.length - 1];
  const text = String(last.message || "").trim();

  if (last.message_type === "image") return "📷 Foto";
  if (last.message_type === "location") return "📍 Localização";
  if (last.message_type === "url") return "🔗 Link";
  if (last.message_type && last.message_type !== "text") return "Mídia enviada";

  return text || "Mensagem";
}

function getLastMessageTime(state, conversationId, fallback) {
  const messages = getConversationMessages(state, conversationId);
  if (!messages.length) {
    return fallback ? window.Utils.formatTime(fallback) : "--:--";
  }

  const last = messages[messages.length - 1];
  return window.Utils.formatTime(last.created_at || fallback);
}

function getAvatarData(name, avatar) {
  if (avatar) {
    return {
      type: "image",
      value: avatar,
    };
  }

  const fallback =
    String(name || "?")
      .trim()
      .charAt(0)
      .toUpperCase() || "?";

  return {
    type: "letter",
    value: fallback,
  };
}

function getConversationAvatar(state, conversation) {
  const contacts = state.contacts || [];
  const playerNumber = state.playerProfile?.phoneNumber || "";
  const profilePhoto = state.profilePhoto || "";

  const matchedContact = contacts.find(
    (c) => String(c.number || "") === String(conversation.target_number || ""),
  );

  if (matchedContact?.avatar) {
    return getAvatarData(matchedContact.name, matchedContact.avatar);
  }

  if (
    playerNumber &&
    String(conversation.target_number || "") === String(playerNumber) &&
    profilePhoto
  ) {
    return getAvatarData(conversation.display_name || conversation.target_name, profilePhoto);
  }

  return getAvatarData(
    conversation.display_name || conversation.target_name || conversation.target_number,
    "",
  );
}

function getConversationDisplayName(conversation) {
  return (
    conversation?.display_name ||
    conversation?.displayName ||
    conversation?.target_name ||
    conversation?.target_number ||
    "Sem conversa"
  );
}

function renderAvatar(avatar, className = "msg-avatar") {
  if (avatar.type === "image") {
    return `<img class="${className} is-image" src="${window.Utils.escapeHtmlAttr(avatar.value)}" alt="Avatar" />`;
  }

  return `<div class="${className}">${window.Utils.escapeHtml(avatar.value)}</div>`;
}

function renderPickContact(ctx, state) {
  const contacts = state.contacts || [];

  return `
    <div class="app-page">
      <div class="app-header app-header--standard">
        <div class="app-header-left">
          <button class="app-header-icon-btn" onclick="window.MessagesApp.cancelPick()">
            <i data-lucide="arrow-left"></i>
          </button>
        </div>

        <div class="app-header-center">
          <div class="app-title">Novo chat</div>
        </div>

        <div class="app-header-right"></div>
      </div>

      <div class="app-content">
        ${
          contacts.length === 0
            ? `<div class="empty-state">Nenhum contato salvo.</div>`
            : contacts
                .map((c) => {
                  const avatar = getAvatarData(c.name, c.avatar);

                  return `
                    <div class="msg-item" onclick="window.MessagesApp.startConversation('${c.id}')">
                      ${renderAvatar(avatar, "msg-avatar")}
                      <div class="msg-info">
                        <div class="msg-name">${window.Utils.escapeHtml(c.name || "Sem nome")}</div>
                        <div class="msg-last">${window.Utils.escapeHtml(c.number || "")}</div>
                      </div>
                    </div>
                  `;
                })
                .join("")
        }
      </div>
    </div>
  `;
}

function renderList(ctx, state) {
  const conversations = state.conversations || [];
  const search = String(state.messagesSearch || "")
    .toLowerCase()
    .trim();

  const filtered = conversations.filter((conv) => {
    const name = String(getConversationDisplayName(conv)).toLowerCase();
    const number = String(conv.target_number || "").toLowerCase();
    const preview = getLastMessagePreview(state, conv.id).toLowerCase();

    return (
      !search ||
      name.includes(search) ||
      number.includes(search) ||
      preview.includes(search)
    );
  });

  return `
    <div class="app-page">
      <div class="app-header app-header--standard">
        <div class="app-header-left"></div>

        <div class="app-header-center">
          <div class="app-title">Mensagens</div>
        </div>

        <div class="app-header-right">
          <button
            class="app-header-icon-btn"
            onclick="window.MessagesApp.openContacts()"
          >
            <i data-lucide="plus"></i>
          </button>
        </div>
      </div>

      <div class="app-content">
        <input
          class="app-input"
          placeholder="Pesquisar"
          value="${window.Utils.escapeHtmlAttr(state.messagesSearch || "")}"
          oninput="window.MessagesApp.search(this.value)"
        />

        ${
          filtered.length === 0
            ? `<div class="empty-state">Nenhuma conversa encontrada.</div>`
            : filtered
                .map((conv) => renderConversationItem(state, conv))
                .join("")
        }
      </div>
    </div>
  `;
}

function renderConversationItem(state, conv) {
  const unread = conv.unread_count || 0;
  const preview = getLastMessagePreview(state, conv.id);
  const time = getLastMessageTime(state, conv.id, conv.updated_at);
  const avatar = getConversationAvatar(state, conv);

  return `
    <div class="msg-item" onclick="window.MessagesApp.open('${conv.id}')">
      <div class="msg-avatar-wrap">
        ${renderAvatar(avatar, "msg-avatar")}
        ${unread > 0 ? `<span class="msg-badge">${unread}</span>` : ""}
      </div>

      <div class="msg-info">
        <div class="msg-name">${window.Utils.escapeHtml(getConversationDisplayName(conv))}</div>
        <div class="msg-last">${window.Utils.escapeHtml(preview)}</div>
      </div>

      <div class="msg-time">${window.Utils.escapeHtml(time || "--:--")}</div>
    </div>
  `;
}

function renderChat(ctx, state) {
  const id = state.selectedConversationId;
  const messages = getConversationMessages(state, id);
  const conversation = (state.conversations || []).find(
    (item) => String(item.id) === String(id),
  );
  const avatar = conversation
    ? getConversationAvatar(state, conversation)
    : null;
  const modal = state.messagesActionModal || false;
  const mediaDraft = state.messagesMediaDraft || "";

  return `
    <div class="app-page">
      <div class="app-header app-header--standard">
        <div class="app-header-left">
          <button class="app-header-icon-btn" onclick="window.MessagesApp.back()">
            <i data-lucide="arrow-left"></i>
          </button>
        </div>

        <div class="app-header-center">
          <div class="msg-header-user">
            ${avatar ? renderAvatar(avatar, "msg-header-avatar") : ""}
          <div class="app-title">${window.Utils.escapeHtml(getConversationDisplayName(conversation) || "Conversa")}</div>
          </div>
        </div>

        <div class="app-header-right">
          <div class="msg-actions">
            <button class="msg-action-btn" onclick="window.MessagesApp.fakeCall()">
              <i data-lucide="phone"></i>
            </button>
            <button class="msg-action-btn" onclick="window.MessagesApp.fakeVideoCall()">
              <i data-lucide="video"></i>
            </button>
          </div>
        </div>
      </div>

      <div class="msg-chat">
        ${
          messages.length === 0
            ? `<div class="empty-state">Nenhuma mensagem ainda.</div>`
            : messages.map(renderMessage).join("")
        }
      </div>

      <div class="msg-input">

        <button class="msg-btn emoji" onclick="window.MessagesApp.toggleEmoji()">
          😊
        </button>

        <div class="msg-input-field">
          <input
            placeholder="Mensagem"
            value="${window.Utils.escapeHtmlAttr(state.messageDraft || "")}"
            oninput="window.MessagesApp.setDraft(this.value)"
          />
        </div>

        <button class="msg-btn plus" onclick="window.MessagesApp.toggleActions()">
          <i data-lucide="plus"></i>
        </button>

        <button class="msg-btn send" onclick="window.MessagesApp.send()">
          <i data-lucide="send"></i>
        </button>

      </div>

      ${
        state.messagesEmojiOpen
          ? `
      <div class="msg-emoji-picker">
        ${["😀", "😂", "😍", "😎", "👍", "❤️", "🔥", "😭", "👀", "🙏"]
          .map(
            (e) =>
              `<span onclick="window.MessagesApp.addEmoji('${e}')">${e}</span>`,
          )
          .join("")}
      </div>
    `
          : ""
      }

      ${
        modal === "menu"
          ? `
            <div class="msg-modal-backdrop" onclick="window.MessagesApp.closeActions()">
              <div class="msg-modal" onclick="event.stopPropagation()">
                <div class="msg-modal-title">Enviar</div>

                <button class="msg-modal-option" onclick="window.MessagesApp.sendFakeMedia('camera')">
                  <i data-lucide="camera"></i>
                  <span>Câmera</span>
                </button>

                <button class="msg-modal-option" onclick="window.MessagesApp.sendFakeMedia('gallery')">
                  <i data-lucide="images"></i>
                  <span>Galeria</span>
                </button>

                <button class="msg-modal-option" onclick="window.MessagesApp.openMediaInput('url')">
                  <i data-lucide="link"></i>
                  <span>URL</span>
                </button>

                <button class="msg-modal-option" onclick="window.MessagesApp.sendFakeMedia('location')">
                  <i data-lucide="map-pinned"></i>
                  <span>Localização</span>
                </button>

                <button class="msg-modal-cancel" onclick="window.MessagesApp.closeActions()">
                  Cancelar
                </button>
              </div>
            </div>
          `
          : ""
      }

      ${
        modal === "url"
          ? `
            <div class="msg-modal-backdrop" onclick="window.MessagesApp.closeActions()">
              <div class="msg-modal" onclick="event.stopPropagation()">
                <div class="msg-modal-title">Enviar link</div>

                <input
                  class="msg-modal-input"
                  type="text"
                  placeholder="https://..."
                  value="${window.Utils.escapeHtmlAttr(mediaDraft)}"
                  oninput="window.MessagesApp.setMediaDraft(this.value)"
                />

                <button class="msg-modal-option primary" onclick="window.MessagesApp.confirmUrl()">
                  <i data-lucide="check"></i>
                  <span>Enviar</span>
                </button>

                <button class="msg-modal-cancel" onclick="window.MessagesApp.closeActions()">
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

function renderMessage(msg) {
  const isMe = msg.sender === "me";
  const type = msg.message_type || "text";

  let contentHtml = `<div class="msg-bubble-text">${window.Utils.escapeHtml(msg.message || "")}</div>`;

  if (type === "image") {
    if (msg.media_url) {
      contentHtml = `
        <div class="msg-media-card">
          <img class="msg-media-image" src="${window.Utils.escapeHtmlAttr(msg.media_url)}" alt="Imagem" />
          <div class="msg-media-label">${window.Utils.escapeHtml(msg.message || "Imagem")}</div>
        </div>
      `;
    } else {
      contentHtml = `
        <div class="msg-media-placeholder">
          <i data-lucide="image"></i>
          <span>${window.Utils.escapeHtml(msg.message || "Foto")}</span>
        </div>
      `;
    }
  }

  if (type === "location") {
    contentHtml = `
      <div class="msg-media-placeholder">
        <i data-lucide="map-pinned"></i>
        <span>${window.Utils.escapeHtml(msg.message || "Localização")}</span>
      </div>
    `;
  }

  if (type === "url") {
    contentHtml = `
      <div class="msg-media-placeholder">
        <i data-lucide="link"></i>
        <span>${window.Utils.escapeHtml(msg.message || "Link")}</span>
      </div>
    `;
  }

  return `
    <div class="msg-bubble ${isMe ? "me" : "other"}">
      ${contentHtml}
      <span class="msg-time">${window.Utils.escapeHtml(window.Utils.formatTime(msg.created_at))}</span>
    </div>
  `;
}

window.MessagesApp = {
  async open(id) {
    window.PhoneApp.patchState({
      selectedConversationId: id,
      messagesActionModal: false,
      messagesMediaDraft: "",
    });

    if (window.PhoneAPI?.getConversationMessages) {
      await window.PhoneAPI.getConversationMessages(id);
    }

    if (window.PhoneAPI?.markConversationRead) {
      await window.PhoneAPI.markConversationRead(id);
    }

    window.PhoneApp.renderCurrentApp();

    setTimeout(() => {
      const chat = document.querySelector(".msg-chat");
      if (chat) {
        chat.scrollTop = chat.scrollHeight;
      }
    }, 0);
  },

  back() {
    window.PhoneApp.patchState({
      selectedConversationId: null,
      messageDraft: "",
      messagesActionModal: false,
      messagesMediaDraft: "",
    });

    window.PhoneApp.renderCurrentApp();
  },

  async send() {
    const state = window.PhoneApp.getState();
    const text = String(state.messageDraft || "").trim();
    if (!text) return;

    if (window.PhoneAPI?.sendMessage) {
      await window.PhoneAPI.sendMessage({
        conversationId: state.selectedConversationId,
        message: text,
        sender: "me",
        message_type: "text",
      });
    }

    window.PhoneApp.patchState({
      messageDraft: "",
    });

    setTimeout(() => {
      const chat = document.querySelector(".msg-chat");
      if (chat) {
        chat.scrollTop = chat.scrollHeight;
      }
    }, 0);
  },

  setDraft(value) {
    window.PhoneApp.patchState({
      messageDraft: value,
    });
  },

  setMediaDraft(value) {
    window.PhoneApp.patchState({
      messagesMediaDraft: value,
    });
  },

  search(value) {
    window.PhoneApp.patchState({
      messagesSearch: value,
    });

    window.PhoneApp.renderCurrentApp();

    setTimeout(() => {
      const input = document.querySelector(".app-input");
      if (!input) return;
      input.focus();
      input.setSelectionRange(value.length, value.length);
    }, 0);
  },

  toggleActions() {
    const state = window.PhoneApp.getState();

    window.PhoneApp.patchState({
      messagesActionModal:
        state.messagesActionModal === "menu" ? false : "menu",
      messagesMediaDraft: "",
    });

    window.PhoneApp.renderCurrentApp();
  },

  openMediaInput(kind) {
    window.PhoneApp.patchState({
      messagesActionModal: kind,
      messagesMediaDraft: "",
    });

    window.PhoneApp.renderCurrentApp();

    setTimeout(() => {
      const input = document.querySelector(".msg-modal-input");
      if (input) input.focus();
    }, 0);
  },

  closeActions() {
    window.PhoneApp.patchState({
      messagesActionModal: false,
      messagesMediaDraft: "",
    });

    window.PhoneApp.renderCurrentApp();
  },

  async sendFakeMedia(kind) {
    const state = window.PhoneApp.getState();
    if (!state.selectedConversationId) return;

    const map = {
      camera: {
        message: "Foto tirada",
        message_type: "image",
        media_url: "https://picsum.photos/320/220?random=11",
      },
      gallery: {
        message: "Foto da galeria",
        message_type: "image",
        media_url: "https://picsum.photos/320/220?random=12",
      },
      location: {
        message: "Localização compartilhada",
        message_type: "location",
        media_url: "",
      },
    };

    const payload = map[kind];
    if (!payload) return;

    if (window.PhoneAPI?.sendMessage) {
      await window.PhoneAPI.sendMessage({
        conversationId: state.selectedConversationId,
        sender: "me",
        message: payload.message,
        message_type: payload.message_type,
        media_url: payload.media_url,
      });
    }

    window.PhoneApp.patchState({
      messagesActionModal: false,
      messagesMediaDraft: "",
    });
  },

  async confirmUrl() {
    const state = window.PhoneApp.getState();
    const url = String(state.messagesMediaDraft || "").trim();
    if (!url || !state.selectedConversationId) return;

    if (window.PhoneAPI?.sendMessage) {
      await window.PhoneAPI.sendMessage({
        conversationId: state.selectedConversationId,
        sender: "me",
        message: url,
        message_type: "url",
        media_url: url,
      });
    }

    window.PhoneApp.patchState({
      messagesActionModal: false,
      messagesMediaDraft: "",
    });
  },

  openContacts() {
    window.PhoneApp.patchState({
      messagesPickingContact: true,
      selectedConversationId: null,
      messagesActionModal: false,
      messagesMediaDraft: "",
    });

    window.PhoneApp.renderCurrentApp();
  },

  async startConversation(contactId) {
    const state = window.PhoneApp.getState();
    const contact = (state.contacts || []).find(
      (c) => String(c.id) === String(contactId),
    );
    if (!contact) return;

    const myNumber = String(state.playerProfile?.phoneNumber || "");
    const targetNumber = String(contact.number || "");

    if (myNumber && targetNumber && myNumber === targetNumber) {
      if (window.PhoneUI?.notify) {
        window.PhoneUI.notify({
          type: "warning",
          title: "Mensagens",
          message: "Você não pode iniciar conversa com seu próprio número.",
        });
      }
      return;
    }

    if (window.PhoneAPI?.createConversation) {
      await window.PhoneAPI.createConversation({
        target_number: contact.number,
        target_name: contact.name,
      });
    }

    window.PhoneApp.patchState({
      messagesPickingContact: false,
      selectedConversationId: null,
    });

    if (window.PhoneAPI?.getConversations) {
      await window.PhoneAPI.getConversations();
    }
  },

  cancelPick() {
    window.PhoneApp.patchState({
      messagesPickingContact: false,
    });

    window.PhoneApp.renderCurrentApp();
  },

  toggleEmoji() {
    const state = window.PhoneApp.getState();

    window.PhoneApp.patchState({
      messagesEmojiOpen: !state.messagesEmojiOpen,
      messagesActionModal: false,
    });

    window.PhoneApp.renderCurrentApp();
  },

  addEmoji(emoji) {
    const state = window.PhoneApp.getState();

    window.PhoneApp.patchState({
      messageDraft: (state.messageDraft || "") + emoji,
    });

    window.PhoneApp.renderCurrentApp();

    setTimeout(() => {
      const input = document.querySelector(".msg-input input");
      if (!input) return;

      const value = input.value || "";
      input.focus();
      input.setSelectionRange(value.length, value.length);
    }, 0);
  },

  async fakeCall() {
    const state = window.PhoneApp.getState();
    const conversation = (state.conversations || []).find(
      (item) => String(item.id) === String(state.selectedConversationId),
    );

    const number = conversation?.target_number || "";
    const name = getConversationDisplayName(conversation) || number || "Contato";

    if (!number) return;

    if (window.CallsApp?.startCallFromApp) {
      window.CallsApp.startCallFromApp(
        number,
        name,
        conversation?.contact_id || null,
      );
    }
  },

  fakeVideoCall() {
    if (window.PhoneUI?.notify) {
      window.PhoneUI.notify({
        type: "info",
        title: "Chamada de vídeo",
        message: "Essa opção ficará disponível depois.",
      });
    }
  },
};
