registerApp({
  id: "gallery",
  name: "Galeria",
  icon: "image",
  order: 50,

  onOpen(ctx) {
    ctx.patchState({
      gallerySelectedPhotoId: null,
    });

    if (window.PhoneAPI?.getGallery) {
      window.PhoneAPI.getGallery();
    }
  },

  render(ctx) {
    const state = ctx.getState();
    const photos = window.AppContract.gallery.get(state);
    const selectedId = state.gallerySelectedPhotoId;
    const selected = photos.find((photo) => String(photo.id) === String(selectedId));

    if (selected) {
      return renderGalleryViewer(selected);
    }

    return renderGalleryGrid(photos);
  },
});

function galleryPhotoUrl(photo) {
  return photo.thumbnail_url || photo.image_url || "";
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

function renderGalleryGrid(photos) {
  return `
    <div class="app-page gallery-page">
      <div class="app-header app-header--standard">
        <div class="app-header-left"></div>

        <div class="app-header-center">
          <div class="app-title">Galeria</div>
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
                ${photos.map(renderGalleryTile).join("")}
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

function renderGalleryTile(photo) {
  const image = galleryPhotoUrl(photo);
  const caption = photo.caption || galleryDate(photo.created_at) || "Foto";

  return `
    <button class="gallery-tile" onclick="window.GalleryApp.openPhoto('${String(photo.id)}')">
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

function renderGalleryViewer(photo) {
  const image = photo.image_url || photo.thumbnail_url || "";
  const title = photo.caption || "Foto";

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
          <button class="app-header-icon-btn" onclick="window.GalleryApp.toggleFavorite('${String(photo.id)}')" aria-label="Favorito">
            <i data-lucide="${photo.favorite ? "star" : "star-off"}"></i>
          </button>
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

        <button class="gallery-delete-btn" onclick="window.GalleryApp.deletePhoto('${String(photo.id)}')">
          <i data-lucide="trash-2"></i>
          <span>Excluir foto</span>
        </button>
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
    window.PhoneApp.patchState({
      gallerySelectedPhotoId: photoId,
    });
    window.PhoneApp.renderCurrentApp();
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
    const photo = photos.find((item) => String(item.id) === String(photoId));
    if (!photo || !window.PhoneAPI?.toggleGalleryFavorite) return;

    await window.PhoneAPI.toggleGalleryFavorite(photoId, !photo.favorite);
  },
};
