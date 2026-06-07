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
      emit("close");
      return;
    }

    if (action === "loadData") {
      emit("loadData", data.data || {});
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

    async markConversationRead(conversationId) {
      return await post("markConversationRead", { conversationId });
    },
  };
})();
