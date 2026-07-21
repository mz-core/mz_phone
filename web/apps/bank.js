(function () {
  const ERROR_MESSAGES = Object.freeze({
    bank_unavailable: "O servico bancario esta indisponivel no momento.",
    identity_unavailable: "Nao foi possivel validar seu personagem.",
    player_not_loaded: "Seu personagem ainda nao terminou de carregar.",
    missing_phone: "O aparelho nao esta disponivel para esta sessao.",
    invalid_session: "Sua sessao bancaria expirou. Tente novamente.",
    session_expired: "Sua sessao bancaria expirou. Tente novamente.",
    public_account_unavailable: "Nao foi possivel carregar sua conta publica.",
    resolution_unavailable: "A confirmacao do destinatario esta indisponivel.",
    invalid_resolution_token: "A confirmacao expirou. Consulte o destinatario novamente.",
    recipient_invalid: "Confira agencia, conta e digito.",
    recipient_unavailable: "O destinatario esta indisponivel ou offline.",
    self_transfer: "Voce nao pode transferir para sua propria conta.",
    invalid_amount: "Informe um valor inteiro maior que zero.",
    transaction_limit: "O valor excede o limite permitido.",
    not_enough_bank: "Saldo bancario insuficiente.",
    operation_busy: "Ja existe uma operacao em andamento.",
    idempotency_conflict: "Esta operacao entrou em conflito. Atualize e tente novamente.",
    rate_limited: "Aguarde alguns segundos antes de tentar novamente.",
    request_timeout: "O banco demorou para responder. Tente confirmar novamente.",
    request_cancelled: "A consulta foi cancelada.",
    card_invalid: "Este cartao nao pode mais ser bloqueado.",
    card_blocked: "Este cartao ja esta bloqueado.",
    channel_forbidden: "Esta operacao nao esta disponivel no celular.",
    favorite_invalid: "Este favorito nao esta mais disponivel.",
    favorite_limit: "Voce atingiu o limite de favoritos.",
    database_error: "Nao foi possivel salvar este favorito.",
  });

  const emptyDraft = () => ({
    branch: "0001",
    accountNumber: "",
    checkDigit: "",
    amount: "",
  });

  function money(value, symbol = "R$") {
    const amount = Math.abs(Number(value) || 0);
    return `${symbol}${amount.toLocaleString("pt-BR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  }

  function signedMoney(value, symbol = "R$") {
    const numeric = Number(value) || 0;
    return `${numeric < 0 ? "-" : "+"}${money(numeric, symbol)}`;
  }

  function errorMessage(error) {
    const code = typeof error === "object" ? error.code : String(error || "");
    const raw = typeof error === "object" ? error.message : "";
    return ERROR_MESSAGES[code] || raw || "Nao foi possivel concluir esta operacao.";
  }

  function statementDate(value) {
    if (!value) return "Agora";
    const date = new Date(String(value).replace(" ", "T"));
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function statusLabel(status) {
    return ({
      active: "Ativo",
      blocked: "Bloqueado",
      revoked: "Revogado",
      expired: "Expirado",
      issuing: "Em emissao",
    })[String(status || "").toLowerCase()] || "Indisponivel";
  }

  function renderLoading(label = "Conectando ao MZ Bank") {
    return `
      <div class="app-state-view bank-state" role="status" aria-live="polite">
        <div class="bank-state-icon bank-state-icon--loading"><i data-lucide="loader-circle"></i></div>
        <strong>${window.Utils.escapeHtml(label)}</strong>
        <p>Validando a operacao pelos servicos oficiais.</p>
      </div>
    `;
  }

  function renderError(error) {
    return `
      <div class="app-state-view bank-state" role="alert" aria-live="polite">
        <div class="bank-state-icon"><i data-lucide="landmark"></i><span><i data-lucide="wifi-off"></i></span></div>
        <strong>Servico bancario indisponivel</strong>
        <p>${window.Utils.escapeHtml(errorMessage(error))}</p>
        <button class="bank-primary-button" onclick="window.MZBankApp.retry()"><i data-lucide="refresh-cw"></i><span>Tentar novamente</span></button>
      </div>
    `;
  }

  function renderStatement(rows, currencySymbol, statementError) {
    if (statementError) {
      return `<div class="app-inline-notice bank-notice"><i data-lucide="triangle-alert"></i><span>Extrato temporariamente indisponivel.</span></div>`;
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return `<div class="bank-empty"><i data-lucide="receipt-text"></i><span>Nenhuma movimentacao recente.</span></div>`;
    }
    return `<div class="bank-list">${rows.map((row) => {
      const amount = Number(row.amount) || 0;
      return `
        <div class="bank-transaction-row">
          <div class="bank-row-icon bank-row-icon--${amount < 0 ? "out" : "in"}"><i data-lucide="${amount < 0 ? "arrow-up-right" : "arrow-down-left"}"></i></div>
          <div class="bank-row-copy"><strong>${window.Utils.escapeHtml(row.description || "Movimentacao bancaria")}</strong><span>${window.Utils.escapeHtml(statementDate(row.occurredAt))}</span></div>
          <div class="bank-row-amount bank-row-amount--${amount < 0 ? "out" : "in"}">${window.Utils.escapeHtml(signedMoney(amount, currencySymbol))}</div>
        </div>`;
    }).join("")}</div>`;
  }

  function renderCards(cards, state) {
    if (!Array.isArray(cards) || cards.length === 0) {
      return `<div class="bank-empty bank-empty--compact"><i data-lucide="credit-card"></i><span>Nenhum cartao emitido.</span></div>`;
    }
    return `<div class="bank-card-list">${cards.map((card) => `
      <div class="bank-card-mini">
        <div class="bank-card-chip"></div><div class="bank-card-brand">MZ</div>
        <div class="bank-card-number">•••• •••• •••• ${window.Utils.escapeHtml(card.last4 || "----")}</div>
        <div class="bank-card-footer"><span>Debito</span><span class="bank-card-status bank-card-status--${window.Utils.escapeHtmlAttr(card.status || "unknown")}">${window.Utils.escapeHtml(statusLabel(card.status))}</span></div>
        ${state.bankCapabilities?.blockCard && card.canBlock === true && card.cardRef ? `
          <button class="bank-card-block-button" onclick="window.MZBankApp.openCardBlock('${window.Utils.escapeHtmlAttr(card.cardRef)}')">
            <i data-lucide="shield-ban"></i><span>Bloquear cartao</span>
          </button>` : ""}
      </div>`).join("")}</div>`;
  }

  function renderOverview(state) {
    const overview = state.bankOverview || {};
    const account = overview.publicAccount || {};
    const currencySymbol = overview.currencySymbol || "R$";
    return `
      <div class="bank-dashboard">
        <section class="bank-balance-card" aria-label="Resumo da conta">
          <div class="bank-balance-top"><span>Saldo disponivel</span><i data-lucide="shield-check"></i></div>
          <div class="bank-balance-value">${window.Utils.escapeHtml(money(overview.balance, currencySymbol))}</div>
          <div class="bank-account-owner">${window.Utils.escapeHtml(overview.name || "Cliente")}</div>
          <div class="bank-account-route"><span>Ag. ${window.Utils.escapeHtml(account.branch || "----")}</span><span>Conta ${window.Utils.escapeHtml(account.accountNumber || "--------")}-${window.Utils.escapeHtml(account.checkDigit || "-")}</span></div>
        </section>

        ${state.bankCapabilities?.transfer ? `
          <button class="bank-transfer-entry" onclick="window.MZBankApp.openTransfer()">
            <span class="bank-transfer-entry-icon"><i data-lucide="send"></i></span>
            <span><strong>Transferir</strong><small>Para uma conta MZ Bank</small></span>
            <i data-lucide="chevron-right"></i>
          </button>` : ""}

        ${state.bankCapabilities?.transfer && Array.isArray(state.bankFavorites) && state.bankFavorites.length ? `
          <section class="bank-section bank-favorites-section">
            <div class="app-section-heading-standard"><div><strong>Favoritos</strong><span>Transferencia rapida e segura</span></div></div>
            ${state.bankFavoriteError ? `<div class="app-inline-notice bank-transfer-error" role="alert"><i data-lucide="circle-alert"></i><span>${window.Utils.escapeHtml(errorMessage(state.bankFavoriteError))}</span></div>` : ""}
            <div class="bank-favorite-list">${state.bankFavorites.map((favorite) => `
              <div class="bank-favorite-row">
                <button class="bank-favorite-main" onclick="window.MZBankApp.openFavorite('${window.Utils.escapeHtmlAttr(favorite.favoriteRef)}')">
                  <span class="bank-favorite-avatar"><i data-lucide="star"></i></span>
                  <span><strong>${window.Utils.escapeHtml(favorite.label || "Conta MZ")}</strong><small>Ag. ${window.Utils.escapeHtml(favorite.branch || "----")} · ${window.Utils.escapeHtml(favorite.accountMasked || "")}</small></span>
                  <i data-lucide="chevron-right"></i>
                </button>
                <button class="bank-favorite-delete" onclick="window.MZBankApp.deleteFavorite('${window.Utils.escapeHtmlAttr(favorite.favoriteRef)}')" aria-label="Remover favorito" ${state.bankFavoriteBusy ? "disabled" : ""}><i data-lucide="trash-2"></i></button>
              </div>`).join("")}</div>
          </section>` : ""}

        <div class="app-inline-notice bank-notice bank-notice--secure"><i data-lucide="smartphone"></i><span>Sessao protegida e vinculada a este aparelho.</span></div>

        <section class="bank-section">
          <div class="app-section-heading-standard"><div><strong>Movimentacoes</strong><span>Extrato mais recente</span></div></div>
          ${renderStatement(overview.statement, currencySymbol, overview.statementError)}
        </section>
        <section class="bank-section">
          <div class="app-section-heading-standard"><div><strong>Meus cartoes</strong><span>Consulta segura</span></div></div>
          ${state.bankCardMessage ? `<div class="app-inline-notice bank-card-success" role="status"><i data-lucide="badge-check"></i><span>${window.Utils.escapeHtml(state.bankCardMessage)}</span></div>` : ""}
          ${renderCards(state.bankCards, state)}
        </section>
      </div>`;
  }

  function renderCardBlockConfirm(state) {
    const card = state.bankCardIntent || {};
    return `
      <div class="bank-card-block-flow">
        <div class="bank-confirm-icon bank-confirm-icon--danger"><i data-lucide="shield-ban"></i></div>
        <div class="bank-confirm-title"><strong>Bloquear este cartao?</strong><span>O bloqueio impede novos usos e nao pode ser desfeito pelo aplicativo.</span></div>
        ${state.bankCardError ? `<div class="app-inline-notice bank-transfer-error" role="alert"><i data-lucide="circle-alert"></i><span>${window.Utils.escapeHtml(errorMessage(state.bankCardError))}</span></div>` : ""}
        <div class="bank-card-mini bank-card-mini--confirm">
          <div class="bank-card-chip"></div><div class="bank-card-brand">MZ</div>
          <div class="bank-card-number">•••• •••• •••• ${window.Utils.escapeHtml(card.last4 || "----")}</div>
          <div class="bank-card-footer"><span>Debito</span><span class="bank-card-status bank-card-status--active">Ativo</span></div>
        </div>
        <div class="app-inline-notice bank-card-warning"><i data-lucide="triangle-alert"></i><span>Para emitir uma segunda via, procure uma agencia.</span></div>
        <button class="bank-danger-button" onclick="window.MZBankApp.confirmCardBlock()" ${state.bankCardBusy ? "disabled" : ""}>${state.bankCardBusy ? '<i data-lucide="loader-circle"></i><span>Bloqueando</span>' : '<i data-lucide="shield-ban"></i><span>Confirmar bloqueio</span>'}</button>
        <button class="bank-secondary-button" onclick="window.MZBankApp.cancelCardBlock()" ${state.bankCardBusy ? "disabled" : ""}>Cancelar</button>
      </div>`;
  }

  function inlineTransferError(state) {
    if (!state.bankTransferError) return "";
    return `<div class="app-inline-notice bank-transfer-error" role="alert"><i data-lucide="circle-alert"></i><span>${window.Utils.escapeHtml(errorMessage(state.bankTransferError))}</span></div>`;
  }

  function renderTransferForm(state) {
    const draft = state.bankTransferDraft || emptyDraft();
    return `
      <div class="bank-transfer-flow">
        <div class="bank-flow-intro"><span><i data-lucide="landmark"></i></span><div><strong>Nova transferencia</strong><p>Use a agencia, conta e digito publicos do destinatario.</p></div></div>
        ${inlineTransferError(state)}
        <div class="app-surface-card bank-form-card">
          <label class="bank-field"><span>Agencia</span><input inputmode="numeric" maxlength="4" value="${window.Utils.escapeHtmlAttr(draft.branch || "")}" oninput="window.MZBankApp.setTransferField('branch', this.value)" /></label>
          <label class="bank-field bank-field--wide"><span>Numero da conta</span><input inputmode="numeric" maxlength="8" placeholder="12345678" value="${window.Utils.escapeHtmlAttr(draft.accountNumber || "")}" oninput="window.MZBankApp.setTransferField('accountNumber', this.value)" /></label>
          <label class="bank-field"><span>Digito</span><input inputmode="numeric" maxlength="1" placeholder="0" value="${window.Utils.escapeHtmlAttr(draft.checkDigit || "")}" oninput="window.MZBankApp.setTransferField('checkDigit', this.value)" /></label>
          <label class="bank-field bank-field--amount"><span>Valor</span><div class="bank-amount-input"><b>R$</b><input inputmode="numeric" maxlength="10" placeholder="0" value="${window.Utils.escapeHtmlAttr(draft.amount || "")}" oninput="window.MZBankApp.setTransferField('amount', this.value)" /></div></label>
        </div>
        <button class="bank-primary-button bank-primary-button--full" onclick="window.MZBankApp.resolveTransfer()" ${state.bankTransferBusy ? "disabled" : ""}>${state.bankTransferBusy ? '<i data-lucide="loader-circle"></i><span>Consultando</span>' : '<span>Continuar</span><i data-lucide="arrow-right"></i>'}</button>
      </div>`;
  }

  function renderFavoriteTransfer(state) {
    const favorite = state.bankFavoriteIntent || {};
    const draft = state.bankTransferDraft || emptyDraft();
    return `
      <div class="bank-transfer-flow">
        <div class="bank-flow-intro"><span><i data-lucide="star"></i></span><div><strong>${window.Utils.escapeHtml(favorite.label || "Conta favorita")}</strong><p>Ag. ${window.Utils.escapeHtml(favorite.branch || "----")} · ${window.Utils.escapeHtml(favorite.accountMasked || "")}</p></div></div>
        ${inlineTransferError(state)}
        <div class="app-surface-card bank-form-card">
          <label class="bank-field bank-field--amount"><span>Valor</span><div class="bank-amount-input"><b>R$</b><input inputmode="numeric" maxlength="10" placeholder="0" value="${window.Utils.escapeHtmlAttr(draft.amount || "")}" oninput="window.MZBankApp.setTransferField('amount', this.value)" /></div></label>
        </div>
        <button class="bank-primary-button bank-primary-button--full" onclick="window.MZBankApp.resolveFavoriteTransfer()" ${state.bankTransferBusy ? "disabled" : ""}>${state.bankTransferBusy ? '<i data-lucide="loader-circle"></i><span>Consultando</span>' : '<span>Continuar</span><i data-lucide="arrow-right"></i>'}</button>
      </div>`;
  }

  function renderTransferConfirm(state) {
    const recipient = state.bankRecipient || {};
    const draft = state.bankTransferDraft || emptyDraft();
    return `
      <div class="bank-transfer-flow">
        <div class="bank-confirm-icon"><i data-lucide="user-check"></i></div>
        <div class="bank-confirm-title"><strong>Confirme o destinatario</strong><span>Revise os dados antes de transferir.</span></div>
        ${inlineTransferError(state)}
        <div class="app-surface-card bank-confirm-card">
          <div><span>Destinatario</span><strong>${window.Utils.escapeHtml(recipient.displayName || "Cliente")}</strong></div>
          <div><span>Conta</span><strong>Ag. ${window.Utils.escapeHtml(recipient.branch || "----")} · ${window.Utils.escapeHtml(recipient.accountMasked || "")}</strong></div>
          <div><span>Tipo</span><strong>${window.Utils.escapeHtml(recipient.accountTypeLabel || "Conta pessoal")}</strong></div>
          <div class="bank-confirm-total"><span>Valor</span><strong>${window.Utils.escapeHtml(money(Number(draft.amount) || 0))}</strong></div>
        </div>
        <button class="bank-primary-button bank-primary-button--full" onclick="window.MZBankApp.confirmTransfer()" ${state.bankTransferBusy ? "disabled" : ""}>${state.bankTransferBusy ? '<i data-lucide="loader-circle"></i><span>Transferindo</span>' : '<i data-lucide="shield-check"></i><span>Confirmar transferencia</span>'}</button>
        <button class="bank-secondary-button" onclick="window.MZBankApp.editTransfer()" ${state.bankTransferBusy ? "disabled" : ""}>Corrigir dados</button>
      </div>`;
  }

  function renderReceipt(state) {
    const receipt = state.bankReceipt || {};
    const recipient = receipt.recipient || {};
    return `
      <div class="bank-receipt">
        <div class="bank-receipt-success"><span><i data-lucide="check"></i></span><strong>Transferencia concluida</strong><p>O valor foi confirmado pelo servico financeiro.</p></div>
        <div class="app-surface-card bank-receipt-card">
          <div><span>Valor</span><strong class="bank-receipt-amount">${window.Utils.escapeHtml(money(receipt.amount, receipt.currencySymbol || "R$"))}</strong></div>
          <div><span>Destinatario</span><strong>${window.Utils.escapeHtml(recipient.displayName || "Cliente")}</strong></div>
          <div><span>Conta</span><strong>Ag. ${window.Utils.escapeHtml(recipient.branch || "----")} · ${window.Utils.escapeHtml(recipient.accountMasked || "")}</strong></div>
          <div><span>Taxa</span><strong>${window.Utils.escapeHtml(money(receipt.fee || 0, receipt.currencySymbol || "R$"))}</strong></div>
          <div class="bank-receipt-reference"><span>Comprovante</span><code>${window.Utils.escapeHtml(receipt.correlationId || "")}</code></div>
        </div>
        ${state.bankFavoriteError ? `<div class="app-inline-notice bank-transfer-error" role="alert"><i data-lucide="circle-alert"></i><span>${window.Utils.escapeHtml(errorMessage(state.bankFavoriteError))}</span></div>` : ""}
        ${state.bankFavoriteSaved ? `<div class="app-inline-notice bank-card-success" role="status"><i data-lucide="star"></i><span>Destinatario salvo nos favoritos.</span></div>` : `<button class="bank-secondary-button bank-save-favorite" onclick="window.MZBankApp.saveFavorite()" ${state.bankFavoriteBusy ? "disabled" : ""}>${state.bankFavoriteBusy ? '<i data-lucide="loader-circle"></i><span>Salvando</span>' : '<i data-lucide="star"></i><span>Salvar nos favoritos</span>'}</button>`}
        <button class="bank-primary-button bank-primary-button--full" onclick="window.MZBankApp.finishTransfer()"><span>Voltar para a conta</span></button>
      </div>`;
  }

  registerApp({
    id: "bank",
    name: "MZ Bank",
    icon: "landmark",
    order: 60,

    render: (ctx) => {
      const state = ctx.getState();
      const view = state.bankView || "overview";
      let body;
      if (state.bankLoading && view === "overview") body = renderLoading();
      else if (state.bankError && view === "overview") body = renderError(state.bankError);
      else if (view === "transfer_form") body = renderTransferForm(state);
      else if (view === "favorite_transfer") body = renderFavoriteTransfer(state);
      else if (view === "transfer_confirm") body = renderTransferConfirm(state);
      else if (view === "receipt") body = renderReceipt(state);
      else if (view === "card_block_confirm") body = renderCardBlockConfirm(state);
      else body = renderOverview(state);
      return `
        <div class="app-page bank-page">
          <div class="app-header app-header--standard bank-header">
            <div class="app-header-left"><button class="app-header-icon-btn" onclick="window.MZBankApp.back()" aria-label="Voltar"><i data-lucide="chevron-left"></i></button></div>
            <div class="app-header-center"><div class="app-title">${view === "overview" ? "MZ Bank" : view === "receipt" ? "Comprovante" : view === "card_block_confirm" ? "Bloquear cartao" : "Transferir"}</div></div>
            <div class="app-header-right">${view === "overview" ? `<button class="app-header-icon-btn" onclick="window.MZBankApp.refresh()" aria-label="Atualizar" ${state.bankLoading ? "disabled" : ""}><i data-lucide="refresh-cw"></i></button>` : ""}</div>
          </div>
          <div class="app-content bank-content">${body}</div>
        </div>`;
    },

    onOpen: (ctx) => {
      async function load(action = "open") {
        ctx.patchState({ bankLoading: true, bankError: "" });
        ctx.renderCurrentApp();
        const result = window.PhoneAPI?.bankRequest ? await window.PhoneAPI.bankRequest(action, {}) : { ok: false, error: "bank_unavailable" };
        if (ctx.getState().currentApp !== "bank") return;
        if (!result || result.ok !== true || !result.data?.overview) {
          ctx.patchState({ bankLoading: false, bankError: { code: result?.error || "bank_unavailable", message: result?.message || "" }, bankOverview: null, bankCards: [] });
          ctx.renderCurrentApp();
          return;
        }
        ctx.patchState({ bankLoading: false, bankError: "", bankOverview: result.data.overview, bankCards: Array.isArray(result.data.cards) ? result.data.cards : [], bankFavorites: Array.isArray(result.data.favorites) ? result.data.favorites : [], bankCapabilities: result.data.capabilities || { statement: true, cards: true, transfer: false, blockCard: false } });
        ctx.renderCurrentApp();
      }

      window.MZBankApp = {
        retry: () => load("open"),
        refresh: () => load("refresh"),
        back: () => {
          const state = ctx.getState();
          if (state.bankView === "overview") return ctx.goHome();
          if (state.bankView === "transfer_confirm") return window.MZBankApp.editTransfer();
          ctx.patchState({ bankView: "overview", bankTransferError: "", bankRecipient: null, bankConfirmationRef: "", bankReceipt: null, bankTransferDraft: emptyDraft(), bankCardIntent: null, bankCardBusy: false, bankCardError: "", bankFavoriteIntent: null, bankFavoriteError: "" });
          ctx.renderCurrentApp();
        },
        openTransfer: () => {
          ctx.patchState({ bankView: "transfer_form", bankTransferDraft: emptyDraft(), bankRecipient: null, bankConfirmationRef: "", bankTransferError: "", bankReceipt: null, bankFavoriteIntent: null, bankFavoriteError: "", bankFavoriteSaved: false });
          ctx.renderCurrentApp();
        },
        setTransferField: (field, value) => {
          if (!["branch", "accountNumber", "checkDigit", "amount"].includes(field)) return;
          const limits = { branch: 4, accountNumber: 8, checkDigit: 1, amount: 10 };
          const clean = String(value || "").replace(/\D/g, "").slice(0, limits[field]);
          ctx.patchState({ bankTransferDraft: { ...(ctx.getState().bankTransferDraft || emptyDraft()), [field]: clean }, bankTransferError: "" });
        },
        resolveTransfer: async () => {
          const draft = ctx.getState().bankTransferDraft || emptyDraft();
          const amount = Number(draft.amount);
          if (!/^\d{4}$/.test(draft.branch) || !/^\d{8}$/.test(draft.accountNumber) || !/^\d$/.test(draft.checkDigit)) {
            ctx.patchState({ bankTransferError: { code: "recipient_invalid" } }); ctx.renderCurrentApp(); return;
          }
          if (!Number.isSafeInteger(amount) || amount <= 0) {
            ctx.patchState({ bankTransferError: { code: "invalid_amount" } }); ctx.renderCurrentApp(); return;
          }
          ctx.patchState({ bankTransferBusy: true, bankTransferError: "" }); ctx.renderCurrentApp();
          const result = await window.PhoneAPI.bankRequest("resolve_transfer", { branch: draft.branch, accountNumber: draft.accountNumber, checkDigit: draft.checkDigit, amount });
          if (ctx.getState().currentApp !== "bank") return;
          if (!result || result.ok !== true || !result.data?.confirmationRef) {
            ctx.patchState({ bankTransferBusy: false, bankTransferError: { code: result?.error || "recipient_unavailable", message: result?.message || "" } }); ctx.renderCurrentApp(); return;
          }
          ctx.patchState({ bankView: "transfer_confirm", bankTransferBusy: false, bankTransferError: "", bankRecipient: result.data.recipient || null, bankConfirmationRef: result.data.confirmationRef }); ctx.renderCurrentApp();
        },
        editTransfer: () => {
          const favorite = ctx.getState().bankFavoriteIntent;
          ctx.patchState({ bankView: favorite ? "favorite_transfer" : "transfer_form", bankTransferBusy: false, bankTransferError: "", bankRecipient: null, bankConfirmationRef: "" }); ctx.renderCurrentApp();
        },
        confirmTransfer: async () => {
          const state = ctx.getState();
          if (state.bankTransferBusy) return;
          ctx.patchState({ bankTransferBusy: true, bankTransferError: "" }); ctx.renderCurrentApp();
          const result = await window.PhoneAPI.bankRequest("confirm_transfer", { confirmationRef: state.bankConfirmationRef });
          if (ctx.getState().currentApp !== "bank") return;
          if (!result || result.ok !== true || !result.data?.receipt) {
            ctx.patchState({ bankTransferBusy: false, bankTransferError: { code: result?.error || "transaction_failed", message: result?.message || "" } }); ctx.renderCurrentApp(); return;
          }
          ctx.patchState({ bankView: "receipt", bankTransferBusy: false, bankTransferError: "", bankReceipt: result.data.receipt, bankOverview: result.data.overview || ctx.getState().bankOverview, bankCards: Array.isArray(result.data.cards) ? result.data.cards : ctx.getState().bankCards, bankFavorites: Array.isArray(result.data.favorites) ? result.data.favorites : ctx.getState().bankFavorites, bankCapabilities: result.data.capabilities || ctx.getState().bankCapabilities, bankFavoriteSaved: false, bankFavoriteError: "" }); ctx.renderCurrentApp();
        },
        finishTransfer: () => {
          ctx.patchState({ bankView: "overview", bankTransferDraft: emptyDraft(), bankRecipient: null, bankConfirmationRef: "", bankTransferError: "", bankReceipt: null, bankFavoriteIntent: null, bankFavoriteError: "", bankFavoriteSaved: false }); ctx.renderCurrentApp();
        },
        openFavorite: (favoriteRef) => {
          const favorite = (ctx.getState().bankFavorites || []).find((item) => item.favoriteRef === favoriteRef);
          if (!favorite || !ctx.getState().bankCapabilities?.transfer) return;
          ctx.patchState({ bankView: "favorite_transfer", bankFavoriteIntent: favorite, bankTransferDraft: { ...emptyDraft(), amount: "" }, bankRecipient: null, bankConfirmationRef: "", bankTransferError: "", bankReceipt: null, bankFavoriteError: "", bankFavoriteSaved: false });
          ctx.renderCurrentApp();
        },
        resolveFavoriteTransfer: async () => {
          const state = ctx.getState();
          const amount = Number(state.bankTransferDraft?.amount);
          if (!state.bankFavoriteIntent?.favoriteRef || !Number.isSafeInteger(amount) || amount <= 0) {
            ctx.patchState({ bankTransferError: { code: "invalid_amount" } }); ctx.renderCurrentApp(); return;
          }
          ctx.patchState({ bankTransferBusy: true, bankTransferError: "" }); ctx.renderCurrentApp();
          const result = await window.PhoneAPI.bankRequest("resolve_favorite", { favoriteRef: state.bankFavoriteIntent.favoriteRef, amount });
          if (ctx.getState().currentApp !== "bank") return;
          if (!result || result.ok !== true || !result.data?.confirmationRef) {
            ctx.patchState({ bankTransferBusy: false, bankTransferError: { code: result?.error || "favorite_invalid", message: result?.message || "" } }); ctx.renderCurrentApp(); return;
          }
          ctx.patchState({ bankView: "transfer_confirm", bankTransferBusy: false, bankTransferError: "", bankRecipient: result.data.recipient || null, bankConfirmationRef: result.data.confirmationRef }); ctx.renderCurrentApp();
        },
        saveFavorite: async () => {
          const state = ctx.getState();
          if (state.bankFavoriteBusy || !state.bankConfirmationRef) return;
          ctx.patchState({ bankFavoriteBusy: true, bankFavoriteError: "" }); ctx.renderCurrentApp();
          const result = await window.PhoneAPI.bankRequest("save_favorite", { confirmationRef: state.bankConfirmationRef });
          if (ctx.getState().currentApp !== "bank") return;
          if (!result || result.ok !== true) {
            ctx.patchState({ bankFavoriteBusy: false, bankFavoriteError: { code: result?.error || "database_error", message: result?.message || "" } }); ctx.renderCurrentApp(); return;
          }
          ctx.patchState({ bankFavoriteBusy: false, bankFavoriteError: "", bankFavoriteSaved: true, bankFavorites: Array.isArray(result.data?.favorites) ? result.data.favorites : ctx.getState().bankFavorites }); ctx.renderCurrentApp();
        },
        deleteFavorite: async (favoriteRef) => {
          if (ctx.getState().bankFavoriteBusy || !favoriteRef) return;
          ctx.patchState({ bankFavoriteBusy: true, bankFavoriteError: "" }); ctx.renderCurrentApp();
          const result = await window.PhoneAPI.bankRequest("delete_favorite", { favoriteRef });
          if (ctx.getState().currentApp !== "bank") return;
          ctx.patchState({ bankFavoriteBusy: false, bankFavoriteError: result?.ok === true ? "" : { code: result?.error || "favorite_invalid", message: result?.message || "" }, bankFavorites: result?.ok === true && Array.isArray(result.data?.favorites) ? result.data.favorites : ctx.getState().bankFavorites }); ctx.renderCurrentApp();
        },
        openCardBlock: (cardRef) => {
          const card = (ctx.getState().bankCards || []).find((item) => item.cardRef === cardRef);
          if (!card || card.canBlock !== true || !ctx.getState().bankCapabilities?.blockCard) return;
          ctx.patchState({ bankView: "card_block_confirm", bankCardIntent: { cardRef: card.cardRef, last4: card.last4 }, bankCardBusy: false, bankCardError: "", bankCardMessage: "" });
          ctx.renderCurrentApp();
        },
        cancelCardBlock: () => {
          if (ctx.getState().bankCardBusy) return;
          ctx.patchState({ bankView: "overview", bankCardIntent: null, bankCardError: "" });
          ctx.renderCurrentApp();
        },
        confirmCardBlock: async () => {
          const state = ctx.getState();
          if (state.bankCardBusy || !state.bankCardIntent?.cardRef) return;
          ctx.patchState({ bankCardBusy: true, bankCardError: "" }); ctx.renderCurrentApp();
          const result = await window.PhoneAPI.bankRequest("block_card", { cardRef: state.bankCardIntent.cardRef });
          if (ctx.getState().currentApp !== "bank") return;
          if (!result || result.ok !== true) {
            ctx.patchState({ bankCardBusy: false, bankCardError: { code: result?.error || "card_invalid", message: result?.message || "" } }); ctx.renderCurrentApp(); return;
          }
          ctx.patchState({ bankView: "overview", bankCardIntent: null, bankCardBusy: false, bankCardError: "", bankCardMessage: result.data?.message || "Cartao bloqueado com sucesso.", bankOverview: result.data?.overview || ctx.getState().bankOverview, bankCards: Array.isArray(result.data?.cards) ? result.data.cards : ctx.getState().bankCards, bankFavorites: Array.isArray(result.data?.favorites) ? result.data.favorites : ctx.getState().bankFavorites, bankCapabilities: result.data?.capabilities || ctx.getState().bankCapabilities });
          ctx.renderCurrentApp();
        },
      };

      ctx.patchState({ bankView: "overview", bankLoading: true, bankError: "", bankOverview: null, bankCards: [], bankFavorites: [], bankTransferDraft: emptyDraft(), bankRecipient: null, bankConfirmationRef: "", bankTransferBusy: false, bankTransferError: "", bankReceipt: null, bankCardIntent: null, bankCardBusy: false, bankCardError: "", bankCardMessage: "", bankFavoriteIntent: null, bankFavoriteBusy: false, bankFavoriteError: "", bankFavoriteSaved: false, bankCapabilities: { statement: false, transfer: false, cards: false, blockCard: false } });
      load("open");
    },

    onClose: (ctx) => {
      window.PhoneAPI?.closeBankSession?.();
      ctx.patchState({ bankView: "overview", bankLoading: false, bankError: "", bankOverview: null, bankCards: [], bankFavorites: [], bankTransferDraft: emptyDraft(), bankRecipient: null, bankConfirmationRef: "", bankTransferBusy: false, bankTransferError: "", bankReceipt: null, bankCardIntent: null, bankCardBusy: false, bankCardError: "", bankCardMessage: "", bankFavoriteIntent: null, bankFavoriteBusy: false, bankFavoriteError: "", bankFavoriteSaved: false, bankCapabilities: { statement: false, transfer: false, cards: false, blockCard: false } });
      delete window.MZBankApp;
    },
  });
})();
