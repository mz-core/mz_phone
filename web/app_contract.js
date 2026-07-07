function realEstateContractText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function realEstateContractPhotoUrl(photo) {
  return realEstateContractText(
    photo?.imageUrl ??
      photo?.image_url ??
      photo?.url ??
      photo?.thumbnailUrl ??
      photo?.thumbnail_url ??
      "",
  );
}

function normalizeRealEstateContractPhoto(photo) {
  if (!photo || typeof photo !== "object") return null;

  const imageUrl = realEstateContractPhotoUrl(photo);
  const thumbnailUrl = realEstateContractText(
    photo.thumbnailUrl ?? photo.thumbnail_url ?? imageUrl,
  );

  return {
    ...photo,
    id: photo.id ?? photo.photoId ?? photo.photo_id ?? null,
    imageUrl,
    image_url: imageUrl,
    thumbnailUrl,
    thumbnail_url: thumbnailUrl,
    caption: realEstateContractText(photo.caption),
    isPrimary:
      photo.isPrimary === true ||
      photo.is_primary === true ||
      photo.is_primary === 1 ||
      photo.is_primary === "1",
    sortOrder: Number(photo.sortOrder ?? photo.sort_order ?? 0) || 0,
    createdAt: photo.createdAt ?? photo.created_at ?? "",
  };
}

function normalizeRealEstateContractListing(listing) {
  if (!listing || typeof listing !== "object") return null;

  const rawPhotos = Array.isArray(listing.photos)
    ? listing.photos
    : Array.isArray(listing.images)
      ? listing.images
      : [];
  const photos = rawPhotos
    .map(normalizeRealEstateContractPhoto)
    .filter(Boolean);
  const primaryPhoto = photos.find((photo) => photo.isPrimary);
  const coverImage = realEstateContractText(
    listing.coverImage ??
      listing.cover_image ??
      listing.coverUrl ??
      listing.cover_url ??
      listing.imageUrl ??
      listing.image_url ??
      listing.thumbnailUrl ??
      listing.thumbnail_url ??
      primaryPhoto?.imageUrl ??
      photos[0]?.imageUrl ??
      "",
  );
  const listingCode = realEstateContractText(
    listing.listingCode ?? listing.listing_code ?? listing.code ?? listing.id,
  );
  const coords =
    listing.coords && typeof listing.coords === "object"
      ? listing.coords
      : listing.location && typeof listing.location === "object"
        ? listing.location
        : listing.position && typeof listing.position === "object"
          ? listing.position
          : null;

  return {
    ...listing,
    raw: listing,
    listingCode,
    listing_code: listing.listing_code ?? listingCode,
    title: realEstateContractText(listing.title, "Imovel sem titulo"),
    description: realEstateContractText(
      listing.description,
      "Descricao indisponivel",
    ),
    listingType: realEstateContractText(
      listing.listingType ?? listing.listing_type ?? listing.type,
    ),
    typeLabel: realEstateContractText(listing.typeLabel ?? listing.type_label),
    price: listing.price ?? listing.value ?? null,
    formattedPrice: realEstateContractText(
      listing.formattedPrice ??
        listing.priceText ??
        listing.price_text ??
        listing.formatted_price,
      "Sob consulta",
    ),
    coverImage: coverImage || null,
    coverUrl: coverImage,
    photos,
    brokerName: realEstateContractText(
      listing.brokerName ??
        listing.broker_name ??
        listing.signBrokerName ??
        listing.sign_broker_name,
    ),
    brokerPhone: realEstateContractText(
      listing.brokerPhone ??
        listing.broker_phone ??
        listing.signPhone ??
        listing.sign_phone ??
        listing.phone ??
        listing.contact_phone,
    ),
    agencyName: realEstateContractText(listing.agencyName ?? listing.agency_name),
    agencyPhone: realEstateContractText(
      listing.agencyPhone ?? listing.agency_phone,
    ),
    phone: realEstateContractText(
      listing.phone ??
        listing.contact_phone ??
        listing.brokerPhone ??
        listing.broker_phone ??
        listing.signPhone ??
        listing.sign_phone,
    ),
    propertyCode: realEstateContractText(
      listing.propertyCode ?? listing.property_code,
    ),
    propertyLabel: realEstateContractText(
      listing.propertyLabel ?? listing.property_label ?? listing.property?.label,
    ),
    address: realEstateContractText(
      listing.address ?? listing.locationLabel ?? listing.location_label,
    ),
    neighborhood: realEstateContractText(
      listing.neighborhood ?? listing.district,
    ),
    city: realEstateContractText(listing.city),
    coords,
    status: realEstateContractText(listing.status, "active"),
  };
}

window.AppContract = {
  settings: {
    get(state) {
      return {
        theme: state.theme || "dark",
        wallpaper: state.wallpaper || "default",
        customWallpaper: state.customWallpaper || "",
        profilePhoto: state.profilePhoto || "",
        playerProfile: {
          firstname: state.playerProfile?.firstname || "",
          lastname: state.playerProfile?.lastname || "",
          phoneNumber: state.playerProfile?.phoneNumber || "",
          citizenid: state.playerProfile?.citizenid || "",
          nationality: state.playerProfile?.nationality || "",
          birthdate: state.playerProfile?.birthdate || "",
        },
      };
    },

    set(state, data = {}) {
      return {
        ...state,
        theme: data.theme ?? state.theme ?? "dark",
        wallpaper: data.wallpaper ?? state.wallpaper ?? "default",
        customWallpaper: data.customWallpaper ?? state.customWallpaper ?? "",
        profilePhoto: data.profilePhoto ?? state.profilePhoto ?? "",
        playerProfile: {
          firstname:
            data.playerProfile?.firstname ??
            state.playerProfile?.firstname ??
            "",
          lastname:
            data.playerProfile?.lastname ?? state.playerProfile?.lastname ?? "",
          phoneNumber:
            data.playerProfile?.phoneNumber ??
            state.playerProfile?.phoneNumber ??
            "",
          citizenid:
            data.playerProfile?.citizenid ??
            state.playerProfile?.citizenid ??
            "",
          nationality:
            data.playerProfile?.nationality ??
            state.playerProfile?.nationality ??
            "",
          birthdate:
            data.playerProfile?.birthdate ??
            state.playerProfile?.birthdate ??
            "",
        },
      };
    },
  },

  notes: {
    get(state) {
      return Array.isArray(state.notes) ? state.notes : [];
    },

    set(state, notes = []) {
      return {
        ...state,
        notes: Array.isArray(notes) ? notes : [],
      };
    },
  },

  contacts: {
    get(state) {
      return Array.isArray(state.contacts) ? state.contacts : [];
    },

    set(state, contacts = []) {
      return {
        ...state,
        contacts: Array.isArray(contacts) ? contacts : [],
      };
    },
  },

  messages: {
    get(state) {
      return Array.isArray(state.conversations) ? state.conversations : [];
    },

    set(state, conversations = []) {
      return {
        ...state,
        conversations: Array.isArray(conversations) ? conversations : [],
      };
    },
  },

  calls: {
    get(state) {
      const list = Array.isArray(state.calls) ? state.calls : [];

      return list.map((call) => ({
        id: call.id ?? window.Utils.uid(),
        name: call.name ?? "Sem nome",
        number: call.number ?? "",
        display_name: call.display_name ?? call.displayName ?? "",
        direction: call.direction ?? "outgoing",
        status: call.status ?? "",
        duration: call.duration ?? 0,
        timestamp: call.timestamp ?? call.time ?? Date.now(),
      }));
    },

    set(state, calls = []) {
      return {
        ...state,
        calls: (Array.isArray(calls) ? calls : []).map((call) => ({
          id: call.id ?? window.Utils.uid(),
          name: call.name ?? "Sem nome",
          number: call.number ?? "",
          display_name: call.display_name ?? call.displayName ?? "",
          direction: call.direction ?? "outgoing",
          status: call.status ?? "",
          duration: call.duration ?? 0,
          timestamp: call.timestamp ?? call.time ?? Date.now(),
        })),
      };
    },
  },

  gallery: {
    get(state) {
      const list = Array.isArray(state.gallery) ? state.gallery : [];

      return list.map((photo) => {
        const id =
          photo.id ??
          photo.galleryPhotoId ??
          photo.gallery_photo_id ??
          photo.photoId ??
          photo.photo_id ??
          null;
        const imageUrl = photo.image_url ?? photo.imageUrl ?? photo.url ?? "";
        const thumbnailUrl =
          photo.thumbnail_url ?? photo.thumbnailUrl ?? imageUrl ?? "";

        return {
          id,
          galleryPhotoId: id,
          image_url: imageUrl,
          imageUrl,
          thumbnail_url: thumbnailUrl,
          thumbnailUrl,
          caption: photo.caption ?? "",
          source: photo.source ?? "manual",
          favorite: photo.favorite === true || photo.favorite === 1,
          created_at: photo.created_at ?? photo.createdAt ?? "",
          createdAt: photo.createdAt ?? photo.created_at ?? "",
          metadata:
            photo.metadata && typeof photo.metadata === "object"
              ? photo.metadata
              : {},
        };
      });
    },

    set(state, photos = []) {
      return {
        ...state,
        gallery: this.get({ gallery: photos }),
      };
    },
  },

  realestate: {
    getListings(state) {
      return (Array.isArray(state.realEstateListings)
        ? state.realEstateListings
        : []
      )
        .map(normalizeRealEstateContractListing)
        .filter(Boolean);
    },

    setListings(state, listings = []) {
      return {
        ...state,
        realEstateListings: (Array.isArray(listings) ? listings : [])
          .map(normalizeRealEstateContractListing)
          .filter(Boolean),
        realEstateLoading: false,
      };
    },

    getSelected(state) {
      const selected = state.realEstateSelectedListing;
      return normalizeRealEstateContractListing(selected);
    },

    setSelected(state, listing = null) {
      return {
        ...state,
        realEstateSelectedListing: normalizeRealEstateContractListing(listing),
        realEstateLoading: false,
      };
    },

    getMine(state) {
      return (Array.isArray(state.realEstateMyListings)
        ? state.realEstateMyListings
        : []
      )
        .map(normalizeRealEstateContractListing)
        .filter(Boolean);
    },

    getProperties(state) {
      return Array.isArray(state.realEstateProperties)
        ? state.realEstateProperties
        : [];
    },

    getAccess(state) {
      const access = state.realEstateAccess;
      return access && typeof access === "object"
        ? access
        : { allowed: false };
    },
  },

  conversations: [],
  messages: {},
  selectedConversationId: null,
  messageDraft: "",
  messagesSearch: "",
};
