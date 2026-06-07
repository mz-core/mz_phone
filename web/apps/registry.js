window.AppRegistry = {
  apps: [],

  register(app) {
    if (!app || typeof app !== "object") {
      console.warn("registerApp: app inválido");
      return;
    }

    if (!app.id || typeof app.id !== "string") {
      console.warn("registerApp: id inválido");
      return;
    }

    if (!app.name || typeof app.name !== "string") {
      console.warn(`registerApp: name inválido no app ${app.id}`);
      return;
    }

    if (!app.icon || typeof app.icon !== "string") {
      console.warn(`registerApp: icon inválido no app ${app.id}`);
      return;
    }

    if (typeof app.order !== "number") {
      console.warn(`registerApp: order inválido no app ${app.id}`);
      return;
    }

    if (typeof app.render !== "function") {
      console.warn(`registerApp: render inválido no app ${app.id}`);
      return;
    }

    const exists = this.apps.some((existing) => existing.id === app.id);
    if (exists) {
      console.warn(`registerApp: app duplicado ${app.id}`);
      return;
    }

    this.apps.push({
      id: app.id,
      name: app.name,
      icon: app.icon,
      order: app.order,
      render: app.render,
      onOpen: typeof app.onOpen === "function" ? app.onOpen : null,
      onClose: typeof app.onClose === "function" ? app.onClose : null,
    });

    this.apps.sort((a, b) => a.order - b.order);
  },

  getApp(appId) {
    return this.apps.find((app) => app.id === appId) || null;
  },

  getAllApps() {
    return [...this.apps].sort((a, b) => a.order - b.order);
  },

  getInstalledApps() {
    return this.getAllApps();
  },
};

window.registerApp = function (app) {
  window.AppRegistry.register(app);
};
