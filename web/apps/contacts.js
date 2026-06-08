function normalizeContactLetter(name) {
  const first = String(name || "")
    .trim()
    .charAt(0)
    .toUpperCase();
  return /[A-ZÀ-Ú]/i.test(first) ? first : "#";
}

function formatContactNumber(number) {
  return window.Utils.formatPhone(number || "") || number || "";
}

function getContactAvatar(contact, state) {
  const playerNumber = state.playerProfile?.phoneNumber || "";
  const profilePhoto = state.profilePhoto || "";

  if (contact.avatar) {
    return {
      type: "image",
      value: contact.avatar,
    };
  }

  if (
    playerNumber &&
    String(contact.number || "") === String(playerNumber) &&
    profilePhoto
  ) {
    return {
      type: "image",
      value: profilePhoto,
    };
  }

  const letter = normalizeContactLetter(contact.name);
  return {
    type: "letter",
    value: letter,
  };
}

function buildGroupedContacts(contacts) {
  const groups = {};

  contacts.forEach((contact) => {
    const letter = normalizeContactLetter(contact.name);

    if (!groups[letter]) {
      groups[letter] = [];
    }

    groups[letter].push(contact);
  });

  return Object.keys(groups)
    .sort((a, b) => a.localeCompare(b))
    .map((letter) => ({
      letter,
      items: groups[letter].sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"),
      ),
    }));
}

registerApp({
  id: "contacts",
  name: "Contatos",
  icon: "user-round",
  order: 3,

  render: (ctx) => {
    const state = ctx.getState();
    const contacts = ctx.contract.contacts.get(state);
    const contactsView = state.contactsView || "list";
    const selectedContactId = state.selectedContactId;
    const contactDraft = state.contactDraft || {
      id: null,
      name: "",
      number: "",
      avatar: "",
      favorite: false,
    };

    const search = String(state.contactSearch || "")
      .toLowerCase()
      .trim();

    const filteredContacts = contacts.filter((contact) => {
      const name = String(contact.name || "").toLowerCase();
      const number = String(contact.number || "").toLowerCase();

      if (!search) return true;
      return name.includes(search) || number.includes(search);
    });

    const groupedContacts = buildGroupedContacts(filteredContacts);
    const selectedContact = contacts.find(
      (contact) => String(contact.id) === String(selectedContactId),
    );

    if (contactsView === "editor") {
      const avatar = getContactAvatar(
        {
          name: contactDraft.name,
          number: contactDraft.number,
          avatar: contactDraft.avatar,
        },
        state,
      );

      return `
        <div class="app-page contacts-page">
          <div class="app-header app-header--standard">
            <div class="app-header-left">
              <button class="app-header-text-btn" onclick="window.ContactsApp.cancelEditor()">
                Cancelar
              </button>
            </div>

            <div class="app-header-center">
              <div class="app-title">${selectedContactId ? "Editar Contato" : "Novo Contato"}</div>
            </div>

            <div class="app-header-right">
              <button class="app-header-text-btn" onclick="window.ContactsApp.saveContact()">
                Salvar
              </button>
            </div>
          </div>

          <div class="app-content contacts-editor-content">
            <div class="contacts-editor-avatar-wrap">
              ${
                avatar.type === "image"
                  ? `<img class="contacts-editor-avatar" src="${window.Utils.escapeHtmlAttr(avatar.value)}" alt="Avatar" />`
                  : `
                    <div class="contacts-editor-avatar placeholder">
                      ${
                        avatar.value === "#"
                          ? `<i data-lucide="user-round"></i>`
                          : window.Utils.escapeHtml(avatar.value)
                      }
                    </div>
                  `
              }
            </div>

            <div class="contacts-editor-avatar-actions">
              <button class="contacts-avatar-action" onclick="window.ContactsApp.openAvatarCamera()">
                <i data-lucide="camera"></i>
                <span>Camera</span>
              </button>

              <button class="contacts-avatar-action" onclick="window.ContactsApp.openAvatarGallery()">
                <i data-lucide="images"></i>
                <span>Galeria</span>
              </button>

              ${
                contactDraft.avatar
                  ? `
                    <button class="contacts-avatar-action" onclick="window.ContactsApp.clearAvatar()">
                      <i data-lucide="x"></i>
                      <span>Remover</span>
                    </button>
                  `
                  : ""
              }
            </div>

            <div class="contacts-editor-fields">
              <div class="contacts-field-card">
                <label class="contacts-field-label">Nome</label>
                <input
                  class="contacts-field-input"
                  type="text"
                  placeholder="Digite o nome"
                  value="${window.Utils.escapeHtmlAttr(contactDraft.name || "")}"
                  oninput="window.ContactsApp.setDraftField('name', this.value)"
                />
              </div>

              <div class="contacts-field-card">
                <label class="contacts-field-label">Número</label>
                <input
                  class="contacts-field-input"
                  type="text"
                  placeholder="Digite o número"
                  value="${window.Utils.escapeHtmlAttr(contactDraft.number || "")}"
                  oninput="window.ContactsApp.setDraftField('number', this.value)"
                />
              </div>
            </div>
          </div>
        </div>
      `;
    }

    if (contactsView === "detail" && selectedContact) {
      const avatar = getContactAvatar(selectedContact, state);

      return `
        <div class="app-page contacts-page">
          <div class="app-header app-header--standard">
            <div class="app-header-left">
              <button class="app-header-icon-btn" onclick="window.ContactsApp.backToList()">
                <i data-lucide="chevron-left"></i>
              </button>
            </div>

            <div class="app-header-center">
              <div class="app-title">Contato</div>
            </div>

            <div class="app-header-right">
              <button class="app-header-icon-btn contacts-favorite-btn" onclick="window.ContactsApp.toggleFavorite('${selectedContact.id}')">
                <i data-lucide="star" ${selectedContact.favorite ? 'fill="currentColor"' : ""}></i>
              </button>
            </div>
          </div>

          <div class="app-content contacts-detail-content">
            <div class="contacts-detail-avatar-wrap">
              ${
                avatar.type === "image"
                  ? `<img class="contacts-detail-avatar" src="${window.Utils.escapeHtmlAttr(avatar.value)}" alt="Avatar" />`
                  : `
                    <div class="contacts-detail-avatar placeholder">
                      ${
                        avatar.value === "#"
                          ? `<i data-lucide="user-round"></i>`
                          : window.Utils.escapeHtml(avatar.value)
                      }
                    </div>
                  `
              }
            </div>

            <div class="contacts-detail-name">${window.Utils.escapeHtml(selectedContact.name || "Sem nome")}</div>
            <div class="contacts-detail-number">${window.Utils.escapeHtml(formatContactNumber(selectedContact.number))}</div>

            <div class="contacts-action-row">
              <button class="contacts-action-btn" onclick="window.ContactsApp.fakeCall()">
                <div class="contacts-action-icon">
                  <i data-lucide="phone"></i>
                </div>
                <span>Ligar</span>
              </button>

              <button class="contacts-action-btn" onclick="window.ContactsApp.fakeMessage()">
                <div class="contacts-action-icon">
                  <i data-lucide="message-square"></i>
                </div>
                <span>Mensagem</span>
              </button>
            </div>

            <button class="contacts-delete-btn" onclick="window.ContactsApp.deleteSelected()">
              <i data-lucide="trash-2"></i>
              <span>Excluir Contato</span>
            </button>
          </div>
        </div>
      `;
    }

    return `
      <div class="app-page contacts-page">
        <div class="app-header app-header--standard">
          <div class="app-header-left"></div>

          <div class="app-header-center">
            <div class="app-title">Contatos</div>
          </div>

          <div class="app-header-right">
            <button class="app-header-icon-btn" onclick="window.ContactsApp.openCreate()">
              <i data-lucide="plus"></i>
            </button>
          </div>
        </div>

        <div class="app-content contacts-list-content">
          <div class="contacts-search-wrap">
            <i data-lucide="search"></i>
            <input
              class="contacts-search-input"
              type="text"
              placeholder="Pesquisar"
              value="${window.Utils.escapeHtmlAttr(state.contactSearch || "")}"
              oninput="window.ContactsApp.setSearch(this.value)"
            />
          </div>

          ${
            groupedContacts.length === 0
              ? `<div class="empty-state">Nenhum contato encontrado.</div>`
              : `
                <div class="contacts-list-groups">
                  ${groupedContacts
                    .map(
                      (group) => `
                        <div class="contacts-letter">${window.Utils.escapeHtml(group.letter)}</div>

                        ${group.items
                          .map((contact) => {
                            const avatar = getContactAvatar(contact, state);

                            return `
                              <button class="contacts-row" onclick="window.ContactsApp.openDetail('${contact.id}')">
                                <div class="contacts-row-left">
                                  ${
                                    avatar.type === "image"
                                      ? `<img class="contacts-row-avatar" src="${window.Utils.escapeHtmlAttr(avatar.value)}" alt="Avatar" />`
                                      : `
                                        <div class="contacts-row-avatar placeholder">
                                          ${
                                            avatar.value === "#"
                                              ? `<i data-lucide="user-round"></i>`
                                              : window.Utils.escapeHtml(
                                                  avatar.value,
                                                )
                                          }
                                        </div>
                                      `
                                  }

                                  <div class="contacts-row-texts">
                                    <div class="contacts-row-name">${window.Utils.escapeHtml(contact.name || "Sem nome")}</div>
                                    <div class="contacts-row-number">${window.Utils.escapeHtml(formatContactNumber(contact.number))}</div>
                                  </div>
                                </div>

                                ${
                                  contact.favorite
                                    ? `
                                    <div class="contacts-row-star">
                                      <i data-lucide="star" fill="currentColor" stroke="currentColor"></i>
                                    </div>
                                  `
                                    : ""
                                }
                              </button>
                            `;
                          })
                          .join("")}
                      `,
                    )
                    .join("")}
                </div>
              `
          }
        </div>
      </div>
    `;
  },

  onOpen: (ctx) => {
    function emptyDraft() {
      return {
        id: null,
        name: "",
        number: "",
        avatar: "",
        favorite: false,
      };
    }

    async function refreshContacts() {
      if (window.PhoneAPI?.getContacts) {
        await window.PhoneAPI.getContacts();
      }
    }

    if (window.PhoneAPI?.onReceiveContacts && !window.__contactsApiBound) {
      window.__contactsApiBound = true;

      window.PhoneAPI.onReceiveContacts((contacts) => {
        const state = window.PhoneApp.getState();
        const currentState = { ...state };

        window.PhoneApp.setState(
          window.AppContract.contacts.set(currentState, contacts || []),
        );

        if (
          currentState.selectedContactId &&
          !(contacts || []).some(
            (contact) =>
              String(contact.id) === String(currentState.selectedContactId),
          )
        ) {
          window.PhoneApp.patchState({
            selectedContactId: null,
            contactsView: "list",
            contactDraft: emptyDraft(),
          });
        }

        if (window.PhoneApp.getState().currentApp === "contacts") {
          window.PhoneApp.renderCurrentApp();
        }
      });
    }

    window.ContactsApp = {
      goHome: () => {
        ctx.goHome();
      },

      setSearch: (value) => {
        ctx.patchState({
          contactSearch: value,
        });

        ctx.renderCurrentApp();

        setTimeout(() => {
          const input = document.querySelector(".contacts-search-input");
          if (!input) return;
          input.focus();
          input.setSelectionRange(value.length, value.length);
        }, 0);
      },

      openCreate: () => {
        ctx.patchState({
          contactsView: "editor",
          selectedContactId: null,
          contactDraft: emptyDraft(),
        });
        ctx.renderCurrentApp();
      },

      openDetail: (contactId) => {
        ctx.patchState({
          contactsView: "detail",
          selectedContactId: contactId,
        });
        ctx.renderCurrentApp();
      },

      backToList: () => {
        ctx.patchState({
          contactsView: "list",
          selectedContactId: null,
          contactDraft: emptyDraft(),
        });
        ctx.renderCurrentApp();
      },

      cancelEditor: () => {
        ctx.patchState({
          contactsView: "list",
          selectedContactId: null,
          contactDraft: emptyDraft(),
        });
        ctx.renderCurrentApp();
      },

      setDraftField: (field, value) => {
        const state = ctx.getState();
        const draft = state.contactDraft || emptyDraft();

        ctx.patchState({
          contactDraft: {
            ...draft,
            [field]: value,
          },
        });
      },

      openAvatarCamera: () => {
        const state = ctx.getState();
        const draft = state.contactDraft || emptyDraft();

        if (window.PhoneMedia?.openCameraForResult) {
          window.PhoneMedia.openCameraForResult({
            purpose: "contact_avatar",
            returnApp: "contacts",
            returnState: {
              contactsView: "editor",
              selectedContactId: state.selectedContactId || null,
              contactDraft: draft,
            },
          });
        }
      },

      openAvatarGallery: () => {
        const state = ctx.getState();
        const draft = state.contactDraft || emptyDraft();

        if (window.PhoneMedia?.openGalleryForResult) {
          window.PhoneMedia.openGalleryForResult({
            purpose: "contact_avatar",
            returnApp: "contacts",
            returnState: {
              contactsView: "editor",
              selectedContactId: state.selectedContactId || null,
              contactDraft: draft,
            },
          });
        }
      },

      clearAvatar: () => {
        const state = ctx.getState();
        const draft = state.contactDraft || emptyDraft();

        ctx.patchState({
          contactDraft: {
            ...draft,
            avatar: "",
          },
        });

        ctx.renderCurrentApp();
      },

      applyMediaResult: (media, request) => {
        const imageUrl = String(media?.imageUrl || media?.url || "").trim();
        if (!imageUrl || request?.purpose !== "contact_avatar") return false;

        const state = ctx.getState();
        const draft =
          request?.returnState?.contactDraft ||
          state.contactDraft ||
          emptyDraft();

        ctx.patchState({
          contactsView: "editor",
          selectedContactId:
            request?.returnState?.selectedContactId ||
            state.selectedContactId ||
            null,
          contactDraft: {
            ...draft,
            avatar: imageUrl,
          },
        });

        ctx.renderCurrentApp();
        return true;
      },

      saveContact: async () => {
        const state = ctx.getState();
        const draft = state.contactDraft || emptyDraft();

        const payload = {
          name: String(draft.name || "").trim(),
          number: String(draft.number || "").trim(),
          avatar: String(draft.avatar || "").trim(),
          favorite: !!draft.favorite,
        };

        if (!payload.name && !payload.number) return;

        if (state.selectedContactId) {
          if (window.PhoneAPI?.updateContact) {
            await window.PhoneAPI.updateContact(
              state.selectedContactId,
              payload,
            );
          }
        } else {
          if (window.PhoneAPI?.createContact) {
            await window.PhoneAPI.createContact(payload);
          }
        }

        ctx.patchState({
          contactsView: "list",
          selectedContactId: null,
          contactDraft: emptyDraft(),
        });

        await refreshContacts();
      },

      deleteSelected: async () => {
        const state = ctx.getState();
        if (!state.selectedContactId) return;

        if (window.PhoneAPI?.deleteContact) {
          await window.PhoneAPI.deleteContact(state.selectedContactId);
        }

        ctx.patchState({
          contactsView: "list",
          selectedContactId: null,
          contactDraft: emptyDraft(),
        });

        await refreshContacts();
      },

      toggleFavorite: async (contactId) => {
        if (window.PhoneAPI?.toggleFavoriteContact) {
          await window.PhoneAPI.toggleFavoriteContact(contactId);
        }

        await refreshContacts();
      },

      fakeCall: () => {
        const state = ctx.getState();
        const contact = (state.contacts || []).find(
          (item) => String(item.id) === String(state.selectedContactId),
        );

        if (!contact || !contact.number) return;

        if (window.CallsApp?.startCallFromApp) {
          window.CallsApp.startCallFromApp(
            contact.number,
            contact.name || contact.number,
            contact.id,
          );
        }
      },

      fakeMessage: async () => {
        const state = ctx.getState();
        const contact = (state.contacts || []).find(
          (item) => String(item.id) === String(state.selectedContactId),
        );

        if (!contact || !contact.number) return;

        window.PhoneApp.patchState({
          pendingOpenConversationNumber: contact.number,
          currentApp: "messages",
          selectedConversationId: null,
          messagesPickingContact: false,
        });

        if (window.PhoneAPI?.createConversation) {
          await window.PhoneAPI.createConversation({
            target_number: contact.number,
            target_name: contact.name,
          });
        }

        if (window.PhoneAPI?.getConversations) {
          await window.PhoneAPI.getConversations();
        }

        window.PhoneApp.renderCurrentApp();
      },
    };

    refreshContacts();
  },

  onClose: () => {
    delete window.ContactsApp;
  },
});
