MZPhoneServer.Bank = {}

local Bank = MZPhoneServer.Bank
local Security = MZPhoneServer.Security
local Framework = MZPhoneServer.Framework
local Service = MZPhoneServer.Service
local Sessions = {}
local PendingTransfers = {}
local CompletedTransfers = {}
local FavoriteReferences = {}
local API_VERSION = 1

local function response(ok, errorCode, data, message)
    return {
        ok = ok == true,
        error = errorCode,
        message = message,
        data = data
    }
end

local function bankStarted()
    return GetResourceState('mz_bank') == 'started'
end

local function callOpen(source, request)
    local ok, result = pcall(function()
        return exports['mz_bank']:OpenPhoneSession(source, request)
    end)
    if not ok or type(result) ~= 'table' then return nil, 'bank_unavailable' end
    return result
end

local function callClose(source, context)
    local ok, result = pcall(function()
        return exports['mz_bank']:ClosePhoneSession(source, context)
    end)
    return ok and result or nil
end

local function callOverview(source, context)
    local ok, result = pcall(function()
        return exports['mz_bank']:GetAccountOverview(source, context)
    end)
    if not ok or type(result) ~= 'table' then return nil end
    return result
end

local function callStatement(source, filters, context)
    local ok, result = pcall(function()
        return exports['mz_bank']:GetAccountStatement(source, filters, context)
    end)
    if not ok or type(result) ~= 'table' then return nil end
    return result
end

local function callCards(source, context)
    local ok, result = pcall(function()
        return exports['mz_bank']:GetCards(source, context)
    end)
    if not ok or type(result) ~= 'table' then return nil end
    return result
end

local function callBlockCard(source, cardRef, context)
    local ok, result = pcall(function()
        return exports['mz_bank']:BlockCard(source, cardRef, context)
    end)
    if not ok or type(result) ~= 'table' then return nil end
    return result
end

local function callCapabilities(source, context)
    local ok, result = pcall(function()
        return exports['mz_bank']:GetChannelCapabilities(source, context)
    end)
    if not ok or type(result) ~= 'table' then return nil end
    return result
end

local function callResolveRecipient(source, route, context)
    local ok, result = pcall(function()
        return exports['mz_bank']:ResolveTransferRecipient(source, route, context)
    end)
    if not ok or type(result) ~= 'table' then return nil end
    return result
end

local function callTransfer(source, payload, context)
    local ok, result = pcall(function()
        return exports['mz_bank']:Transfer(source, payload, context)
    end)
    if not ok or type(result) ~= 'table' then return nil end
    return result
end

local function callOperationResult(source, request, context)
    local ok, result = pcall(function()
        return exports['mz_bank']:GetOperationResult(source, request, context)
    end)
    if not ok or type(result) ~= 'table' then return nil end
    return result
end

local function sessionContext(session)
    return {
        apiVersion = API_VERSION,
        token = session.token,
        deviceId = session.deviceId
    }
end

local function safePublicAccount(value)
    value = type(value) == 'table' and value or {}
    return {
        branch = tostring(value.branch or ''),
        accountNumber = tostring(value.accountNumber or ''),
        checkDigit = tostring(value.checkDigit or ''),
        formatted = tostring(value.formatted or ''),
        accountType = tostring(value.accountType or ''),
        accountTypeLabel = tostring(value.accountTypeLabel or ''),
        status = tostring(value.status or '')
    }
end

local function safeStatement(rows)
    local out = {}
    for _, row in ipairs(type(rows) == 'table' and rows or {}) do
        out[#out + 1] = {
            type = tostring(row.type or ''),
            description = tostring(row.description or 'Movimentacao bancaria'),
            amount = math.floor(tonumber(row.amount) or 0),
            balanceAfter = tonumber(row.balanceAfter or row.balance_after),
            occurredAt = row.occurredAt or row.created_at
        }
    end
    return out
end

local function safeOverview(result)
    local data = type(result) == 'table' and type(result.data) == 'table' and result.data or {}
    return {
        balance = math.floor(tonumber(data.balance) or 0),
        name = tostring(data.name or 'Cliente'),
        account = tostring(data.account or ''),
        publicAccount = safePublicAccount(data.publicAccount),
        statement = safeStatement(data.statement),
        statementError = data.statementError and tostring(data.statementError) or nil,
        currencySymbol = tostring(data.currencySymbol or 'R$')
    }
end

local function safeCards(result)
    local data = type(result) == 'table' and type(result.data) == 'table' and result.data or {}
    local cards = {}
    for _, card in ipairs(type(data.cards) == 'table' and data.cards or {}) do
        cards[#cards + 1] = {
            cardRef = tostring(card.cardRef or ''),
            last4 = tostring(card.last4 or ''),
            status = tostring(card.status or ''),
            canBlock = card.canBlock == true or tostring(card.status or '') == 'active',
            issuedAt = card.issuedAt,
            updatedAt = card.updatedAt,
            blockedAt = card.blockedAt
        }
    end
    return cards
end

local function generateFavoriteReference(source, index)
    return ('fav_%x_%x_%06d_%s'):format(
        tonumber(source) or 0,
        GetGameTimer(),
        math.random(0, 999999),
        tostring(index or 0)
    )
end

local function safeFavorites(source, session, rows)
    local refs = {}
    local favorites = {}
    for index, row in ipairs(type(rows) == 'table' and rows or {}) do
        local favoriteRef = generateFavoriteReference(source, index)
        refs[favoriteRef] = tonumber(row.id)
        local number = tostring(row.account_number or '')
        favorites[#favorites + 1] = {
            favoriteRef = favoriteRef,
            label = tostring(row.label or 'Conta MZ'),
            branch = tostring(row.branch or ''),
            accountMasked = ('****%s-%s'):format(number:sub(-4), tostring(row.check_digit or '')),
            accountTypeLabel = tostring(row.account_type or '') == 'personal'
                and 'Conta pessoal' or 'Conta bancaria'
        }
    end
    FavoriteReferences[source] = {
        token = tostring(session and session.token or ''),
        refs = refs
    }
    return favorites
end

local function listFavorites(source, session)
    return safeFavorites(
        source,
        session,
        MZPhoneServer.Repository.GetBankFavorites(session.citizenid)
    )
end

local function resolveFavoriteReference(source, session, favoriteRef)
    local bucket = FavoriteReferences[source]
    if type(bucket) ~= 'table' or bucket.token ~= tostring(session.token or '') then return nil end
    return type(bucket.refs) == 'table' and bucket.refs[tostring(favoriteRef or '')] or nil
end

local function safeCapabilities(result)
    local data = type(result) == 'table' and type(result.data) == 'table' and result.data or {}
    local raw = type(data.capabilities) == 'table' and data.capabilities or {}
    return {
        statement = raw.statement == true,
        cards = raw.cards == true,
        transfer = raw.transfer == true,
        blockCard = raw.blockCard == true,
        withdraw = false,
        deposit = false
    }
end

local function safeRecipient(value)
    value = type(value) == 'table' and value or {}
    return {
        displayName = tostring(value.displayName or 'Cliente'),
        branch = tostring(value.branch or ''),
        accountMasked = tostring(value.accountMasked or ''),
        accountTypeLabel = tostring(value.accountTypeLabel or 'Conta pessoal')
    }
end

local function generateTransferReferences(source)
    local stamp = os.time()
    local timer = GetGameTimer()
    local random = math.random(100000, 999999)
    return
        ('confirm_%x_%x_%06d'):format(tonumber(source) or 0, timer, random),
        ('mzphone_%s_%s_%s_%06d'):format(tonumber(source) or 0, stamp, timer, random)
end

local function safeReceipt(result, intent, recovered)
    local data = type(result) == 'table' and type(result.data) == 'table' and result.data or {}
    return {
        confirmed = result and result.ok == true and (data.confirmed ~= false),
        operation = 'transfer',
        amount = math.floor(tonumber(data.amount) or tonumber(intent and intent.amount) or 0),
        fee = math.floor(tonumber(data.fee) or 0),
        correlationId = tostring(data.correlationId or result.correlationId or ''),
        replayed = data.replayed == true or result.replayed == true or recovered == true,
        recipient = safeRecipient(intent and intent.recipient),
        currencySymbol = 'R$'
    }
end

local function clearTransferState(source)
    PendingTransfers[tonumber(source) or source] = nil
    CompletedTransfers[tonumber(source) or source] = nil
end

local function closeSession(source, reason)
    source = tonumber(source)
    local session = source and Sessions[source] or nil
    Sessions[source] = nil
    FavoriteReferences[source] = nil
    clearTransferState(source)
    if session and bankStarted() then
        callClose(source, sessionContext(session))
    end
    if session then
        Security.Log('bank', source, ('session_closed reason=%s'):format(tostring(reason or 'cleanup')))
    end
end

local function ensureSession(source)
    if not bankStarted() then return nil, 'bank_unavailable' end
    local identity, identityErr = Security.RequireIdentity(source, { context = 'bank_phone_session' })
    if not identity then return nil, identityErr or 'identity_unavailable' end

    local hasPhone, phoneItemErr = Framework.HasPhoneItem(source)
    if not hasPhone then return nil, phoneItemErr or 'missing_phone' end
    local deviceId, numberErr = Service.EnsurePhoneNumber(identity)
    if not deviceId then return nil, numberErr or 'device_unavailable' end

    local current = Sessions[source]
    if current and current.citizenid == identity.citizenid and current.deviceId == deviceId then
        return current
    end
    if current then closeSession(source, 'identity_or_device_changed') end

    local opened, openErr = callOpen(source, {
        apiVersion = API_VERSION,
        deviceId = deviceId
    })
    if not opened or opened.ok ~= true or type(opened.data) ~= 'table'
        or tostring(opened.data.token or '') == '' then
        return nil, (opened and opened.error) or openErr or 'bank_unavailable'
    end

    local session = {
        citizenid = identity.citizenid,
        deviceId = deviceId,
        token = tostring(opened.data.token)
    }
    Sessions[source] = session
    Security.Log('bank', source, 'session_opened channel=phone token=server_only')
    return session
end

local function retryableSessionError(result)
    return type(result) == 'table'
        and (result.error == 'invalid_session' or result.error == 'session_expired')
end

local function withSession(source, callback)
    local session, sessionErr = ensureSession(source)
    if not session then return nil, sessionErr end
    local result = callback(sessionContext(session))
    if retryableSessionError(result) then
        closeSession(source, 'bank_session_rejected')
        session, sessionErr = ensureSession(source)
        if not session then return nil, sessionErr end
        result = callback(sessionContext(session))
    end
    if type(result) ~= 'table' then return nil, 'bank_unavailable' end
    return result
end

local function loadOverview(source)
    local overview, overviewErr = withSession(source, function(context)
        return callOverview(source, context)
    end)
    if not overview then return response(false, overviewErr) end
    if overview.ok ~= true then return response(false, overview.error, nil, overview.message) end

    local cards = withSession(source, function(context)
        return callCards(source, context)
    end)
    local capabilities = withSession(source, function(context)
        return callCapabilities(source, context)
    end)
    local favoriteSession = Sessions[source]
    local favorites = favoriteSession and listFavorites(source, favoriteSession) or {}
    return response(true, nil, {
        overview = safeOverview(overview),
        cards = cards and cards.ok == true and safeCards(cards) or {},
        favorites = favorites,
        cardsError = cards and cards.ok ~= true and cards.error or (not cards and 'bank_unavailable' or nil),
        capabilities = capabilities and capabilities.ok == true and safeCapabilities(capabilities) or {
            statement = true, cards = true, transfer = false, withdraw = false, deposit = false
        }
    })
end

local function beginTransferResolution(source, route, rawAmount)
    if type(rawAmount) ~= 'number' or rawAmount ~= math.floor(rawAmount)
        or rawAmount <= 0 then
        return response(false, 'invalid_amount')
    end
    route = type(route) == 'table' and route or {}
    local normalizedRoute = {
        branch = tostring(route.branch or ''),
        accountNumber = tostring(route.accountNumber or route.account_number or ''),
        checkDigit = tostring(route.checkDigit or route.check_digit or ''),
        accountType = tostring(route.accountType or route.account_type or 'personal')
    }
    local result, err = withSession(source, function(context)
        return callResolveRecipient(source, normalizedRoute, context)
    end)
    if not result then return response(false, err) end
    if result.ok ~= true or type(result.data) ~= 'table'
        or tostring(result.data.resolutionToken or '') == '' then
        return response(false, result.error or 'recipient_unavailable', nil, result.message)
    end

    local confirmationRef, idempotencyKey = generateTransferReferences(source)
    local expiresIn = math.max(1, math.floor(tonumber(result.data.expiresIn) or 60))
    local recipient = safeRecipient(result.data.recipient)
    PendingTransfers[source] = {
        confirmationRef = confirmationRef,
        resolutionToken = tostring(result.data.resolutionToken),
        idempotencyKey = idempotencyKey,
        recipient = recipient,
        route = normalizedRoute,
        amount = rawAmount,
        expiresAt = os.time() + expiresIn
    }
    return response(true, nil, {
        confirmationRef = confirmationRef,
        recipient = recipient,
        expiresIn = expiresIn
    })
end

function Bank.HandleRequest(source, action, payload)
    source = tonumber(source)
    action = tostring(action or ''):lower()
    payload = type(payload) == 'table' and payload or {}
    if not source or source <= 0 then return response(false, 'invalid_source') end
    if not Security.RateLimit(source, 'bank') then return response(false, 'rate_limited') end

    if action == 'open' or action == 'refresh' or action == 'overview' then
        return loadOverview(source)
    end
    if action == 'statement' then
        local result, err = withSession(source, function(context)
            return callStatement(source, { limit = tonumber(payload.limit) or 15 }, context)
        end)
        if not result then return response(false, err) end
        if result.ok ~= true then return response(false, result.error, nil, result.message) end
        return response(true, nil, { statement = safeStatement(result.data and result.data.statement) })
    end
    if action == 'cards' then
        local result, err = withSession(source, function(context)
            return callCards(source, context)
        end)
        if not result then return response(false, err) end
        if result.ok ~= true then return response(false, result.error, nil, result.message) end
        return response(true, nil, { cards = safeCards(result) })
    end
    if action == 'favorites' then
        local session, err = ensureSession(source)
        if not session then return response(false, err) end
        return response(true, nil, { favorites = listFavorites(source, session) })
    end
    if action == 'block_card' then
        local cardRef = tostring(payload.cardRef or '')
        if cardRef == '' or #cardRef > 160 or cardRef:match('^[%w_%-]+$') == nil then
            return response(false, 'card_invalid')
        end
        local result, err = withSession(source, function(context)
            return callBlockCard(source, cardRef, context)
        end)
        if not result then return response(false, err) end
        if result.ok ~= true then return response(false, result.error, nil, result.message) end

        local refreshed = loadOverview(source)
        return response(true, nil, {
            message = tostring(result.message or 'Cartao bloqueado com sucesso.'),
            overview = refreshed.ok == true and refreshed.data and refreshed.data.overview or nil,
            cards = refreshed.ok == true and refreshed.data and refreshed.data.cards or {},
            favorites = refreshed.ok == true and refreshed.data and refreshed.data.favorites or {},
            capabilities = refreshed.ok == true and refreshed.data and refreshed.data.capabilities or nil,
            refreshError = refreshed.ok ~= true and (refreshed.error or 'bank_unavailable') or nil
        })
    end
    if action == 'resolve_transfer' then
        return beginTransferResolution(source, {
            branch = payload.branch,
            accountNumber = payload.accountNumber,
            checkDigit = payload.checkDigit,
            accountType = 'personal'
        }, payload.amount)
    end
    if action == 'resolve_favorite' then
        local session, sessionErr = ensureSession(source)
        if not session then return response(false, sessionErr) end
        local favoriteId = resolveFavoriteReference(source, session, payload.favoriteRef)
        if not favoriteId then return response(false, 'favorite_invalid') end
        local favorite = MZPhoneServer.Repository.GetBankFavorite(session.citizenid, favoriteId)
        if not favorite then return response(false, 'favorite_invalid') end
        return beginTransferResolution(source, favorite, payload.amount)
    end
    if action == 'confirm_transfer' then
        local confirmationRef = tostring(payload.confirmationRef or '')
        local completed = type(CompletedTransfers[source]) == 'table'
            and CompletedTransfers[source][confirmationRef] or nil
        if completed and completed.expiresAt > os.time() then
            return response(true, nil, { receipt = completed.receipt })
        end

        local intent = PendingTransfers[source]
        if type(intent) ~= 'table' or intent.confirmationRef ~= confirmationRef
            or intent.expiresAt <= os.time() then
            PendingTransfers[source] = nil
            return response(false, 'invalid_resolution_token')
        end
        local result, err = withSession(source, function(context)
            return callTransfer(source, {
                resolutionToken = intent.resolutionToken,
                amount = intent.amount,
                idempotencyKey = intent.idempotencyKey
            }, context)
        end)
        if not result then return response(false, err) end

        local ambiguous = {
            bank_unavailable = true,
            database_error = true,
            operation_busy = true,
            account_busy = true,
            request_timeout = true
        }
        local recovered = false
        if result.ok ~= true and ambiguous[tostring(result.error or '')] then
            local operationResult = withSession(source, function(context)
                return callOperationResult(source, {
                    operation = 'transfer',
                    idempotencyKey = intent.idempotencyKey
                }, context)
            end)
            if operationResult and operationResult.ok == true then
                result = operationResult
                recovered = true
            end
        end

        if result.ok ~= true then
            if result.error ~= 'invalid_amount' and result.error ~= 'transaction_limit'
                and not ambiguous[tostring(result.error or '')] then
                PendingTransfers[source] = nil
            end
            return response(false, result.error or 'transaction_failed', nil, result.message)
        end

        local receipt = safeReceipt(result, intent, recovered)
        if receipt.correlationId == '' then
            return response(false, 'transaction_failed')
        end
        PendingTransfers[source] = nil
        CompletedTransfers[source] = CompletedTransfers[source] or {}
        CompletedTransfers[source][confirmationRef] = {
            receipt = receipt,
            favoriteRoute = intent.route,
            favoriteLabel = intent.recipient and intent.recipient.displayName or 'Conta MZ',
            expiresAt = os.time() + 120
        }
        local refreshed = loadOverview(source)
        return response(true, nil, {
            receipt = receipt,
            overview = refreshed.ok == true and refreshed.data and refreshed.data.overview or nil,
            cards = refreshed.ok == true and refreshed.data and refreshed.data.cards or nil,
            capabilities = refreshed.ok == true and refreshed.data and refreshed.data.capabilities or nil,
            favorites = refreshed.ok == true and refreshed.data and refreshed.data.favorites or nil,
            refreshError = refreshed.ok ~= true and (refreshed.error or 'bank_unavailable') or nil
        })
    end
    if action == 'save_favorite' then
        local confirmationRef = tostring(payload.confirmationRef or '')
        local completed = type(CompletedTransfers[source]) == 'table'
            and CompletedTransfers[source][confirmationRef] or nil
        if not completed or completed.expiresAt <= os.time()
            or type(completed.favoriteRoute) ~= 'table' then
            return response(false, 'favorite_invalid')
        end
        local session, sessionErr = ensureSession(source)
        if not session then return response(false, sessionErr) end
        local existing = MZPhoneServer.Repository.GetBankFavoriteByRoute(
            session.citizenid, completed.favoriteRoute
        )
        local maxFavorites = math.max(1, math.floor(tonumber(
            Config.Phone and Config.Phone.Bank and Config.Phone.Bank.MaxFavorites
        ) or 12))
        if not existing
            and MZPhoneServer.Repository.CountBankFavorites(session.citizenid) >= maxFavorites then
            return response(false, 'favorite_limit')
        end
        local label = Security.SanitizeText(completed.favoriteLabel, 80)
        if label == '' then label = 'Conta MZ' end
        local saved = MZPhoneServer.Repository.UpsertBankFavorite(
            session.citizenid, label, completed.favoriteRoute
        )
        if not saved then return response(false, 'database_error') end
        return response(true, nil, { favorites = listFavorites(source, session) })
    end
    if action == 'delete_favorite' then
        local session, sessionErr = ensureSession(source)
        if not session then return response(false, sessionErr) end
        local favoriteId = resolveFavoriteReference(source, session, payload.favoriteRef)
        if not favoriteId then return response(false, 'favorite_invalid') end
        local deleted = MZPhoneServer.Repository.DeleteBankFavorite(session.citizenid, favoriteId)
        if tonumber(deleted) ~= 1 then return response(false, 'favorite_invalid') end
        return response(true, nil, { favorites = listFavorites(source, session) })
    end
    if action == 'close' then
        closeSession(source, 'app_close')
        return response(true)
    end

    return response(false, 'operation_not_available')
end

function Bank.Close(source, reason)
    closeSession(source, reason)
end

AddEventHandler('playerDropped', function()
    closeSession(source, 'player_dropped')
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName == 'mz_bank' then
        Sessions = {}
        return
    end
    if resourceName ~= GetCurrentResourceName() then return end
    for source in pairs(Sessions) do closeSession(source, 'phone_resource_stop') end
end)
