window.Utils = {
  deepClone(value) {
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
  },

  deepMerge(target, source) {
    const output = Array.isArray(target) ? [...target] : { ...(target || {}) };

    if (!source || typeof source !== "object") {
      return output;
    }

    Object.keys(source).forEach((key) => {
      const sourceValue = source[key];
      const targetValue = output[key];

      if (Array.isArray(sourceValue)) {
        output[key] = sourceValue.map((item) =>
          item && typeof item === "object" ? this.deepClone(item) : item,
        );
        return;
      }

      if (
        sourceValue &&
        typeof sourceValue === "object" &&
        !Array.isArray(sourceValue)
      ) {
        output[key] = this.deepMerge(
          targetValue && typeof targetValue === "object" ? targetValue : {},
          sourceValue,
        );
        return;
      }

      output[key] = sourceValue;
    });

    return output;
  },

  uid() {
    return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  },

  escapeHtml(text) {
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  },

  escapeHtmlAttr(text) {
    return this.escapeHtml(text);
  },

  formatTime(timestamp) {
    if (!timestamp) return "";

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "";

    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${hours}:${minutes}`;
  },

  normalizePhone(value) {
    return String(value ?? "").replace(/\D/g, "");
  },

  formatPhone(value) {
    const digits = this.normalizePhone(value);

    if (!digits) return "";

    if (digits.length === 11) {
      return `${digits.slice(0, 2)} ${digits.slice(2, 3)} ${digits.slice(
        3,
        7,
      )}-${digits.slice(7)}`;
    }

    if (digits.length === 10) {
      return `${digits.slice(0, 2)} ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }

    if (digits.length > 11) {
      return digits;
    }

    return digits;
  },

  getFullName(contact = {}) {
    if (contact.name) {
      return String(contact.name).trim();
    }

    const first = String(contact.firstName || "").trim();
    const last = String(contact.lastName || "").trim();

    return `${first} ${last}`.trim();
  },
};
