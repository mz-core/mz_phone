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
          direction: call.direction ?? "outgoing",
          status: call.status ?? "",
          duration: call.duration ?? 0,
          timestamp: call.timestamp ?? call.time ?? Date.now(),
        })),
      };
    },
  },

  conversations: [],
  messages: {},
  selectedConversationId: null,
  messageDraft: "",
  messagesSearch: "",
};
