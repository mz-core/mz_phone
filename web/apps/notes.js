function formatNoteDate(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const months = [
    "jan.",
    "fev.",
    "mar.",
    "abr.",
    "mai.",
    "jun.",
    "jul.",
    "ago.",
    "set.",
    "out.",
    "nov.",
    "dez.",
  ];

  const day = String(date.getDate()).padStart(2, "0");
  const month = months[date.getMonth()] || "";
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");

  return `${day} de ${month}, ${hh}:${mm}`;
}

function getNotePreview(content) {
  const normalized = String(content || "")
    .replace(/\n+/g, " ")
    .trim();
  return normalized;
}

registerApp({
  id: "notes",
  name: "Notas",
  icon: "notebook-pen",
  order: 2,

  render: (ctx) => {
    const state = ctx.getState();
    const notes = ctx.contract.notes.get(state);
    const notesView = state.notesView || "list";
    const noteSearch = String(state.noteSearch || "")
      .toLowerCase()
      .trim();
    const selectedNoteId = state.selectedNoteId;
    const noteDraft = state.noteDraft || { title: "", content: "" };

    const filteredNotes = notes.filter((note) => {
      const title = String(note.title || "").toLowerCase();
      const content = String(note.content || "").toLowerCase();

      if (!noteSearch) return true;
      return title.includes(noteSearch) || content.includes(noteSearch);
    });

    const selectedNote = notes.find(
      (note) => String(note.id) === String(selectedNoteId),
    );

    if (notesView === "editor") {
      const isEditing = !!selectedNoteId;

      return `
      <div class="app-page notes-page">
        <div class="app-header app-header--standard">
          <div class="app-header-left">
            <button class="app-header-icon-btn" onclick="window.NotesApp.cancelEditor()">
              <i data-lucide="x"></i>
            </button>
          </div>

          <div class="app-header-center">
            <div class="app-title">${isEditing ? "Editar Nota" : "Nova Nota"}</div>
          </div>

          <div class="app-header-right">
            <button class="app-header-text-btn" onclick="window.NotesApp.saveNote()">
              Salvar
            </button>
          </div>
        </div>

        <div class="app-content notes-editor-content">
          <input
            class="notes-title-input"
            type="text"
            placeholder="Título"
            value="${window.Utils.escapeHtmlAttr(noteDraft.title || "")}"
            oninput="window.NotesApp.setDraftField('title', this.value)"
          />

          <textarea
            class="notes-body-input"
            placeholder="Comece a escrever..."
            oninput="window.NotesApp.setDraftField('content', this.value)"
          >${window.Utils.escapeHtml(noteDraft.content || "")}</textarea>
        </div>
      </div>
    `;
    }

    if (notesView === "detail" && selectedNote) {
      return `
        <div class="app-page notes-page">
          <div class="app-header app-header--standard">
            <div class="app-header-left">
              <button class="app-header-icon-btn" onclick="window.NotesApp.backToList()">
                <i data-lucide="chevron-left"></i>
              </button>
            </div>

            <div class="app-header-center">
              <div class="notes-detail-date">${window.Utils.escapeHtml(formatNoteDate(selectedNote.updated_at || selectedNote.created_at))}</div>
            </div>

            <div class="app-header-right">
              <button class="app-header-icon-btn notes-danger-btn" onclick="window.NotesApp.deleteSelectedNote()">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </div>

          <div class="app-content notes-detail-content">
            <button class="notes-detail-edit-hitbox" onclick="window.NotesApp.editSelectedNote()">
              <div class="notes-detail-title">${window.Utils.escapeHtml(selectedNote.title || "Sem título")}</div>
              <div class="notes-detail-body">${window.Utils.escapeHtml(selectedNote.content || "")}</div>
            </button>
          </div>
        </div>
      `;
    }

    return `
      <div class="app-page notes-page">
        <div class="app-header app-header--standard">
          <div class="app-header-left"></div>

          <div class="app-header-center">
            <div class="app-title">Notas</div>
          </div>

          <div class="app-header-right">
            <button class="app-header-icon-btn" onclick="window.NotesApp.openCreate()">
              <i data-lucide="plus"></i>
            </button>
          </div>
        </div>

        <div class="app-content notes-list-content">
          <div class="notes-search-wrap">
            <i data-lucide="search"></i>
            <input
              class="notes-search-input"
              type="text"
              placeholder="Pesquisar"
              value="${window.Utils.escapeHtmlAttr(state.noteSearch || "")}"
              oninput="window.NotesApp.setSearch(this.value)"
            />
          </div>

          ${
            filteredNotes.length === 0
              ? `<div class="empty-state">Nenhuma nota encontrada.</div>`
              : `
                <div class="notes-cards">
                  ${filteredNotes
                    .map((note) => {
                      const preview = getNotePreview(note.content || "");

                      return `
                        <button class="notes-card" onclick="window.NotesApp.openDetail('${note.id}')">
                          <div class="notes-card-title">${window.Utils.escapeHtml(note.title || "Sem título")}</div>
                          <div class="notes-card-preview">${window.Utils.escapeHtml(preview)}</div>
                          <div class="notes-card-date">${window.Utils.escapeHtml(formatNoteDate(note.updated_at || note.created_at))}</div>
                        </button>
                      `;
                    })
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
        title: "",
        content: "",
      };
    }

    function setNotes(nextNotes) {
      const currentState = ctx.getState();
      ctx.setState(ctx.contract.notes.set(currentState, nextNotes));
    }

    async function refreshNotes() {
      if (window.PhoneAPI?.getNotes) {
        await window.PhoneAPI.getNotes();
      }
    }

    if (window.PhoneAPI?.onReceiveNotes && !window.__notesApiBound) {
      window.__notesApiBound = true;

      window.PhoneAPI.onReceiveNotes((notes) => {
        const state = window.PhoneApp.getState();
        const currentState = { ...state };

        window.PhoneApp.setState(
          window.AppContract.notes.set(currentState, notes || []),
        );

        if (
          currentState.selectedNoteId &&
          !(notes || []).some(
            (note) => String(note.id) === String(currentState.selectedNoteId),
          )
        ) {
          window.PhoneApp.patchState({
            selectedNoteId: null,
            notesView: "list",
            noteDraft: emptyDraft(),
          });
        }

        if (window.PhoneApp.getState().currentApp === "notes") {
          window.PhoneApp.renderCurrentApp();
        }
      });
    }

    window.NotesApp = {
      goHome: () => {
        ctx.goHome();
      },

      setSearch: (value) => {
        ctx.patchState({
          noteSearch: value,
        });

        ctx.renderCurrentApp();

        setTimeout(() => {
          const input = document.querySelector(".notes-search-input");
          if (!input) return;

          input.focus();
          input.setSelectionRange(value.length, value.length);
        }, 0);
      },

      openCreate: () => {
        ctx.patchState({
          notesView: "editor",
          selectedNoteId: null,
          noteDraft: emptyDraft(),
        });
        ctx.renderCurrentApp();
      },

      openDetail: (noteId) => {
        ctx.patchState({
          notesView: "detail",
          selectedNoteId: noteId,
        });
        ctx.renderCurrentApp();
      },

      backToList: () => {
        ctx.patchState({
          notesView: "list",
          selectedNoteId: null,
          noteDraft: emptyDraft(),
        });
        ctx.renderCurrentApp();
      },

      editSelectedNote: () => {
        const state = ctx.getState();
        const notes = ctx.contract.notes.get(state);
        const note = notes.find(
          (item) => String(item.id) === String(state.selectedNoteId),
        );
        if (!note) return;

        ctx.patchState({
          notesView: "editor",
          noteDraft: {
            title: note.title || "",
            content: note.content || "",
          },
        });
        ctx.renderCurrentApp();
      },

      cancelEditor: () => {
        const state = ctx.getState();

        if (state.selectedNoteId) {
          ctx.patchState({
            notesView: "detail",
            noteDraft: emptyDraft(),
          });
        } else {
          ctx.patchState({
            notesView: "list",
            noteDraft: emptyDraft(),
          });
        }

        ctx.renderCurrentApp();
      },

      setDraftField: (field, value) => {
        const state = ctx.getState();
        const currentDraft = state.noteDraft || emptyDraft();

        ctx.patchState({
          noteDraft: {
            ...currentDraft,
            [field]: value,
          },
        });
      },

      saveNote: async () => {
        const state = ctx.getState();
        const draft = state.noteDraft || emptyDraft();

        const title = String(draft.title || "").trim();
        const content = String(draft.content || "").trim();

        if (!title && !content) return;

        if (state.selectedNoteId) {
          if (window.PhoneAPI?.updateNote) {
            await window.PhoneAPI.updateNote(state.selectedNoteId, {
              title,
              content,
            });
          }
        } else {
          if (window.PhoneAPI?.createNote) {
            await window.PhoneAPI.createNote({
              title,
              content,
            });
          }
        }

        ctx.patchState({
          notesView: "list",
          selectedNoteId: null,
          noteDraft: emptyDraft(),
        });

        await refreshNotes();
      },

      deleteSelectedNote: async () => {
        const state = ctx.getState();
        if (!state.selectedNoteId) return;

        if (window.PhoneAPI?.deleteNote) {
          await window.PhoneAPI.deleteNote(state.selectedNoteId);
        }

        ctx.patchState({
          notesView: "list",
          selectedNoteId: null,
          noteDraft: emptyDraft(),
        });

        await refreshNotes();
      },
    };

    refreshNotes();
  },

  onClose: () => {
    delete window.NotesApp;
  },
});
