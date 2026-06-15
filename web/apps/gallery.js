registerApp({
  id: "gallery",
  name: "Galeria",
  icon: "image",
  order: 50,

  onOpen(ctx) {
    const state = ctx.getState();
    const isPicker = Boolean(state.galleryPicker || state.appParams?.picker);

    ctx.patchState({
      gallerySelectedPhotoId: null,
      galleryPicker: isPicker,
    });

    if (window.PhoneAPI?.getGallery) {
      window.PhoneAPI.getGallery();
    }
  },

  render(ctx) {
    const state = ctx.getState();
    const photos = window.AppContract.gallery.get(state);
    const isPicker = Boolean(state.galleryPicker);
    const selectedId = state.gallerySelectedPhotoId;
    const selected = photos.find(
      (photo) => galleryPhotoId(photo) === String(selectedId),
    );

    if (selected) {
      return renderGalleryViewer(selected, isPicker);
    }

    return renderGalleryGrid(photos, isPicker);
  },
});

function galleryPhotoUrl(photo) {
  return photo.thumbnailUrl || photo.thumbnail_url || photo.imageUrl || photo.image_url || "";
}

function galleryPhotoId(photo) {
  const id =
    photo?.galleryPhotoId ??
    photo?.gallery_photo_id ??
    photo?.id ??
    photo?.photoId ??
    photo?.photo_id ??
    "";

  return id === null || id === undefined ? "" : String(id);
}

function galleryDate(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function renderGalleryGrid(photos, isPicker = false) {
  return `
    <div class="app-page gallery-page">
      <div class="app-header app-header--standard">
        <div class="app-header-left">
          ${
            isPicker
              ? `
                <button class="app-header-text-btn" onclick="window.GalleryApp.cancelPicker()">
                  Cancelar
                </button>
              `
              : ""
          }
        </div>

        <div class="app-header-center">
          <div class="app-title">${isPicker ? "Selecionar foto" : "Galeria"}</div>
        </div>

        <div class="app-header-right">
          <button class="app-header-icon-btn" onclick="window.GalleryApp.refresh()" aria-label="Atualizar">
            <i data-lucide="refresh-cw"></i>
          </button>
        </div>
      </div>

      <div class="app-content gallery-content">
        ${
          photos.length
            ? `
              <div class="gallery-grid">
                ${photos.map((photo) => renderGalleryTile(photo, isPicker)).join("")}
              </div>
            `
            : `
              <div class="gallery-empty">
                <i data-lucide="images"></i>
                <div class="gallery-empty-title">Nenhuma foto ainda</div>
                <div class="gallery-empty-text">Suas fotos aparecerao aqui.</div>
              </div>
            `
        }
      </div>
    </div>
  `;
}

function renderGalleryTile(photo, isPicker = false) {
  const image = galleryPhotoUrl(photo);
  const caption = photo.caption || galleryDate(photo.created_at) || "Foto";
  const photoId = galleryPhotoId(photo);
  const disabled = isPicker && !photoId;
  const action = isPicker
    ? `window.GalleryApp.selectPhoto('${window.Utils.escapeHtmlAttr(photoId)}')`
    : `window.GalleryApp.openPhoto('${window.Utils.escapeHtmlAttr(photoId)}')`;

  return `
    <button class="gallery-tile ${disabled ? "is-disabled" : ""}" onclick="${action}" ${disabled ? "aria-disabled=\"true\"" : ""}>
      ${
        image
          ? `<img src="${window.Utils.escapeHtml(image)}" alt="${window.Utils.escapeHtml(caption)}" loading="lazy" />`
          : `<div class="gallery-tile-placeholder"><i data-lucide="image-off"></i></div>`
      }
      ${photo.favorite ? `<span class="gallery-favorite-badge"><i data-lucide="star"></i></span>` : ""}
      <span class="gallery-tile-date">${window.Utils.escapeHtml(galleryDate(photo.created_at))}</span>
    </button>
  `;
}

function renderGalleryViewer(photo, isPicker = false) {
  const image = photo.imageUrl || photo.image_url || photo.thumbnailUrl || photo.thumbnail_url || "";
  const title = photo.caption || "Foto";
  const photoId = galleryPhotoId(photo);

  return `
    <div class="app-page gallery-page gallery-viewer-page">
      <div class="app-header app-header--standard">
        <div class="app-header-left">
          <button class="app-back" onclick="window.GalleryApp.closeViewer()" aria-label="Voltar">
            <i data-lucide="chevron-left"></i>
          </button>
        </div>

        <div class="app-header-center">
          <div class="app-title">Foto</div>
        </div>

        <div class="app-header-right">
          ${
            isPicker
              ? ""
              : `
                <button class="app-header-icon-btn" onclick="window.GalleryApp.toggleFavorite('${window.Utils.escapeHtmlAttr(photoId)}')" aria-label="Favorito">
                  <i data-lucide="${photo.favorite ? "star" : "star-off"}"></i>
                </button>
              `
          }
        </div>
      </div>

      <div class="app-content gallery-viewer-content">
        <div class="gallery-viewer-image-wrap">
          ${
            image
              ? `<img class="gallery-viewer-image" src="${window.Utils.escapeHtml(image)}" alt="${window.Utils.escapeHtml(title)}" />`
              : `<div class="gallery-viewer-placeholder"><i data-lucide="image-off"></i></div>`
          }
        </div>

        <div class="gallery-viewer-meta">
          <div class="gallery-viewer-caption">${window.Utils.escapeHtml(title)}</div>
          <div class="gallery-viewer-date">${window.Utils.escapeHtml(galleryDate(photo.created_at))}</div>
        </div>

        ${
          isPicker
            ? `
              <button class="gallery-delete-btn" onclick="window.GalleryApp.selectPhoto('${window.Utils.escapeHtmlAttr(photoId)}')">
                <i data-lucide="check"></i>
                <span>Usar esta foto</span>
              </button>
            `
            : `
              <button class="gallery-delete-btn" onclick="window.GalleryApp.deletePhoto('${window.Utils.escapeHtmlAttr(photoId)}')">
                <i data-lucide="trash-2"></i>
                <span>Excluir foto</span>
              </button>
            `
        }
      </div>
    </div>
  `;
}

window.GalleryApp = {
  refresh() {
    if (window.PhoneAPI?.getGallery) {
      window.PhoneAPI.getGallery();
    }
  },

  openPhoto(photoId) {
    if (!photoId) return;

    window.PhoneApp.patchState({
      gallerySelectedPhotoId: photoId,
    });
    window.PhoneApp.renderCurrentApp();
  },

  selectPhoto(photoId) {
    if (!photoId) {
      window.PhoneUI?.notify?.({
        type: "warning",
        title: "Galeria",
        message: "Foto indisponivel para selecao.",
        preventPreview: true,
        keepPhoneOpen: true,
        scope: "in-app",
      });
      return;
    }

    const state = window.PhoneApp.getState();
    const photos = window.AppContract.gallery.get(state);
    const photo = photos.find(
      (item) => galleryPhotoId(item) === String(photoId),
    );
    if (!photo) {
      window.PhoneUI?.notify?.({
        type: "warning",
        title: "Galeria",
        message: "Foto nao encontrada.",
        preventPreview: true,
        keepPhoneOpen: true,
        scope: "in-app",
      });
      return;
    }

    if (state.galleryPicker && window.PhoneMedia?.complete) {
      window.PhoneMedia.complete(photo, "gallery");
      return;
    }

    window.GalleryApp.openPhoto(photoId);
  },

  cancelPicker() {
    if (window.PhoneMedia?.cancel) {
      window.PhoneMedia.cancel();
      return;
    }

    window.goHome();
  },

  closeViewer() {
    window.PhoneApp.patchState({
      gallerySelectedPhotoId: null,
    });
    window.PhoneApp.renderCurrentApp();
  },

  async deletePhoto(photoId) {
    if (!window.PhoneAPI?.deleteGalleryPhoto) return;

    window.PhoneApp.patchState({
      gallerySelectedPhotoId: null,
    });
    await window.PhoneAPI.deleteGalleryPhoto(photoId);
  },

  async toggleFavorite(photoId) {
    const state = window.PhoneApp.getState();
    const photos = window.AppContract.gallery.get(state);
    const photo = photos.find((item) => galleryPhotoId(item) === String(photoId));
    if (!photo || !window.PhoneAPI?.toggleGalleryFavorite) return;

    await window.PhoneAPI.toggleGalleryFavorite(photoId, !photo.favorite);
  },
};
