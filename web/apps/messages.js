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
      messagesMediaPreview: state.messagesMediaPreview || null,
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

function parseMessageMetadata(msg) {
  const metadata = msg?.metadata;
  if (!metadata) return {};
  if (typeof metadata === "object") return metadata;
  if (typeof metadata !== "string") return {};

  try {
    const parsed = JSON.parse(metadata);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function getLastMessagePreview(state, conversationId, conversation = null) {
  const messages = getConversationMessages(state, conversationId);
  const last = messages[messages.length - 1] || {
    message: conversation?.last_message || "",
    message_type: conversation?.last_message_type || "",
  };
  if (!last.message && !last.message_type) return "Toque para abrir a conversa";

  const text = String(last.message || "").trim();
  if (last.message_type === "image") return "\u{1F4F7} Foto";
  if (last.message_type === "location") return "\u{1F4CD} Localizacao";
  if (last.message_type === "url") return "\u{1F517} Link";
  if (last.message_type && last.message_type !== "text") return "Midia enviada";

  return text || "Mensagem";
}

function renderList(ctx, state) {
  const conversations = state.conversations || [];
  const search = String(state.messagesSearch || "")
    .toLowerCase()
    .trim();

  const filtered = conversations.filter((conv) => {
    const name = String(getConversationDisplayName(conv)).toLowerCase();
    const number = String(conv.target_number || "").toLowerCase();
    const preview = getLastMessagePreview(state, conv.id, conv).toLowerCase();

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
  const preview = getLastMessagePreview(state, conv.id, conv);
  const time = getLastMessageTime(state, conv.id, conv.last_message_at || conv.updated_at);
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
  const mediaPreview = state.messagesMediaPreview || null;
  const imageViewer = state.messagesImageViewer || null;

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
            <button class="msg-action-btn" onclick="window.MessagesApp.startVoiceCall()">
              <i data-lucide="phone"></i>
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

        ${
          mediaPreview
            ? `
              <div class="msg-media-card">
                <img class="msg-media-image" src="${window.Utils.escapeHtmlAttr(mediaPreview.imageUrl || mediaPreview.url)}" alt="Anexo" />
                <div class="msg-media-label">Imagem anexada</div>
                <button class="msg-media-remove" onclick="window.MessagesApp.clearMediaPreview()" aria-label="Remover imagem">
                  <i data-lucide="x"></i>
                </button>
              </div>
            `
            : ""
        }

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

                <button class="msg-modal-option" onclick="window.MessagesApp.openCameraAttachment()">
                  <i data-lucide="camera"></i>
                  <span>Câmera</span>
                </button>

                <button class="msg-modal-option" onclick="window.MessagesApp.openGalleryAttachment()">
                  <i data-lucide="images"></i>
                  <span>Galeria</span>
                </button>

                <button class="msg-modal-option" onclick="window.MessagesApp.openMediaInput('url')">
                  <i data-lucide="link"></i>
                  <span>URL</span>
                </button>

                <button class="msg-modal-option" onclick="window.MessagesApp.sendLocation()">
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

      ${
        imageViewer
          ? `
            <div class="msg-viewer-backdrop">
              <div class="msg-viewer">
                <button class="msg-viewer-close" onclick="window.MessagesApp.closeImageViewer()" aria-label="Fechar">
                  <i data-lucide="x"></i>
                </button>
                <img class="msg-viewer-image" src="${window.Utils.escapeHtmlAttr(imageViewer.url)}" alt="Imagem" />
                <div class="msg-viewer-caption">${window.Utils.escapeHtml(imageViewer.caption || "Foto")}</div>
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

function renderMessage(msg) {
  const isMe = msg.sender === "me";
  const type = msg.message_type || "text";
  const metadata = parseMessageMetadata(msg);
  const text = String(msg.message || "").trim();
  const time = window.Utils.escapeHtml(window.Utils.formatTime(msg.created_at));

  let contentHtml = `<div class="msg-bubble-text">${window.Utils.escapeHtml(text)}</div>`;

  if (type === "image") {
    const imageUrl = String(msg.media_url || "").trim();
    const encodedImageUrl = encodeURIComponent(imageUrl);
    const encodedCaption = encodeURIComponent(text || "Foto");
    contentHtml = imageUrl
      ? `
        <button class="msg-image-button" onclick="window.MessagesApp.openImageViewer(decodeURIComponent('${encodedImageUrl}'), decodeURIComponent('${encodedCaption}'))">
          <img class="msg-media-image" src="${window.Utils.escapeHtmlAttr(imageUrl)}" alt="Imagem" onerror="this.closest('.msg-image-button')?.classList.add('is-error')" />
          <span class="msg-image-error"><i data-lucide="image-off"></i> Imagem indisponivel</span>
        </button>
        ${text && text !== "Foto" ? `<div class="msg-media-label">${window.Utils.escapeHtml(text)}</div>` : ""}
      `
      : `
        <div class="msg-media-placeholder">
          <i data-lucide="image-off"></i>
          <span>Imagem indisponivel</span>
        </div>
      `;
  } else if (type === "location") {
    const x = Number(metadata.x);
    const y = Number(metadata.y);
    const canMark = Number.isFinite(x) && Number.isFinite(y);
    contentHtml = `
      <button class="msg-location-card" ${canMark ? `onclick="window.MessagesApp.markLocation(${x}, ${y})"` : ""}>
        <span class="msg-location-icon"><i data-lucide="map-pinned"></i></span>
        <span class="msg-location-text">
          <strong>${window.Utils.escapeHtml(text || "Localizacao compartilhada")}</strong>
          <small>${canMark ? "Toque para marcar no GPS" : "Coordenadas indisponiveis"}</small>
        </span>
      </button>
    `;
  } else if (type === "url") {
    const url = String(msg.media_url || text || "").trim();
    contentHtml = `
      <div class="msg-url-card">
        <i data-lucide="link"></i>
        <span>${window.Utils.escapeHtml(url || "Link")}</span>
      </div>
    `;
  }

  return `
    <div class="msg-bubble ${isMe ? "me" : "other"}">
      ${contentHtml}
      <span class="msg-time">${time}</span>
    </div>
  `;
}

window.MessagesApp = {
  async open(id) {
    window.PhoneApp.patchState({
      selectedConversationId: id,
      messagesActionModal: false,
      messagesMediaDraft: "",
      messagesMediaPreview: null,
      messagesImageViewer: null,
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
      messagesMediaPreview: null,
      messagesImageViewer: null,
    });

    window.PhoneApp.renderCurrentApp();
  },

  async send() {
    const state = window.PhoneApp.getState();
    const text = String(state.messageDraft || "").trim();
    const mediaPreview = state.messagesMediaPreview || null;
    const mediaUrl = String(
      mediaPreview?.imageUrl || mediaPreview?.url || "",
    ).trim();
    const photoId = mediaPreview?.id || mediaPreview?.photoId || null;

    if (!text && !mediaUrl) return;

    if (window.PhoneAPI?.sendMessage) {
      await window.PhoneAPI.sendMessage({
        conversationId: state.selectedConversationId,
        message: text || "Foto",
        message_type: mediaUrl ? "image" : "text",
        photoId,
        media_url: photoId ? "" : mediaUrl,
        source: mediaPreview?.source || "",
      });
    }

    window.PhoneApp.patchState({
      messageDraft: "",
      messagesMediaPreview: null,
      messagesActionModal: false,
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

  clearMediaPreview() {
    window.PhoneApp.patchState({
      messagesMediaPreview: null,
    });

    window.PhoneApp.renderCurrentApp();
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

  async sendLocation() {
    const state = window.PhoneApp.getState();
    if (!state.selectedConversationId) return;

    window.PhoneApp.patchState({
      messagesActionModal: false,
      messagesMediaDraft: "",
    });

    if (window.PhoneAPI?.sendMessage) {
      await window.PhoneAPI.sendMessage({
        conversationId: state.selectedConversationId,
        message_type: "location",
        message: "Localizacao compartilhada",
      });
    }

    setTimeout(() => {
      const chat = document.querySelector(".msg-chat");
      if (chat) {
        chat.scrollTop = chat.scrollHeight;
      }
    }, 0);
  },

  openImageViewer(url, caption = "Foto") {
    if (!url) return;

    window.PhoneApp.patchState({
      messagesImageViewer: {
        url,
        caption,
      },
    });

    window.PhoneApp.renderCurrentApp();
  },

  closeImageViewer() {
    window.PhoneApp.patchState({
      messagesImageViewer: null,
    });

    window.PhoneApp.renderCurrentApp();
  },

  async markLocation(x, y) {
    const nx = Number(x);
    const ny = Number(y);
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) return;

    const result = window.PhoneAPI?.setWaypoint
      ? await window.PhoneAPI.setWaypoint({ x: nx, y: ny })
      : { ok: false };

    if (result?.ok === false && window.PhoneUI?.notify) {
      window.PhoneUI.notify({
        type: "error",
        title: "Mensagens",
        message: "Nao foi possivel marcar o GPS.",
      });
    }
  },

  openCameraAttachment() {
    const state = window.PhoneApp.getState();
    if (!state.selectedConversationId) return;

    window.PhoneApp.patchState({
      messagesActionModal: false,
      messagesMediaDraft: "",
    });

    const options = {
      purpose: "message_attachment",
      returnApp: "messages",
      returnState: {
        selectedConversationId: state.selectedConversationId,
        messagesActionModal: false,
        messagesMediaDraft: "",
      },
    };

    if (window.PhoneMedia?.openCameraForResult) {
      window.PhoneMedia.openCameraForResult(options);
    }
  },

  openGalleryAttachment() {
    const state = window.PhoneApp.getState();
    if (!state.selectedConversationId) return;

    window.PhoneApp.patchState({
      messagesActionModal: false,
      messagesMediaDraft: "",
    });

    const options = {
      purpose: "message_attachment",
      returnApp: "messages",
      returnState: {
        selectedConversationId: state.selectedConversationId,
        messagesActionModal: false,
        messagesMediaDraft: "",
      },
    };

    if (window.PhoneMedia?.openGalleryForResult) {
      window.PhoneMedia.openGalleryForResult(options);
    }
  },

  applyMediaResult(media, request) {
    const imageUrl = String(media?.imageUrl || media?.url || "").trim();
    if (!imageUrl || request?.purpose !== "message_attachment") return false;

    window.PhoneApp.patchState({
      selectedConversationId:
        request?.returnState?.selectedConversationId ||
        window.PhoneApp.getState().selectedConversationId,
      messagesActionModal: false,
      messagesMediaDraft: "",
      messagesMediaPreview: {
        ...media,
        photoId: media?.id || media?.photoId || null,
        imageUrl,
      },
    });

    window.PhoneApp.renderCurrentApp();
    return true;
  },

  async legacyMediaDisabled(kind) {
    const state = window.PhoneApp.getState();
    if (!state.selectedConversationId) return;

    const map = {
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
        message: payload.message,
        message_type: payload.message_type,
        media_url: payload.media_url,
      });
    }

    window.PhoneApp.patchState({
      messagesActionModal: false,
      messagesMediaDraft: "",
      messagesMediaPreview: null,
    });
  },

  async confirmUrl() {
    const state = window.PhoneApp.getState();
    const url = String(state.messagesMediaDraft || "").trim();
    if (!url || !state.selectedConversationId) return;

    if (window.PhoneAPI?.sendMessage) {
      await window.PhoneAPI.sendMessage({
        conversationId: state.selectedConversationId,
        message: url,
        message_type: "url",
        media_url: url,
      });
    }

    window.PhoneApp.patchState({
      messagesActionModal: false,
      messagesMediaDraft: "",
      messagesMediaPreview: null,
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

  async startVoiceCall() {
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

  videoCallUnavailable() {
    if (window.PhoneUI?.notify) {
      window.PhoneUI.notify({
        type: "info",
        title: "Chamada de vídeo",
        message: "Essa opção ficará disponível depois.",
      });
    }
  },
};
