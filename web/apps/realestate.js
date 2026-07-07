registerApp({
  id: "realestate",
  name: "Imoveis",
  icon: "building-2",
  order: 55,

  onOpen(ctx) {
    if (ctx.getState().appParams?.skipMediaRequest === true) {
      ctx.patchState({
        realEstatePhotoPickerOpen: false,
        realEstatePhotoPickerLoading: false,
      });
      return;
    }

    ctx.patchState({
      realEstateView: "list",
      realEstateSelectedListing: null,
      realEstateLoading: true,
      realEstateError: "",
      realEstateReturnView: "list",
      realEstateActionBusy: false,
      realEstatePhotoBusy: false,
      realEstatePhotoPickerOpen: false,
      realEstatePhotoPickerLoading: false,
    });

    window.PhoneAPI?.getRealEstateBrokerAccess?.();
    loadRealEstateListings(ctx.getState().realEstateTab || "all");
  },

  render(ctx) {
    const state = ctx.getState();

    if (state.realEstateView === "detail") {
      return renderRealEstateDetail(state);
    }

    if (state.realEstateView === "mine") {
      return renderRealEstateMine(state);
    }

    if (state.realEstateView === "form") {
      return renderRealEstateForm(state);
    }

    return renderRealEstateList(state);
  },
});

function realEstateTypeLabel(type, fallback = "") {
  if (type === "sale") return "Venda";
  if (type === "rent") return "Aluguel";
  if (type === "visit") return "Visita";
  if (type === "showcase") return "Vitrine";
  return fallback || "Anuncio";
}

function realEstateStatusLabel(status) {
  if (status === "active") return "Ativo";
  if (status === "paused") return "Pausado";
  if (status === "pending") return "Pendente";
  if (status === "draft") return "Rascunho";
  if (status === "archived") return "Arquivado";
  if (status === "sold") return "Vendido";
  if (status === "rented") return "Alugado";
  if (status === "reserved") return "Reservado";
  if (status === "cancelled") return "Cancelado";
  return status || "Status";
}

function realEstateFilterFromTab(tab) {
  if (tab === "sale") return "sale";
  if (tab === "rent") return "rent";
  if (tab === "visit") return "visit";
  if (tab === "showcase") return "showcase";
  return "";
}

function realEstateSafeText(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function realEstateLocationLine(listing) {
  const neighborhood = realEstateSafeText(listing?.neighborhood);
  const city = realEstateSafeText(listing?.city);
  const address = realEstateSafeText(listing?.address);

  if (neighborhood && city) return `${neighborhood}, ${city}`;
  if (neighborhood) return neighborhood;
  if (city) return city;
  return address || "Endereco nao informado";
}

function realEstateAccessAllowed(state) {
  return window.AppContract.realestate.getAccess(state).allowed === true;
}

function debugRealEstate(scope, data = {}) {
  try {
    if (window.localStorage?.getItem("mzPhoneDebug") !== "1") return;
    console.debug(`[realestate:${scope}]`, data);
  } catch (_) {}
}

let realEstateSaveTimeout = null;

function keepRealEstatePhoneOpen(reason = "realestate_keep_open") {
  window.PhoneApp?.maintainOpenIfAlreadyOpen?.(reason);
  window.PhoneApp?.clearNotificationPreview?.(reason);
}

function clearRealEstateSaveTimeout() {
  if (!realEstateSaveTimeout) return;
  clearTimeout(realEstateSaveTimeout);
  realEstateSaveTimeout = null;
}

function armRealEstateSaveTimeout() {
  clearRealEstateSaveTimeout();
  realEstateSaveTimeout = setTimeout(() => {
    realEstateSaveTimeout = null;
    const state = window.PhoneApp?.getState?.();
    if (
      state?.currentApp !== "realestate" ||
      state?.realEstateView !== "form" ||
      (state?.realEstateSaving !== true && state?.realEstateActionBusy !== true)
    ) {
      return;
    }

    debugRealEstate("create", {
      action: "timeout",
      mode: state.realEstateFormMode || "create",
    });

    window.PhoneApp.patchState({
      realEstateSaving: false,
      realEstateActionBusy: false,
      realEstateLastError: "timeout",
    });
    keepRealEstatePhoneOpen("realestate_save_timeout");
    notifyRealEstateError("O servidor nao respondeu ao salvar. Tente novamente.");
    window.PhoneApp.renderCurrentApp();
  }, 20000);
}

function preventRealEstateSubmitEvent(event) {
  if (!event) return;
  if (typeof event.preventDefault === "function") event.preventDefault();
  if (typeof event.stopPropagation === "function") event.stopPropagation();
}

function renderRealEstateHeader(title, options = {}) {
  const left =
    options.left ||
    `
    <button class="app-back" onclick="window.RealEstateApp.back()" aria-label="Voltar">
      <i data-lucide="chevron-left"></i>
    </button>
  `;
  const right = options.right || "";

  return `
    <div class="app-header app-header--standard">
      <div class="app-header-left">${left}</div>
      <div class="app-header-center">
        <div class="app-title">${title}</div>
      </div>
      <div class="app-header-right">${right}</div>
    </div>
  `;
}

function renderRealEstateList(state) {
  const listings = window.AppContract.realestate.getListings(state);
  const tab = state.realEstateTab || "all";
  const isLoading = state.realEstateLoading === true;
  const error = realEstateSafeText(state.realEstateError);
  const canManage = realEstateAccessAllowed(state);

  return `
    <div class="app-page realestate-page">
      ${renderRealEstateHeader("Im&oacute;veis", {
        left: "",
        right: `
          ${
            canManage
              ? `<button class="app-header-icon-btn" onclick="window.RealEstateApp.openMine()" aria-label="Meus anuncios"><i data-lucide="briefcase"></i></button>`
              : ""
          }
          <button class="app-header-icon-btn" onclick="window.RealEstateApp.refresh()" aria-label="Atualizar"><i data-lucide="refresh-cw"></i></button>
        `,
      })}

      <div class="realestate-tabs">
        ${renderRealEstateTab("all", "Todos", tab)}
        ${renderRealEstateTab("sale", "Venda", tab)}
        ${renderRealEstateTab("rent", "Aluguel", tab)}
        ${renderRealEstateTab("visit", "Visita", tab)}
        ${renderRealEstateTab("showcase", "Vitrine", tab)}
      </div>

      <div class="app-content realestate-content">
        ${
          isLoading
            ? renderRealEstateEmpty("loader", "Carregando imoveis...")
            : error && error === "realestate_unavailable"
              ? renderRealEstateEmpty("building-x", realEstateErrorText(error))
              : listings.length
                ? `<div class="realestate-list">${listings.map(renderRealEstateCard).join("")}</div>`
                : renderRealEstateEmpty(
                    "building",
                    "Nenhum imovel anunciado no momento.",
                  )
        }
      </div>
    </div>
  `;
}

function renderRealEstateTab(id, label, active) {
  return `
    <button class="realestate-tab ${active === id ? "is-active" : ""}" onclick="window.RealEstateApp.setTab('${id}')">
      ${window.Utils.escapeHtml(label)}
    </button>
  `;
}

function renderRealEstateEmpty(icon, message) {
  return `
    <div class="realestate-empty">
      <i data-lucide="${icon}"></i>
      <div>${window.Utils.escapeHtml(message)}</div>
    </div>
  `;
}

function renderRealEstateImage(image, title) {
  if (!image) {
    return `
      <div class="realestate-image-placeholder">
        <i data-lucide="image-off"></i>
      </div>
    `;
  }

  return `
    <img
      class="realestate-image"
      src="${window.Utils.escapeHtmlAttr(image)}"
      alt="${window.Utils.escapeHtmlAttr(title || "Imovel")}"
      loading="lazy"
    />
  `;
}

function renderRealEstateCard(listing) {
  const title = realEstateSafeText(listing.title, "Imovel anunciado");
  const location = realEstateLocationLine(listing);
  const typeLabel = realEstateTypeLabel(listing.listingType, listing.typeLabel);
  const code = window.Utils.escapeHtmlAttr(listingCodeFrom(listing));
  const clickAction = code
    ? `window.RealEstateApp.openListing('${code}')`
    : "window.RealEstateApp.notifyInvalidListing()";

  return `
    <button class="realestate-card" onclick="${clickAction}">
      <div class="realestate-card-media">
        ${renderRealEstateImage(listing.coverImage, title)}
        <span class="realestate-tag">${window.Utils.escapeHtml(typeLabel)}</span>
      </div>

      <div class="realestate-card-body">
        <div class="realestate-price">${window.Utils.escapeHtml(listing.formattedPrice || "Sob consulta")}</div>
        <div class="realestate-card-title">${window.Utils.escapeHtml(title)}</div>
        ${
          location
            ? `<div class="realestate-card-meta"><i data-lucide="map-pin"></i><span>${window.Utils.escapeHtml(location)}</span></div>`
            : ""
        }
        ${
          listing.brokerName
            ? `<div class="realestate-card-broker">${window.Utils.escapeHtml(listing.brokerName)}</div>`
            : `<div class="realestate-card-broker">Corretor nao informado</div>`
        }
      </div>
    </button>
  `;
}

function renderRealEstateDetail(state) {
  const listing = window.AppContract.realestate.getSelected(state);
  const isLoading = state.realEstateLoading === true;
  const error = realEstateSafeText(state.realEstateError);

  if (isLoading && !listing) {
    return renderRealEstateSimplePage(
      "Detalhes",
      renderRealEstateEmpty("loader", "Carregando anuncio..."),
    );
  }

  if (!listing) {
    return renderRealEstateSimplePage(
      "Detalhes",
      renderRealEstateEmpty(
        "building-x",
        realEstateErrorText(error || "listing_not_found"),
      ),
    );
  }

  const title = realEstateSafeText(listing.title, "Imovel anunciado");
  const location = realEstateLocationLine(listing);
  const photos = Array.isArray(listing.photos) ? listing.photos : [];
  const hero = listing.coverImage || realEstatePhotoImage(photos[0]) || "";
  const brokerName =
    realEstateSafeText(listing.brokerName) ||
    realEstateSafeText(listing.agencyName, "Corretor nao informado");
  const phone = realEstateSafeText(
    listing.brokerPhone || listing.phone || listing.agencyPhone,
  );
  const hasCoords =
    listing.coords &&
    Number.isFinite(Number(listing.coords.x)) &&
    Number.isFinite(Number(listing.coords.y));

  return `
    <div class="app-page realestate-page">
      ${renderRealEstateHeader("Detalhes")}

      <div class="app-content realestate-detail">
        <div class="realestate-detail-hero">
          ${renderRealEstateImage(hero, title)}
          <span class="realestate-tag">${window.Utils.escapeHtml(realEstateTypeLabel(listing.listingType, listing.typeLabel))}</span>
        </div>

        <div class="realestate-detail-main">
          ${
            error
              ? `<div class="realestate-form-note">${window.Utils.escapeHtml(realEstateErrorText(error))}</div>`
              : isLoading
                ? `<div class="realestate-form-note">Atualizando dados do anuncio...</div>`
                : ""
          }
          <div class="realestate-price realestate-detail-price">${window.Utils.escapeHtml(listing.formattedPrice || "Sob consulta")}</div>
          <h2>${window.Utils.escapeHtml(title)}</h2>
          ${
            location
              ? `<div class="realestate-detail-location"><i data-lucide="map-pin"></i><span>${window.Utils.escapeHtml(location)}</span></div>`
              : ""
          }
          <p>${window.Utils.escapeHtml(listing.description || "Descricao indisponivel")}</p>
        </div>

        ${renderRealEstatePublicGallery(photos, title)}

        <div class="realestate-contact">
          <div>
            <div class="realestate-contact-label">Contato</div>
            <div class="realestate-contact-name">${window.Utils.escapeHtml(brokerName)}</div>
            ${phone ? `<div class="realestate-contact-phone">${window.Utils.escapeHtml(phone)}</div>` : ""}
          </div>
        </div>

        <div class="realestate-actions">
          ${
            hasCoords
              ? `<button class="realestate-action" onclick="window.RealEstateApp.markGps()"><i data-lucide="map-pinned"></i><span>GPS</span></button>`
              : ""
          }
          ${
            phone
              ? `<button class="realestate-action" onclick="window.RealEstateApp.callBroker()"><i data-lucide="phone"></i><span>Ligar</span></button>`
              : ""
          }
          ${
            phone
              ? `<button class="realestate-action" onclick="window.RealEstateApp.messageBroker()"><i data-lucide="message-circle"></i><span>Tenho interesse</span></button>`
              : ""
          }
        </div>
      </div>
    </div>
  `;
}

function renderRealEstatePublicGallery(photos, title) {
  const usablePhotos = (Array.isArray(photos) ? photos : []).filter((photo) =>
    Boolean(realEstatePhotoImage(photo)),
  );
  if (usablePhotos.length <= 1) return "";

  return `
    <div class="realestate-gallery-section">
      <div class="realestate-section-title">Fotos</div>
      <div class="realestate-public-gallery">
        ${usablePhotos
          .map((photo) => {
            const image = realEstatePhotoImage(photo);
            if (!image) return "";
            return `
              <button class="realestate-public-photo" onclick="window.RealEstateApp.setDetailCover('${window.Utils.escapeHtmlAttr(encodeURIComponent(image))}')">
                <img src="${window.Utils.escapeHtmlAttr(image)}" alt="${window.Utils.escapeHtmlAttr(photo.caption || title || "Imovel")}" loading="lazy" />
                ${photo.isPrimary ? `<span>Principal</span>` : ""}
              </button>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function renderRealEstateMine(state) {
  const listings = window.AppContract.realestate.getMine(state);
  const error = realEstateSafeText(state.realEstateError);
  const canManage = realEstateAccessAllowed(state);

  if (!canManage) {
    return renderRealEstateSimplePage(
      "Meus anuncios",
      renderRealEstateEmpty("lock", "Area disponivel apenas para corretores."),
    );
  }

  return `
    <div class="app-page realestate-page">
      ${renderRealEstateHeader("Meus anuncios", {
        right: `
          <button class="app-header-icon-btn" onclick="window.RealEstateApp.openCreateForm()" aria-label="Novo anuncio">
            <i data-lucide="plus"></i>
          </button>
        `,
      })}

      <div class="app-content realestate-content">
        ${
          state.realEstateLoading
            ? renderRealEstateEmpty("loader", "Carregando seus anuncios...")
            : error &&
                (error === "broker_required" || error === "business_required")
              ? renderRealEstateEmpty(
                  "lock",
                  "Area disponivel apenas para corretores ou imobiliarias.",
                )
              : listings.length
                ? `<div class="realestate-list">${listings.map(renderMyRealEstateCard).join("")}</div>`
                : renderRealEstateEmpty(
                    "clipboard-list",
                    "Voce ainda nao possui anuncios.",
                  )
        }
      </div>
    </div>
  `;
}

function renderMyRealEstateCard(listing) {
  const title = realEstateSafeText(listing.title, "Imovel anunciado");
  const code = window.Utils.escapeHtmlAttr(listingCodeFrom(listing));
  const status = listing.status || "";
  const canArchive = status !== "archived";
  const nextStatus = status === "active" ? "paused" : "active";
  const nextLabel = status === "active" ? "Pausar" : "Ativar";
  const openAction = code
    ? `window.RealEstateApp.openListing('${code}', 'mine')`
    : "window.RealEstateApp.notifyInvalidListing()";
  const editAction = code
    ? `window.RealEstateApp.editListing('${code}')`
    : "window.RealEstateApp.notifyInvalidListing()";

  return `
    <div class="realestate-my-card">
      <div class="realestate-my-main">
        <div>
          <span class="realestate-tag-inline">${window.Utils.escapeHtml(realEstateTypeLabel(listing.listingType, listing.typeLabel))}</span>
          <span class="realestate-status is-${window.Utils.escapeHtmlAttr(status || "unknown")}">${window.Utils.escapeHtml(realEstateStatusLabel(status))}</span>
        </div>
        <div class="realestate-card-title">${window.Utils.escapeHtml(title)}</div>
        <div class="realestate-price">${window.Utils.escapeHtml(listing.formattedPrice || "Sob consulta")}</div>
        <div class="realestate-card-broker">${window.Utils.escapeHtml(listing.propertyLabel || listing.propertyCode || "")}</div>
      </div>

      <div class="realestate-my-actions">
        <button onclick="${openAction}"><i data-lucide="eye"></i><span>Ver</span></button>
        <button onclick="${editAction}"><i data-lucide="pencil"></i><span>Editar</span></button>
        ${
          canArchive
            ? `<button onclick="window.RealEstateApp.setStatus('${code}', '${nextStatus}')"><i data-lucide="${status === "active" ? "pause" : "play"}"></i><span>${nextLabel}</span></button>`
            : ""
        }
        ${
          canArchive
            ? `<button onclick="window.RealEstateApp.archiveListing('${code}')"><i data-lucide="archive"></i><span>Remover</span></button>`
            : ""
        }
      </div>
    </div>
  `;
}

function renderRealEstateForm(state) {
  const canManage = realEstateAccessAllowed(state);
  if (!canManage) {
    return renderRealEstateSimplePage(
      "Anuncio",
      renderRealEstateEmpty(
        "lock",
        "Apenas corretores ou imobiliarias podem criar anuncios.",
      ),
    );
  }

  const mode = state.realEstateFormMode || "create";
  const isEdit = mode === "edit";
  const form = getRealEstateForm(state);
  const properties = window.AppContract.realestate.getProperties(state);
  const busy = state.realEstateActionBusy === true || state.realEstateSaving === true;
  const createBlockMessage = getCreateBlockReason(state, form, properties, isEdit);
  const createBlocked = createBlockMessage !== "";
  const priceMin = form.listingType === "sale" || form.listingType === "rent" ? 1 : 0;
  const pricePlaceholder = form.listingType === "visit" || form.listingType === "showcase" ? "0" : "350000";

  if (state.realEstateLoading && isEdit) {
    return renderRealEstateSimplePage(
      "Editar",
      renderRealEstateEmpty("loader", "Carregando anuncio..."),
    );
  }

  return `
    <div class="app-page realestate-page">
      ${renderRealEstateHeader(isEdit ? "Editar anuncio" : "Novo anuncio")}

      <div class="app-content realestate-form">
        <label class="realestate-field">
          <span>Tipo</span>
          <select onchange="window.RealEstateApp.updateForm('listingType', this.value)">
            <option value="sale" ${form.listingType === "sale" ? "selected" : ""}>Venda</option>
            <option value="rent" ${form.listingType === "rent" ? "selected" : ""}>Aluguel</option>
            <option value="visit" ${form.listingType === "visit" ? "selected" : ""}>Visita</option>
            <option value="showcase" ${form.listingType === "showcase" ? "selected" : ""}>Vitrine</option>
          </select>
        </label>

        ${
          isEdit
            ? `
              <div class="realestate-field-static">
                <span>Imovel base</span>
                <strong>${window.Utils.escapeHtml(form.propertyCode || "Ja definido")}</strong>
              </div>
            `
            : renderPropertySelect(properties, form.propertyCode, state.realEstatePropertiesLoading === true)
        }

        <label class="realestate-field">
          <span>Titulo</span>
          <input value="${window.Utils.escapeHtmlAttr(form.title)}" maxlength="80" oninput="window.RealEstateApp.updateForm('title', this.value)" placeholder="Titulo do anuncio" />
        </label>

        <label class="realestate-field">
          <span>Descricao</span>
          <textarea maxlength="800" oninput="window.RealEstateApp.updateForm('description', this.value)" placeholder="Descricao do anuncio">${window.Utils.escapeHtml(form.description)}</textarea>
        </label>

        <label class="realestate-field">
          <span>Preco</span>
          <input type="number" min="${priceMin}" value="${window.Utils.escapeHtmlAttr(form.price)}" oninput="window.RealEstateApp.updateForm('price', this.value)" placeholder="${pricePlaceholder}" />
        </label>

        <label class="realestate-field">
          <span>Telefone</span>
          <input value="${window.Utils.escapeHtmlAttr(form.signPhone)}" maxlength="40" oninput="window.RealEstateApp.updateForm('signPhone', this.value)" placeholder="Telefone do contato" />
        </label>

        <label class="realestate-field">
          <span>Corretor/Imobiliaria</span>
          <input value="${window.Utils.escapeHtmlAttr(form.signBrokerName)}" maxlength="120" oninput="window.RealEstateApp.updateForm('signBrokerName', this.value)" placeholder="Nome exibido" />
        </label>

        <label class="realestate-check">
          <input type="checkbox" ${form.showSign ? "checked" : ""} onchange="window.RealEstateApp.updateForm('showSign', this.checked)" />
          <span>Exibir placa no mundo</span>
        </label>

        ${
          createBlocked
            ? `${renderCreateBlockNote(createBlockMessage)}${renderCreateChecklist()}`
            : isEdit
              ? renderRealEstatePhotoManager(state)
              : `<div class="realestate-form-note">Salve o anuncio para adicionar fotos.</div>`
        }

        <button type="button" data-realestate-action="save-listing" class="realestate-save ${createBlocked ? "is-disabled" : ""}" onclick="window.RealEstateApp.saveForm(event)" ${busy ? "disabled" : ""} aria-disabled="${createBlocked ? "true" : "false"}">
          <i data-lucide="${busy ? "loader" : "save"}"></i>
          <span>${busy ? "Salvando..." : "Salvar"}</span>
        </button>

        ${state.realEstatePhotoPickerOpen ? renderRealEstateGalleryPicker(state) : ""}
      </div>
    </div>
  `;
}

function realEstatePhotoImage(photo) {
  return photo?.thumbnailUrl || photo?.thumbnail_url || photo?.imageUrl || photo?.image_url || "";
}

function realEstatePhotoDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function getGalleryPhotoId(photo) {
  const id = photo?.id ?? photo?.photoId ?? photo?.photo_id ?? photo?.galleryPhotoId ?? photo?.gallery_photo_id;
  const numeric = Number(id);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function listingCodeFrom(value) {
  if (!value || typeof value !== "object") return "";
  return String(
    value.listingCode ||
      value.listing_code ||
      value.code ||
      value.id ||
      "",
  ).trim();
}

function getCurrentEditingListingCode(state = window.PhoneApp.getState()) {
  return (
    listingCodeFrom(state.realEstateSelectedListing) ||
    listingCodeFrom(state.realEstateForm) ||
    String(state.realEstateEditingListingCode || "").trim()
  );
}

function findRealEstateListingFallback(state, listingCode, source) {
  const code = String(listingCode || "").trim();
  if (!code) return null;

  const sourceName = String(source || "").trim();
  const fromMine = sourceName === "mine" || source === true;
  const listings = fromMine
    ? window.AppContract.realestate.getMine(state)
    : window.AppContract.realestate.getListings(state);

  return listings.find((listing) => listingCodeFrom(listing) === code) || null;
}

function currentListingForMedia(state, listingCode) {
  const selected =
    state.realEstateSelectedListing &&
    typeof state.realEstateSelectedListing === "object"
      ? state.realEstateSelectedListing
      : {};

  return {
    ...selected,
    listingCode,
  };
}

function renderRealEstatePhotoManager(state) {
  const listing = window.AppContract.realestate.getSelected(state);
  const photos = Array.isArray(listing?.photos) ? listing.photos : [];
  const busy = state.realEstatePhotoBusy === true;

  return `
    <div class="realestate-photo-section">
      <div class="realestate-section-title">Fotos do anuncio</div>

      <div class="realestate-photo-actions">
        <button type="button" onclick="window.RealEstateApp.openGalleryPicker()" ${busy ? "disabled" : ""}>
          <i data-lucide="image-plus"></i>
          <span>Adicionar da Galeria</span>
        </button>
        <button type="button" onclick="window.RealEstateApp.openCameraShortcut()" ${busy ? "disabled" : ""}>
          <i data-lucide="camera"></i>
          <span>Tirar nova foto</span>
        </button>
      </div>

      ${
        photos.length
          ? `<div class="realestate-photo-grid">${photos.map((photo) => renderRealEstateListingPhoto(photo, listing, busy)).join("")}</div>`
          : `<div class="realestate-photo-empty">Nenhuma foto neste anuncio.</div>`
      }
    </div>
  `;
}

function renderRealEstateListingPhoto(photo, listing, busy) {
  const image = realEstatePhotoImage(photo);
  const photoId = window.Utils.escapeHtmlAttr(photo.id || "");
  const listingCode = window.Utils.escapeHtmlAttr(listing?.listingCode || "");

  return `
    <div class="realestate-photo-card">
      ${
        image
          ? `<img src="${window.Utils.escapeHtmlAttr(image)}" alt="${window.Utils.escapeHtmlAttr(photo.caption || "Foto do anuncio")}" loading="lazy" />`
          : `<div class="realestate-photo-placeholder"><i data-lucide="image-off"></i></div>`
      }
      <div class="realestate-photo-card-body">
        <div class="realestate-photo-card-top">
          ${photo.isPrimary ? `<span class="realestate-primary-badge">Principal</span>` : `<span></span>`}
          <span>${window.Utils.escapeHtml(realEstatePhotoDate(photo.createdAt || photo.created_at))}</span>
        </div>
        <div class="realestate-photo-card-actions">
          ${
            photo.isPrimary
              ? ""
              : `<button type="button" onclick="window.RealEstateApp.setPrimaryPhoto('${listingCode}', '${photoId}')" ${busy ? "disabled" : ""}>Capa</button>`
          }
          <button type="button" class="is-danger" onclick="window.RealEstateApp.removePhoto('${listingCode}', '${photoId}')" ${busy ? "disabled" : ""}>Remover</button>
        </div>
      </div>
    </div>
  `;
}

function renderRealEstateGalleryPicker(state) {
  const photos = window.AppContract.gallery.get(state);
  const loading = state.realEstatePhotoPickerLoading === true;
  const busy = state.realEstatePhotoBusy === true;

  return `
    <div class="realestate-picker" role="dialog" aria-modal="true">
      <div class="realestate-picker-panel">
        <div class="realestate-picker-header">
          <div>
            <div class="realestate-section-title">Escolher da Galeria</div>
            <div class="realestate-picker-subtitle">${photos.length} foto${photos.length === 1 ? "" : "s"}</div>
          </div>
          <button type="button" class="realestate-picker-close" onclick="window.RealEstateApp.closeGalleryPicker()" aria-label="Fechar">
            <i data-lucide="x"></i>
          </button>
        </div>

        <div class="realestate-picker-body">
          ${
            loading
              ? renderRealEstateEmpty("loader", "Carregando galeria...")
              : photos.length
                ? `<div class="realestate-picker-grid">${photos.map((photo) => renderRealEstateGalleryOption(photo, busy)).join("")}</div>`
                : `<div class="realestate-photo-empty">Nenhuma foto na galeria.</div>`
          }
        </div>
      </div>
    </div>
  `;
}

function renderRealEstateGalleryOption(photo, busy) {
  const image = realEstatePhotoImage(photo);
  const photoId = window.Utils.escapeHtmlAttr(photo.id || "");
  const caption = photo.caption || realEstatePhotoDate(photo.created_at || photo.createdAt) || "Foto";

  return `
    <div class="realestate-picker-photo">
      ${
        image
          ? `<img src="${window.Utils.escapeHtmlAttr(image)}" alt="${window.Utils.escapeHtmlAttr(caption)}" loading="lazy" />`
          : `<div class="realestate-photo-placeholder"><i data-lucide="image-off"></i></div>`
      }
      <button type="button" onclick="window.RealEstateApp.attachGalleryPhoto('${photoId}')" ${busy ? "disabled" : ""}>
        ${busy ? "Anexando..." : "Usar esta foto"}
      </button>
    </div>
  `;
}

function renderPropertySelect(properties, selectedCode, loading = false) {
  if (loading && !properties.length) {
    return `
      <div class="realestate-field-static">
        <span>Imovel base</span>
        <strong>Carregando imoveis disponiveis...</strong>
      </div>
    `;
  }

  if (!properties.length) {
    return `
      <div class="realestate-field-static">
        <span>Imovel base</span>
        <strong>Nenhum imovel disponivel para anunciar.</strong>
        <small>Cadastre/libere um imovel no sistema imobiliario antes de criar anuncio.</small>
      </div>
    `;
  }

  return `
    <label class="realestate-field">
      <span>Imovel</span>
      <select onchange="window.RealEstateApp.updateForm('propertyCode', this.value)">
        <option value="">Selecione</option>
        ${properties
          .map((property) => {
            const code = property.code || "";
            const label = property.label || code;
            return `
              <option value="${window.Utils.escapeHtmlAttr(code)}" ${selectedCode === code ? "selected" : ""}>
                ${window.Utils.escapeHtml(label)}
              </option>
            `;
          })
          .join("")}
      </select>
    </label>
  `;
}

function renderCreateBlockNote(message) {
  return `
    <div class="realestate-form-note is-warning">
      ${window.Utils.escapeHtml(message)}
    </div>
  `;
}

function renderCreateChecklist() {
  return `
    <div class="realestate-create-checklist">
      <div>Para criar um anuncio:</div>
      <ol>
        <li>O imovel precisa existir no mz_houses.</li>
        <li>O imovel precisa estar ativo/listavel.</li>
        <li>Voce precisa ser corretor/imobiliaria autorizada.</li>
      </ol>
    </div>
  `;
}

function renderRealEstateSimplePage(title, content) {
  return `
    <div class="app-page realestate-page">
      ${renderRealEstateHeader(title)}
      <div class="app-content realestate-content">${content}</div>
    </div>
  `;
}

function realEstateErrorText(error) {
  if (error === "realestate_unavailable")
    return "Sistema de imoveis indisponivel.";
  if (error === "broker_required" || error === "business_required")
    return "Apenas corretores ou imobiliarias podem criar anuncios.";
  if (error === "properties_failed" || error === "houses_unavailable")
    return "Nao foi possivel carregar os imoveis base.";
  if (error === "property_not_found" || error === "house_not_found")
    return "Imovel base nao encontrado.";
  if (
    error === "not_listable" ||
    error === "property_not_advertisable" ||
    error === "disabled" ||
    error === "archived" ||
    error === "hidden" ||
    error === "not_residential" ||
    error === "not_player_property" ||
    error === "org_property"
  ) {
    return "Este imovel nao esta liberado para anuncio.";
  }
  if (error === "listing_unavailable" || error === "listing_not_found")
    return "Nao foi possivel carregar este anuncio.";
  if (error === "invalid_listing") return "Anuncio invalido.";
  if (error === "rate_limited")
    return "Aguarde um instante para tentar de novo.";
  return "Nao foi possivel carregar os imoveis.";
}

function getRealEstateForm(state) {
  const access = window.AppContract.realestate.getAccess(state);
  const form =
    state.realEstateForm && typeof state.realEstateForm === "object"
      ? state.realEstateForm
      : {};

  return {
    listingType: form.listingType || "sale",
    listingCode: form.listingCode || "",
    propertyCode: form.propertyCode || "",
    title: form.title || "",
    description: form.description || "",
    price: form.price ?? "",
    signPhone: form.signPhone || access.brokerPhone || "",
    signBrokerName: form.signBrokerName || access.brokerName || "",
    showSign: form.showSign === true,
  };
}

function notifyRealEstateError(message) {
  const isOpen = window.PhoneApp?.isActuallyOpen?.() === true;
  const state = window.PhoneApp?.getState?.();
  const isActiveApp = state?.currentApp === "realestate";

  if (isOpen && isActiveApp) {
    window.PhoneApp?.maintainOpenIfAlreadyOpen?.("realestate_error_before");
    window.PhoneApp?.clearNotificationPreview?.("realestate_error_notify");
  }

  if (window.PhoneUI?.notify) {
    window.PhoneUI.notify({
      type: "warning",
      title: "Imoveis",
      message,
      preventPreview: true,
      keepPhoneOpen: true,
      scope: "in-app",
    });
  }

  if (isOpen && isActiveApp) {
    window.PhoneApp?.maintainOpenIfAlreadyOpen?.("realestate_error_after");
  }
}

function notifyRealEstateSuccess(message) {
  const isOpen = window.PhoneApp?.isActuallyOpen?.() === true;
  const state = window.PhoneApp?.getState?.();
  const isActiveApp = state?.currentApp === "realestate";

  if (isOpen && isActiveApp) {
    keepRealEstatePhoneOpen("realestate_success_before");
  }

  window.PhoneUI?.notify?.({
    type: "success",
    title: "Imoveis",
    message,
    preventPreview: true,
    keepPhoneOpen: true,
    scope: "in-app",
  });

  if (isOpen && isActiveApp) {
    keepRealEstatePhoneOpen("realestate_success_after");
  }
}

function validateRealEstateForm(form, isEdit) {
  const allowedTypes = ["sale", "rent", "visit", "showcase"];
  if (!allowedTypes.includes(form.listingType)) {
    return "Escolha venda, aluguel, visita ou vitrine.";
  }

  if (!isEdit && !form.propertyCode) {
    return "Selecione um imovel para criar o anuncio.";
  }

  if (String(form.title || "").trim().length < 3) {
    return "Informe um titulo com pelo menos 3 letras.";
  }

  const price = Number(form.price || 0);
  if ((form.listingType === "sale" || form.listingType === "rent") && price <= 0) {
    return "Informe um preco positivo.";
  }
  if (price < 0) {
    return "Informe um preco valido.";
  }

  return "";
}

function getCreateBlockReason(state, form, properties, isEdit) {
  if (isEdit) return "";

  if (!realEstateAccessAllowed(state)) {
    return "Apenas corretores ou imobiliarias podem criar anuncios.";
  }

  if (state.realEstatePropertiesLoading === true && !properties.length) {
    return "Carregando imoveis disponiveis...";
  }

  if (state.realEstatePropertiesError) {
    return realEstateErrorText(state.realEstatePropertiesError);
  }

  if (!properties.length) {
    return "Nenhum imovel disponivel para anunciar. Cadastre/libere um imovel no sistema imobiliario antes de criar anuncio.";
  }

  if (!form.propertyCode) {
    return "Selecione um Imovel base.";
  }

  return "";
}

async function loadRealEstateListings(tab = "all") {
  const listingType = realEstateFilterFromTab(tab);

  window.PhoneApp.patchState({
    realEstateLoading: true,
    realEstateError: "",
  });
  window.PhoneApp.renderCurrentApp();

  await window.PhoneAPI?.getRealEstateListings?.({ listingType });
}

function loadBrokerArea() {
  window.PhoneApp.patchState({
    realEstateLoading: true,
    realEstateError: "",
  });
  window.PhoneApp.renderCurrentApp();

  window.PhoneAPI?.getRealEstateProperties?.();
  window.PhoneAPI?.getMyRealEstateListings?.();
}

window.RealEstateApp = {
  notifyInvalidListing() {
    notifyRealEstateError("Anuncio nao encontrado.");
  },

  setTab(tab) {
    window.PhoneApp.patchState({
      realEstateTab: tab,
      realEstateSelectedListing: null,
      realEstateView: "list",
      realEstatePhotoPickerOpen: false,
    });

    loadRealEstateListings(tab);
  },

  refresh() {
    const state = window.PhoneApp.getState();
    if (state.realEstateView === "detail") {
      const code = listingCodeFrom(state.realEstateSelectedListing);
      if (code) {
        this.openListing(code, state.realEstateReturnView === "mine" ? "mine" : "public");
        return;
      }
    }
    if (state.realEstateView === "mine") {
      loadBrokerArea();
      return;
    }
    loadRealEstateListings(state.realEstateTab || "all");
  },

  openMine() {
    window.PhoneApp.patchState({
      realEstateView: "mine",
      realEstateSelectedListing: null,
      realEstateError: "",
      realEstateReturnView: "mine",
      realEstatePhotoPickerOpen: false,
    });
    loadBrokerArea();
  },

  openCreateForm() {
    const state = window.PhoneApp.getState();
    const access = window.AppContract.realestate.getAccess(state);
    if (access.allowed !== true) {
      notifyRealEstateError("Apenas corretores ou imobiliarias podem criar anuncios.");
      return;
    }

    window.PhoneApp.patchState({
      realEstateView: "form",
      realEstateFormMode: "create",
      realEstateSelectedListing: null,
      realEstateEditingListingCode: "",
      realEstateReturnView: "mine",
      realEstateError: "",
      realEstatePropertiesLoading: true,
      realEstatePropertiesError: "",
      realEstateActionBusy: false,
      realEstateSaving: false,
      realEstateLastError: null,
      realEstatePhotoBusy: false,
      realEstatePhotoPickerOpen: false,
      realEstateForm: {
        listingType: "sale",
        propertyCode: "",
        title: "",
        description: "",
        price: "",
        signPhone: access.brokerPhone || "",
        signBrokerName: access.brokerName || "",
        showSign: false,
      },
    });

    window.PhoneAPI?.getRealEstateProperties?.();
    window.PhoneApp.renderCurrentApp();
  },

  editListing(listingCode) {
    const code = String(listingCode || "").trim();
    if (!code) {
      this.notifyInvalidListing();
      return;
    }

    window.PhoneApp.patchState({
      realEstateView: "form",
      realEstateFormMode: "edit",
      realEstateEditingListingCode: code,
      realEstateSelectedListing: null,
      realEstateReturnView: "mine",
      realEstateLoading: true,
      realEstateError: "",
      realEstatePhotoPickerOpen: false,
      realEstateForm: {
        listingCode: code,
      },
    });
    window.PhoneApp.renderCurrentApp();

    window.PhoneAPI?.getMyRealEstateListing?.(code);
  },

  updateForm(key, value) {
    const state = window.PhoneApp.getState();
    window.PhoneApp.patchState({
      realEstateForm: {
        ...(state.realEstateForm || {}),
        [key]: value,
      },
    });

    if (key === "propertyCode" || key === "listingType") {
      window.PhoneApp.renderCurrentApp();
    }
  },

  async saveForm(event) {
    preventRealEstateSubmitEvent(event);
    keepRealEstatePhoneOpen("realestate_save_click");

    const state = window.PhoneApp.getState();
    const isEdit = state.realEstateFormMode === "edit";
    if (state.realEstateSaving === true || state.realEstateActionBusy === true) {
      debugRealEstate("create", {
        action: "ignored busy click",
        mode: isEdit ? "edit" : "create",
      });
      return;
    }

    const form = getRealEstateForm(state);
    const properties = window.AppContract.realestate.getProperties(state);
    const blockReason = getCreateBlockReason(state, form, properties, isEdit);
    debugRealEstate("create", {
      action: "save click",
      mode: isEdit ? "edit" : "create",
      propertyCode: form.propertyCode,
      blocked: blockReason || false,
    });

    if (blockReason) {
      notifyRealEstateError(blockReason);
      return;
    }

    const validation = validateRealEstateForm(form, isEdit);

    if (validation) {
      debugRealEstate("create", {
        action: "validation failed",
        reason: validation,
        propertyCode: form.propertyCode,
      });
      notifyRealEstateError(validation);
      return;
    }

    debugRealEstate("create", {
      action: "validation ok",
      propertyCode: form.propertyCode,
      listingType: form.listingType,
    });

    window.PhoneApp.patchState({
      isOpen: true,
      realEstateActionBusy: true,
      realEstateSaving: true,
      realEstateLastError: null,
    });
    keepRealEstatePhoneOpen("realestate_save_before_render");
    window.PhoneApp.renderCurrentApp();
    keepRealEstatePhoneOpen("realestate_save_after_render");
    armRealEstateSaveTimeout();

    try {
      if (isEdit) {
        const code = getCurrentEditingListingCode(state);
        if (!code) {
          clearRealEstateSaveTimeout();
          notifyRealEstateError("Anuncio nao encontrado.");
          window.PhoneApp.patchState({
            realEstateActionBusy: false,
            realEstateSaving: false,
            realEstateLastError: "invalid_listing",
          });
          keepRealEstatePhoneOpen("realestate_save_invalid_listing");
          window.PhoneApp.renderCurrentApp();
          return;
        }
        const response = await window.PhoneAPI?.updateRealEstateListing?.(code, form);
        if (response?.ok === false) {
          clearRealEstateSaveTimeout();
          debugRealEstate("create", {
            action: "response ok=false",
            mode: "edit",
            error: response.error || "update_failed",
          });
          notifyRealEstateError(response.message || realEstateErrorText(response.error) || "Nao foi possivel atualizar o anuncio.");
          window.PhoneApp.patchState({
            realEstateActionBusy: false,
            realEstateSaving: false,
            realEstateLastError: response.error || "update_failed",
          });
          keepRealEstatePhoneOpen("realestate_update_callback_error");
          window.PhoneApp.renderCurrentApp();
        } else if (!response || response.ok !== true) {
          clearRealEstateSaveTimeout();
          notifyRealEstateError("Nao foi possivel enviar a atualizacao.");
          window.PhoneApp.patchState({
            realEstateActionBusy: false,
            realEstateSaving: false,
            realEstateLastError: "request_failed",
          });
          keepRealEstatePhoneOpen("realestate_update_request_failed");
          window.PhoneApp.renderCurrentApp();
        }
        return;
      }

      debugRealEstate("create", {
        action: "sending payload",
        propertyCode: form.propertyCode,
        listingType: form.listingType,
      });
      const response = await window.PhoneAPI?.createRealEstateListing?.(form);
      if (response?.ok === false) {
        clearRealEstateSaveTimeout();
        debugRealEstate("create", {
          action: "response ok=false",
          mode: "create",
          error: response.error || "create_failed",
        });
        notifyRealEstateError(response.message || realEstateErrorText(response.error) || "Nao foi possivel criar o anuncio.");
        window.PhoneApp.patchState({
          realEstateActionBusy: false,
          realEstateSaving: false,
          realEstateLastError: response.error || "create_failed",
        });
        keepRealEstatePhoneOpen("realestate_create_callback_error");
        window.PhoneApp.renderCurrentApp();
      } else if (!response || response.ok !== true) {
        clearRealEstateSaveTimeout();
        notifyRealEstateError("Nao foi possivel enviar o anuncio.");
        window.PhoneApp.patchState({
          realEstateActionBusy: false,
          realEstateSaving: false,
          realEstateLastError: "request_failed",
        });
        keepRealEstatePhoneOpen("realestate_create_request_failed");
        window.PhoneApp.renderCurrentApp();
      }
    } catch (error) {
      clearRealEstateSaveTimeout();
      console.error("[realestate:create] save failed", error);
      window.PhoneApp.patchState({
        realEstateActionBusy: false,
        realEstateSaving: false,
        realEstateLastError: "request_failed",
      });
      keepRealEstatePhoneOpen("realestate_save_exception");
      notifyRealEstateError("Nao foi possivel enviar o anuncio.");
      window.PhoneApp.renderCurrentApp();
    }
  },

  clearSaveTimeout() {
    clearRealEstateSaveTimeout();
  },

  keepPhoneOpen(reason) {
    keepRealEstatePhoneOpen(reason || "realestate_keep_open_external");
  },

  notifySaveSuccess(message) {
    notifyRealEstateSuccess(message || "Anuncio salvo.");
  },

  async setStatus(listingCode, status) {
    const code = String(listingCode || "").trim();
    if (!code) {
      this.notifyInvalidListing();
      return;
    }

    window.PhoneApp.patchState({ realEstateActionBusy: true });
    window.PhoneApp.renderCurrentApp();
    await window.PhoneAPI?.setRealEstateListingStatus?.(code, status);
  },

  archiveListing(listingCode) {
    const code = String(listingCode || "").trim();
    if (!code) {
      this.notifyInvalidListing();
      return;
    }

    window.PhoneDialog?.confirm?.({
      title: "Remover anuncio?",
      message:
        "Este anuncio sera arquivado e nao aparecera mais na lista publica.",
      confirmText: "Remover",
      cancelText: "Cancelar",
      tone: "danger",
      app: "realestate",
      onConfirm: () => this.setStatus(code, "archived"),
    });
  },

  async openListing(listingCode, source = "public") {
    const code = String(listingCode || "").trim();
    if (!code) {
      this.notifyInvalidListing();
      return;
    }
    const sourceName = String(source || "").trim();
    const fromMine = sourceName === "mine" || source === true;
    const fallbackListing = findRealEstateListingFallback(
      window.PhoneApp.getState(),
      code,
      source,
    );

    window.PhoneApp.patchState({
      realEstateView: "detail",
      realEstateSelectedListing: fallbackListing,
      realEstateReturnView: fromMine ? "mine" : "list",
      realEstateLoading: true,
      realEstateError: "",
      realEstatePhotoPickerOpen: false,
    });
    window.PhoneApp.renderCurrentApp();

    if (fromMine) {
      await window.PhoneAPI?.getMyRealEstateListing?.(code);
      return;
    }

    await window.PhoneAPI?.getRealEstateListing?.(code);
  },

  back() {
    const state = window.PhoneApp.getState();

    if (state.realEstateView === "detail") {
      const returnView = state.realEstateReturnView === "mine" ? "mine" : "list";
      window.PhoneApp.patchState({
        realEstateView: returnView,
        realEstateSelectedListing: null,
        realEstateError: "",
        realEstatePhotoPickerOpen: false,
      });
      window.PhoneApp.renderCurrentApp();
      if (returnView === "mine") {
        loadBrokerArea();
      }
      return;
    }

    if (state.realEstateView === "mine") {
      window.PhoneApp.patchState({
        realEstateView: "list",
        realEstateError: "",
        realEstatePhotoPickerOpen: false,
      });
      window.PhoneApp.renderCurrentApp();
      return;
    }

    if (state.realEstateView === "form") {
      window.PhoneApp.patchState({
        realEstateView: "mine",
        realEstateSelectedListing: null,
        realEstateForm: {},
        realEstateError: "",
        realEstatePhotoPickerOpen: false,
      });
      loadBrokerArea();
      return;
    }

    window.goHome();
  },

  async markGps() {
    const listing = window.PhoneApp.getState().realEstateSelectedListing;
    const coords = listing?.coords || {};
    const x = Number(coords.x);
    const y = Number(coords.y);

    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    const result = await window.PhoneAPI?.setWaypoint?.({ x, y });
    if (result?.ok === false) {
      window.PhoneUI?.notify?.({
        type: "error",
        title: "Imoveis",
        message: "Nao foi possivel marcar o GPS.",
      });
      return;
    }

    window.PhoneUI?.notify?.({
      type: "success",
      title: "Imoveis",
      message: "GPS marcado para o imovel.",
    });
  },

  async callBroker() {
    const listing = window.PhoneApp.getState().realEstateSelectedListing;
    const phone = String(
      listing?.brokerPhone || listing?.phone || listing?.agencyPhone || "",
    ).trim();
    if (!phone) return;

    await window.PhoneAPI?.callUser?.(phone);
  },

  async messageBroker() {
    const state = window.PhoneApp.getState();
    const listing = state.realEstateSelectedListing;
    const phone = String(
      listing?.brokerPhone || listing?.phone || listing?.agencyPhone || "",
    ).trim();
    if (!phone) return;

    const myNumber = String(state.playerProfile?.phoneNumber || "");
    if (myNumber && myNumber === phone) {
      window.PhoneUI?.notify?.({
        type: "warning",
        title: "Imoveis",
        message: "Este numero e o seu proprio telefone.",
      });
      return;
    }

    await window.PhoneAPI?.createConversation?.({
      target_number: phone,
      target_name: listing?.brokerName || listing?.agencyName || "Imoveis",
    });

    window.PhoneApp.patchState({
      pendingOpenConversationNumber: phone,
    });

    await window.PhoneAPI?.getConversations?.();
    window.openApp("messages");
  },

  setDetailCover(imageUrl) {
    try {
      imageUrl = decodeURIComponent(String(imageUrl || ""));
    } catch (_) {
      imageUrl = "";
    }
    const state = window.PhoneApp.getState();
    const listing = state.realEstateSelectedListing;
    if (!listing || !imageUrl) return;

    window.PhoneApp.patchState({
      realEstateSelectedListing: {
        ...listing,
        coverImage: imageUrl,
      },
    });
    window.PhoneApp.renderCurrentApp();
  },

  openGalleryPicker() {
    const state = window.PhoneApp.getState();
    const listingCode = getCurrentEditingListingCode(state);
    if (!listingCode) {
      notifyRealEstateError("Anuncio invalido para anexar foto.");
      return;
    }

    const listing = currentListingForMedia(state, listingCode);

    window.PhoneMedia?.openGalleryForResult?.({
      returnTo: "realestate",
      type: "image",
      purpose: "realestate_listing_photo",
      returnApp: "realestate",
      context: {
        listingCode,
        mode: "attach_listing_photo",
      },
      returnState: {
        realEstateView: "form",
        realEstateFormMode: "edit",
        realEstateSelectedListing: listing,
        realEstateForm: state.realEstateForm || {},
        realEstateProperties: state.realEstateProperties || [],
        realEstateAccess: state.realEstateAccess || null,
        realEstateError: "",
        realEstateLoading: false,
        realEstateActionBusy: false,
        realEstatePhotoBusy: false,
        realEstatePhotoPickerOpen: false,
        realEstatePhotoPickerLoading: false,
      },
    });
  },

  closeGalleryPicker() {
    window.PhoneApp.patchState({
      realEstatePhotoPickerOpen: false,
      realEstatePhotoPickerLoading: false,
    });
    window.PhoneApp.renderCurrentApp();
  },

  async attachGalleryPhoto(photoId) {
    const state = window.PhoneApp.getState();
    const listingCode = getCurrentEditingListingCode(state);
    const galleryPhotoId = Number(photoId);
    if (!listingCode) {
      notifyRealEstateError("Anuncio invalido para anexar foto.");
      return;
    }

    if (!Number.isFinite(galleryPhotoId) || galleryPhotoId <= 0) {
      notifyRealEstateError("Foto indisponivel para selecao.");
      return;
    }

    window.PhoneApp.patchState({ realEstatePhotoBusy: true });
    window.PhoneApp.renderCurrentApp();
    await window.PhoneAPI?.attachRealEstateGalleryPhoto?.(listingCode, galleryPhotoId);
  },

  async applyMediaResult(result, context, request = {}) {
    const mediaContext =
      context && typeof context === "object" && context.context
        ? context.context
        : context || {};
    const mediaRequest =
      request && Object.keys(request).length
        ? request
        : context && typeof context === "object" && context.context
          ? context
          : {};
    const listingCode = String(
      mediaContext?.listingCode ||
        getCurrentEditingListingCode(window.PhoneApp.getState()) ||
        "",
    ).trim();
    const galleryPhotoId = getGalleryPhotoId(result);
    const purpose = mediaRequest?.purpose || "";
    const mode = mediaContext?.mode || "";
    const cameFromCamera =
      mediaRequest?.kind === "camera" ||
      purpose === "realestate_listing_camera" ||
      mode === "attach_listing_photo_after_camera" ||
      result?.source === "camera";

    if (
      purpose !== "realestate_listing_photo" &&
      purpose !== "realestate_listing_camera" &&
      mode !== "attach_listing_photo" &&
      mode !== "attach_listing_photo_after_camera"
    ) {
      return false;
    }

    if (!listingCode) {
      notifyRealEstateError("Anuncio invalido para anexar foto.");
      return true;
    }

    if (!galleryPhotoId) {
      notifyRealEstateError(
        cameFromCamera
          ? "Foto salva na Galeria. Abra Adicionar da Galeria para anexar ao anuncio."
          : "Foto indisponivel para selecao.",
      );
      return true;
    }

    window.PhoneApp.patchState({
      realEstatePhotoBusy: true,
      realEstatePhotoPickerOpen: false,
      realEstatePhotoPickerLoading: false,
    });
    window.PhoneApp.renderCurrentApp();
    await window.PhoneAPI?.attachRealEstateGalleryPhoto?.(listingCode, galleryPhotoId);
    return true;
  },

  async setPrimaryPhoto(listingCode, photoId) {
    const code = String(listingCode || "").trim();
    const id = Number(photoId);
    if (!code || !Number.isFinite(id)) return;

    window.PhoneApp.patchState({ realEstatePhotoBusy: true });
    window.PhoneApp.renderCurrentApp();
    await window.PhoneAPI?.setRealEstatePrimaryPhoto?.(code, id);
  },

  async removePhoto(listingCode, photoId) {
    const code = String(listingCode || "").trim();
    const id = Number(photoId);
    if (!code || !Number.isFinite(id)) return;

    window.PhoneDialog?.confirm?.({
      title: "Remover foto?",
      message: "Esta foto sera removida do anuncio.",
      confirmText: "Remover",
      cancelText: "Cancelar",
      tone: "danger",
      app: "realestate",
      onConfirm: async () => {
        window.PhoneApp.patchState({ realEstatePhotoBusy: true });
        window.PhoneApp.renderCurrentApp();
        await window.PhoneAPI?.removeRealEstatePhoto?.(code, id);
      },
    });
  },

  openCameraShortcut() {
    const state = window.PhoneApp.getState();
    const listingCode = getCurrentEditingListingCode(state);
    if (!listingCode) {
      notifyRealEstateError("Anuncio invalido para anexar foto.");
      return;
    }

    const listing = currentListingForMedia(state, listingCode);

    window.PhoneMedia?.openCameraForResult?.({
      returnTo: "realestate",
      type: "image",
      purpose: "realestate_listing_camera",
      returnApp: "realestate",
      context: {
        listingCode,
        mode: "attach_listing_photo_after_camera",
      },
      returnState: {
        realEstateView: "form",
        realEstateFormMode: "edit",
        realEstateSelectedListing: listing,
        realEstateForm: state.realEstateForm || {},
        realEstateProperties: state.realEstateProperties || [],
        realEstateAccess: state.realEstateAccess || null,
        realEstateError: "",
        realEstateLoading: false,
        realEstateActionBusy: false,
        realEstatePhotoBusy: false,
        realEstatePhotoPickerOpen: false,
        realEstatePhotoPickerLoading: false,
      },
    });
  },
};
