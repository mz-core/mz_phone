window.PhoneAPI = (() => {
  const resourceName =
    typeof GetParentResourceName === "function"
      ? GetParentResourceName()
      : "mz_phone";

  const listeners = {
    open: [],
    close: [],
    loadData: [],
    receiveNotes: [],
    receiveContacts: [],
    receiveCalls: [],
    receiveGallery: [],
    receiveRealEstateListings: [],
    receiveRealEstateListing: [],
    receiveRealEstateBrokerAccess: [],
    receiveRealEstateProperties: [],
    receiveMyRealEstateListings: [],
    receiveMyRealEstateListing: [],
    receiveRealEstateAction: [],
    notify: [],
    receiveConversations: [],
    receiveConversationMessages: [],

    incomingCall: [],
    outgoingCallStarted: [],
    callAccepted: [],
    callDeclined: [],
    callEnded: [],
    callMissed: [],
    callUnanswered: [],
    callUnavailable: [],
    callBusy: [],
  };

  let isPhoneOpen = false;
  let bankRequestCounter = 0;
  const pendingBankRequests = new Map();

  function settleBankRequest(requestId, result) {
    const pending = pendingBankRequests.get(String(requestId || ""));
    if (!pending) return;
    clearTimeout(pending.timeout);
    pendingBankRequests.delete(String(requestId));
    pending.resolve(result && typeof result === "object" ? result : {
      ok: false,
      error: "bank_unavailable",
    });
  }

  function cancelBankRequests() {
    pendingBankRequests.forEach((pending) => {
      clearTimeout(pending.timeout);
      pending.resolve({ ok: false, error: "request_cancelled" });
    });
    pendingBankRequests.clear();
  }

  async function post(endpoint, data = {}) {
    try {
      const response = await fetch(`https://${resourceName}/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify(data || {}),
      });

      const text = await response.text();

      if (!text) return {};

      try {
        return JSON.parse(text);
      } catch {
        return {};
      }
    } catch (error) {
      console.error(`[PhoneAPI] erro em ${endpoint}:`, error);
      return {};
    }
  }

  function emit(eventName, payload) {
    const queue = listeners[eventName];
    if (!Array.isArray(queue)) return;

    queue.forEach((callback) => {
      try {
        callback(payload);
      } catch (error) {
        console.error(`[PhoneAPI] erro no listener ${eventName}:`, error);
      }
    });
  }

  function listFromPayload(payload, keys = []) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== "object") return [];

    for (const key of keys) {
      if (Array.isArray(payload[key])) return payload[key];
    }

    if (payload.data && typeof payload.data === "object") {
      const nested = listFromPayload(payload.data, keys);
      if (nested.length) return nested;
    }

    if (payload.result && typeof payload.result === "object") {
      const nested = listFromPayload(payload.result, keys);
      if (nested.length) return nested;
    }

    return [];
  }

  window.addEventListener("message", (event) => {
    const data = event.data || {};
    const action = data.action;

    if (!action) return;

    if (action === "open") {
      isPhoneOpen = true;
      emit("open");
      return;
    }

    if (action === "close") {
      isPhoneOpen = false;
      cancelBankRequests();
      emit("close");
      return;
    }

    if (action === "bankResponse") {
      const payload = data.data || {};
      settleBankRequest(payload.requestId, payload.result);
      return;
    }

    if (action === "loadData") {
      emit("loadData", data.data || {});
      return;
    }

    if (action === "openApp") {
      window.setTimeout(() => {
        if (typeof window.openApp === "function") {
          window.openApp(data.app || data.appId || "home");
        }
      }, 0);
      return;
    }

    if (action === "receiveNotes") {
      emit("receiveNotes", data.notes || []);
      return;
    }

    if (action === "receiveContacts") {
      emit("receiveContacts", data.contacts || []);
    }

    if (action === "receiveCalls") {
      emit("receiveCalls", data.calls || data.data || []);
    }

    if (action === "receiveGallery") {
      emit("receiveGallery", listFromPayload(data, ["photos", "items", "gallery"]));
    }

    if (action === "receiveRealEstateListings") {
      emit("receiveRealEstateListings", data.data || {});
    }

    if (action === "receiveRealEstateListing") {
      emit("receiveRealEstateListing", data.data || {});
    }

    if (action === "receiveRealEstateBrokerAccess") {
      emit("receiveRealEstateBrokerAccess", data.data || {});
    }

    if (action === "receiveRealEstateProperties") {
      emit("receiveRealEstateProperties", data.data || {});
    }

    if (action === "receiveMyRealEstateListings") {
      emit("receiveMyRealEstateListings", data.data || {});
    }

    if (action === "receiveMyRealEstateListing") {
      emit("receiveMyRealEstateListing", data.data || {});
    }

    if (action === "receiveRealEstateAction") {
      emit("receiveRealEstateAction", data.data || {});
    }

    if (action === "notify") {
      emit("notify", data.data || {});
    }

    if (action === "receiveConversations") {
      emit("receiveConversations", data.data || []);
    }

    if (action === "receiveConversationMessages") {
      emit("receiveConversationMessages", data.data || {});
    }

    if (action === "incomingCall") {
      emit("incomingCall", data.data || {});
      return;
    }

    if (action === "outgoingCallStarted") {
      emit("outgoingCallStarted", data.data || {});
      return;
    }

    if (action === "callAccepted") {
      emit("callAccepted", data.data || {});
      return;
    }

    if (action === "callDeclined") {
      emit("callDeclined", data.data || {});
      return;
    }

    if (action === "callEnded") {
      emit("callEnded", data.data || {});
      return;
    }

    if (action === "callMissed") {
      emit("callMissed", data.data || {});
      return;
    }

    if (action === "callUnanswered") {
      emit("callUnanswered", data.data || {});
      return;
    }

    if (action === "callUnavailable") {
      emit("callUnavailable", data.data || {});
      return;
    }

    if (action === "callBusy") {
      emit("callBusy", data.data || {});
      return;
    }
  });

  window.addEventListener("keydown", (event) => {
    if (!isPhoneOpen) return;

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      post("close", {});
    }
  });

  return {
    ready() {
      return post("phoneReady", {});
    },

    async saveData(data) {
      return await post("phoneSave", data || {});
    },

    async getNotes() {
      return await post("getNotes", {});
    },

    async createNote(payload) {
      return await post("createNote", payload || {});
    },

    async updateNote(noteId, payload) {
      return await post("updateNote", {
        noteId,
        payload: payload || {},
      });
    },

    async deleteNote(noteId) {
      return await post("deleteNote", {
        noteId,
      });
    },

    async getContacts() {
      return await post("getContacts", {});
    },

    async createContact(payload) {
      return await post("createContact", payload || {});
    },

    async updateContact(contactId, payload) {
      return await post("updateContact", {
        contactId,
        payload: payload || {},
      });
    },

    async deleteContact(contactId) {
      return await post("deleteContact", {
        contactId,
      });
    },

    async toggleFavoriteContact(contactId) {
      return await post("toggleFavoriteContact", {
        contactId,
      });
    },

    async close() {
      isPhoneOpen = false;
      return await post("close", {});
    },

    async callUser(number) {
      return await post("callUser", { number });
    },

    async acceptCall(callId) {
      return await post("acceptCall", { callId });
    },

    async declineCall(callId) {
      return await post("declineCall", { callId });
    },

    async endVoiceCall(callId, options = {}) {
      return await post("endVoiceCall", {
        callId,
        ...(options || {}),
      });
    },

    async bankRequest(action, payload = {}) {
      bankRequestCounter += 1;
      const requestId = `bank_${Date.now()}_${bankRequestCounter}`;
      const resultPromise = new Promise((resolve) => {
        const timeout = setTimeout(() => {
          pendingBankRequests.delete(requestId);
          resolve({ ok: false, error: "request_timeout" });
        }, 8000);
        pendingBankRequests.set(requestId, { resolve, timeout });
      });

      const accepted = await post("bankRequest", {
        requestId,
        action: String(action || ""),
        payload: payload && typeof payload === "object" ? payload : {},
      });
      if (accepted && accepted.ok === false) {
        settleBankRequest(requestId, {
          ok: false,
          error: accepted.error || "request_rejected",
        });
      }
      return await resultPromise;
    },

    async closeBankSession() {
      return await post("bankClose", {});
    },

    onIncomingCall(callback) {
      if (typeof callback === "function") {
        listeners.incomingCall.push(callback);
      }
    },

    onOutgoingCallStarted(callback) {
      if (typeof callback === "function") {
        listeners.outgoingCallStarted.push(callback);
      }
    },

    onCallAccepted(callback) {
      if (typeof callback === "function") {
        listeners.callAccepted.push(callback);
      }
    },

    onCallDeclined(callback) {
      if (typeof callback === "function") {
        listeners.callDeclined.push(callback);
      }
    },

    onCallEnded(callback) {
      if (typeof callback === "function") {
        listeners.callEnded.push(callback);
      }
    },

    onCallMissed(callback) {
      if (typeof callback === "function") {
        listeners.callMissed.push(callback);
      }
    },

    onCallUnanswered(callback) {
      if (typeof callback === "function") {
        listeners.callUnanswered.push(callback);
      }
    },

    onCallUnavailable(callback) {
      if (typeof callback === "function") {
        listeners.callUnavailable.push(callback);
      }
    },

    onCallBusy(callback) {
      if (typeof callback === "function") {
        listeners.callBusy.push(callback);
      }
    },

    onOpen(callback) {
      if (typeof callback === "function") {
        listeners.open.push(callback);
      }
    },

    onClose(callback) {
      if (typeof callback === "function") {
        listeners.close.push(callback);
      }
    },

    onLoadData(callback) {
      if (typeof callback === "function") {
        listeners.loadData.push(callback);
      }
    },

    onReceiveNotes(callback) {
      if (typeof callback === "function") {
        listeners.receiveNotes.push(callback);
      }
    },

    onReceiveContacts(callback) {
      if (typeof callback === "function") {
        listeners.receiveContacts.push(callback);
      }
    },

    onNotify(callback) {
      if (typeof callback === "function") {
        listeners.notify.push(callback);
      }
    },

    onReceiveConversations(callback) {
      if (typeof callback === "function") {
        listeners.receiveConversations.push(callback);
      }
    },

    onReceiveConversationMessages(callback) {
      if (typeof callback === "function") {
        listeners.receiveConversationMessages.push(callback);
      }
    },

    on(eventName, callback) {
      if (!Array.isArray(listeners[eventName])) {
        return;
      }

      if (typeof callback === "function") {
        listeners[eventName].push(callback);
      }
    },

    // CALLS
    async getCalls() {
      return await post("getCalls", {});
    },

    async getCallHistory() {
      return await post("getCallHistory", {});
    },

    async createCall(data) {
      return await post("createCall", data || {});
    },

    async deleteCall(callId) {
      return await post("deleteCall", { callId });
    },

    async clearCalls() {
      return await post("clearCalls", {});
    },

    onReceiveCalls(callback) {
      if (typeof callback === "function") {
        listeners.receiveCalls.push(callback);
      }
    },

    async getGallery() {
      return await post("getGallery", {});
    },

    async addGalleryPhoto(data) {
      return await post("addGalleryPhoto", data || {});
    },

    async deleteGalleryPhoto(photoId) {
      return await post("deleteGalleryPhoto", { photoId });
    },

    async toggleGalleryFavorite(photoId, favorite) {
      return await post("toggleGalleryFavorite", { photoId, favorite });
    },

    async takePhoto(data = {}) {
      return await post("takePhoto", data || {});
    },

    async openCameraMode(data = {}) {
      return await post("openCameraMode", data || {});
    },

    onReceiveGallery(callback) {
      if (typeof callback === "function") {
        listeners.receiveGallery.push(callback);
      }
    },

    async getConversations() {
      return await post("getConversations", {});
    },

    async getConversationMessages(conversationId) {
      return await post("getConversationMessages", { conversationId });
    },

    async createConversation(data) {
      return await post("createConversation", data || {});
    },

    async sendMessage(data) {
      return await post("sendMessage", data || {});
    },

    async setWaypoint(data) {
      return await post("setWaypoint", data || {});
    },

    async getRealEstateListings(filters = {}) {
      return await post("getRealEstateListings", filters || {});
    },

    async getRealEstateListing(listingCode) {
      return await post("getRealEstateListing", { listingCode });
    },

    async getRealEstateBrokerAccess() {
      return await post("getRealEstateBrokerAccess", {});
    },

    async getRealEstateProperties() {
      return await post("getRealEstateProperties", {});
    },

    async getMyRealEstateListings() {
      return await post("getMyRealEstateListings", {});
    },

    async getMyRealEstateListing(listingCode) {
      return await post("getMyRealEstateListing", { listingCode });
    },

    async createRealEstateListing(payload) {
      return await post("createRealEstateListing", payload || {});
    },

    async updateRealEstateListing(listingCode, payload) {
      return await post("updateRealEstateListing", {
        listingCode,
        payload: payload || {},
      });
    },

    async setRealEstateListingStatus(listingCode, status) {
      return await post("setRealEstateListingStatus", {
        listingCode,
        status,
      });
    },

    async getRealEstateGalleryPhotos() {
      return await post("getRealEstateGalleryPhotos", {});
    },

    async getRealEstateListingPhotos(listingCode) {
      return await post("getRealEstateListingPhotos", { listingCode });
    },

    async attachRealEstateGalleryPhoto(listingCode, galleryPhotoId) {
      return await post("attachRealEstateGalleryPhoto", {
        listingCode,
        galleryPhotoId,
      });
    },

    async setRealEstatePrimaryPhoto(listingCode, photoId) {
      return await post("setRealEstatePrimaryPhoto", {
        listingCode,
        photoId,
      });
    },

    async removeRealEstatePhoto(listingCode, photoId) {
      return await post("removeRealEstatePhoto", {
        listingCode,
        photoId,
      });
    },

    onReceiveRealEstateListings(callback) {
      if (typeof callback === "function") {
        listeners.receiveRealEstateListings.push(callback);
      }
    },

    onReceiveRealEstateListing(callback) {
      if (typeof callback === "function") {
        listeners.receiveRealEstateListing.push(callback);
      }
    },

    onReceiveRealEstateBrokerAccess(callback) {
      if (typeof callback === "function") {
        listeners.receiveRealEstateBrokerAccess.push(callback);
      }
    },

    onReceiveRealEstateProperties(callback) {
      if (typeof callback === "function") {
        listeners.receiveRealEstateProperties.push(callback);
      }
    },

    onReceiveMyRealEstateListings(callback) {
      if (typeof callback === "function") {
        listeners.receiveMyRealEstateListings.push(callback);
      }
    },

    onReceiveMyRealEstateListing(callback) {
      if (typeof callback === "function") {
        listeners.receiveMyRealEstateListing.push(callback);
      }
    },

    onReceiveRealEstateAction(callback) {
      if (typeof callback === "function") {
        listeners.receiveRealEstateAction.push(callback);
      }
    },

    async markConversationRead(conversationId) {
      return await post("markConversationRead", { conversationId });
    },
  };
})();
