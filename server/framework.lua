MZPhoneServer = MZPhoneServer or {}
MZPhoneServer.Framework = {}

local LastWaitDiagnostics = {}
local LastIdentityDiagnostics = {}

local function resourceStarted(resourceName)
    return GetResourceState(resourceName) == 'started'
end

local function callExport(resourceName, exportName, ...)
    if not resourceStarted(resourceName) then
        return false, nil, 'resource_not_started'
    end

    local args = { ... }
    local ok, result, extra = pcall(function()
        local resourceExports = exports[resourceName]
        if not resourceExports then
            error(('resource_exports_unavailable:%s'):format(tostring(resourceName)))
        end

        local exportFn = resourceExports[exportName]
        if type(exportFn) ~= 'function' then
            error(('no_such_export:%s'):format(tostring(exportName)))
        end

        -- FiveM Lua exports are normally called with method syntax:
        -- exports['resource']:ExportName(...)
        -- For dynamic export names, pass the resource proxy as the first
        -- argument to preserve the same call contract.
        return exportFn(resourceExports, table.unpack(args))
    end)

    if not ok then
        return false, nil, result
    end

    return true, result, extra
end

local function summarizeTable(value)
    if type(value) ~= 'table' then
        return tostring(value)
    end

    local state = type(value.state) == 'table' and value.state or {}
    local session = type(value.session) == 'table' and value.session or {}

    return ('type=table source=%s citizenid=%s loaded=%s session=%s charinfo=%s'):format(
        tostring(value.source),
        MZPhoneServer.Security.Mask(value.citizenid or value.char_id or value.user_id or value.identifier),
        tostring(state.loaded),
        tostring(session.id or ''),
        tostring(type(value.charinfo))
    )
end

local function listTableFields(value)
    if type(value) ~= 'table' then
        return ''
    end

    local fields = {}
    for key in pairs(value) do
        fields[#fields + 1] = tostring(key)
    end

    table.sort(fields)
    return table.concat(fields, ',')
end

local function buildRawDiagnostics(source)
    local loaded, loadedErr = MZPhoneServer.Framework.IsPlayerLoaded(source)
    local okPlayer, rawPlayer, playerErr = callExport(Config.Framework.Resource, 'GetPlayer', source)
    local session, sessionErr = MZPhoneServer.Framework.GetPlayerSession(source)

    return {
        coreIsLoadedRaw = loaded,
        coreIsLoadedError = loadedErr or '',
        coreGetPlayerType = okPlayer and type(rawPlayer) or 'export_error',
        coreGetPlayerFields = okPlayer and listTableFields(rawPlayer) or '',
        coreGetPlayerSummary = okPlayer and summarizeTable(rawPlayer) or ('export_error=' .. tostring(playerErr)),
        coreGetSessionType = session and type(session) or 'nil',
        coreGetSessionFields = listTableFields(session),
        coreGetSessionSummary = session and summarizeTable(session) or tostring(sessionErr or 'nil')
    }
end

local function recordIdentityDiagnostics(source, identity, err)
    LastIdentityDiagnostics[source] = {
        resolved = type(identity) == 'table' and tostring(identity.citizenid or '') ~= '',
        source = identity and identity.loadedFrom or '',
        citizenid = identity and identity.citizenid or '',
        error = err or '',
        phone = identity and identity.phone or ''
    }
end

local function normalizeResolvedIdentity(raw)
    if type(raw) ~= 'table' then
        return nil
    end

    if type(raw.data) == 'table' then
        raw = raw.data
    elseif type(raw.identity) == 'table' then
        raw = raw.identity
    elseif type(raw.result) == 'table' then
        raw = raw.result
    end

    if raw.ok == false then
        return nil
    end

    if raw.success == false then
        return nil
    end

    if tostring(raw.citizenid or '') == '' then
        return nil
    end

    return raw
end

local function summarizeIdentityReturn(raw)
    if raw == nil then
        return 'nil'
    end

    if type(raw) ~= 'table' then
        return ('type=%s value=%s'):format(type(raw), tostring(raw))
    end

    local payload = raw
    if type(raw.data) == 'table' then
        payload = raw.data
    elseif type(raw.identity) == 'table' then
        payload = raw.identity
    elseif type(raw.result) == 'table' then
        payload = raw.result
    end

    return ('type=table ok=%s success=%s citizenid=%s loadedFrom=%s error=%s payloadType=%s'):format(
        tostring(raw.ok),
        tostring(raw.success),
        MZPhoneServer.Security.Mask(payload.citizenid),
        tostring(payload.loadedFrom or raw.loadedFrom or ''),
        tostring(raw.error or raw.err or ''),
        type(payload)
    )
end

function MZPhoneServer.Framework.IsPlayerLoaded(source)
    local ok, loaded, detail = callExport(Config.Framework.Resource, 'IsPlayerLoaded', source)
    if ok then
        return loaded == true, nil
    end

    return false, detail or 'is_loaded_unavailable'
end

function MZPhoneServer.Framework.GetPlayerSession(source)
    local ok, session, detail = callExport(Config.Framework.Resource, 'GetPlayerSession', source)
    if ok then
        return session
    end

    return nil, detail
end

function MZPhoneServer.Framework.GetPlayer(source)
    local ok, player = callExport(Config.Framework.Resource, 'GetPlayer', source)
    if ok and type(player) == 'table' then
        MZPhoneServer.Security.Log(
            'framework',
            source,
            ('GetPlayer ok character=%s'):format(MZPhoneServer.Security.Mask(player.citizenid or player.char_id or player.user_id or player.identifier))
        )
        return player
    end

    MZPhoneServer.Security.Log('framework', source, 'GetPlayer nil')

    return nil
end

function MZPhoneServer.Framework.EnsurePlayerLoaded(source)
    local ok, player, detail = callExport(Config.Framework.Resource, 'EnsurePlayerLoaded', source)
    if ok and type(player) == 'table' then
        MZPhoneServer.Security.Log(
            'framework',
            source,
            ('EnsurePlayerLoaded ok status=%s character=%s'):format(
                tostring(detail or 'unknown'),
                MZPhoneServer.Security.Mask(player.citizenid or player.char_id or player.user_id or player.identifier)
            )
        )

        return player, detail or 'loaded'
    end

    MZPhoneServer.Security.Log(
        'framework',
        source,
        ('EnsurePlayerLoaded failed detail=%s'):format(tostring(detail or player or 'unavailable'))
    )

    return nil, detail or player or 'ensure_unavailable'
end

function MZPhoneServer.Framework.GetPlayerByCitizenId(citizenid)
    local ok, player = callExport(Config.Framework.Resource, 'GetPlayerByCitizenId', citizenid)
    if ok and type(player) == 'table' then
        return player
    end

    return nil
end

function MZPhoneServer.Framework.WaitForPlayer(source)
    local timeoutMs = tonumber(Config.Framework.PlayerLoadWaitMs) or 0
    local stepMs = tonumber(Config.Framework.PlayerLoadStepMs) or 250
    local started = GetGameTimer()
    local diagnostics = {
        waitedMs = 0,
        ensureTried = false,
        ensureResult = '',
        loadedEvent = 'mz_core:client:playerLoaded'
    }

    local function finish(player, result)
        diagnostics.waitedMs = GetGameTimer() - started
        diagnostics.result = result or (player and 'loaded' or 'not_loaded')
        for key, value in pairs(buildRawDiagnostics(source)) do
            diagnostics[key] = value
        end
        LastWaitDiagnostics[source] = diagnostics
        return player
    end

    local loaded = MZPhoneServer.Framework.IsPlayerLoaded(source)
    local player = MZPhoneServer.Framework.GetPlayer(source)

    if loaded and type(player) == 'table' then
        return finish(player, 'already_loaded')
    end

    diagnostics.ensureTried = true
    player, diagnostics.ensureResult = MZPhoneServer.Framework.EnsurePlayerLoaded(source)

    if type(player) == 'table' then
        local citizenid = MZPhoneServer.Framework.GetCharacterId(player)
        if citizenid then
            return finish(player, diagnostics.ensureResult)
        end
    end

    repeat
        loaded = MZPhoneServer.Framework.IsPlayerLoaded(source)
        player = MZPhoneServer.Framework.GetPlayer(source)

        if loaded and type(player) == 'table' then
            return finish(player, 'loaded_after_wait')
        end

        if timeoutMs <= 0 or GetGameTimer() - started >= timeoutMs then
            return finish(nil, 'timeout')
        end

        Wait(stepMs)
    until false
end

function MZPhoneServer.Framework.GetPlayerDiagnostics(source)
    local diagnostics = buildRawDiagnostics(source)
    local waitDiagnostics = LastWaitDiagnostics[source] or {}
    local identityDiagnostics = LastIdentityDiagnostics[source] or {}

    diagnostics.waitedMs = waitDiagnostics.waitedMs or 0
    diagnostics.waitResult = waitDiagnostics.result or ''
    diagnostics.ensureTried = waitDiagnostics.ensureTried == true
    diagnostics.ensureResult = waitDiagnostics.ensureResult or ''
    diagnostics.loadedEvent = waitDiagnostics.loadedEvent or 'mz_core:client:playerLoaded'
    diagnostics.identityResolved = identityDiagnostics.resolved == true
    diagnostics.identitySource = identityDiagnostics.source or ''
    diagnostics.identityCitizenId = identityDiagnostics.citizenid or ''
    diagnostics.identityError = identityDiagnostics.error or ''
    diagnostics.phoneFromMzPlayers = identityDiagnostics.phone or ''

    return diagnostics
end

function MZPhoneServer.Framework.GetCharacterId(player)
    if type(player) ~= 'table' then
        return nil, 'player_not_table'
    end

    local value = player.citizenid
    value = tostring(value or '')

    if value == '' then
        return nil, 'missing_citizenid'
    end

    return value, nil
end

function MZPhoneServer.Framework.ResolveIdentity(source)
    MZPhoneServer.Security.LogSource('framework/ResolveIdentity', source, true)

    local normalizedSource, sourceErr = MZPhoneServer.Security.NormalizeSource(source)
    if not normalizedSource then
        recordIdentityDiagnostics(source, nil, sourceErr)
        MZPhoneServer.Security.Log(
            'identity',
            source,
            ('resolve_failed reason=%s before_core source=%s type=%s'):format(tostring(sourceErr), tostring(source), type(source)),
            true
        )
        return nil, sourceErr
    end

    local coreState = GetResourceState(Config.Framework.Resource)
    local ok, rawIdentity, detail = callExport(Config.Framework.Resource, 'ResolvePlayerIdentity', normalizedSource)
    local identity = normalizeResolvedIdentity(rawIdentity)

    MZPhoneServer.Security.Log(
        'identity',
        normalizedSource,
        ('ResolvePlayerIdentity core=%s ok=%s rawType=%s detail=%s raw=%s hasCitizenid=%s'):format(
            tostring(coreState),
            tostring(ok),
            type(rawIdentity),
            tostring(detail or ''),
            summarizeIdentityReturn(rawIdentity),
            tostring(identity ~= nil)
        ),
        true
    )

    if ok and identity then
        recordIdentityDiagnostics(normalizedSource, identity, nil)
        MZPhoneServer.Security.Log(
            'identity',
            normalizedSource,
            ('resolved source=%s citizenid=%s phone=%s'):format(
                tostring(identity.loadedFrom or ''),
                MZPhoneServer.Security.Mask(identity.citizenid),
                identity.phone and identity.phone ~= '' and 'set' or 'empty'
            )
        )

        return identity
    end

    local reason = detail or (type(rawIdentity) == 'table' and (rawIdentity.error or rawIdentity.err)) or rawIdentity

    if not ok then
        reason = tostring(reason or 'pcall_error')
        if reason:find('no_such_export', 1, true) then
            reason = 'no_such_export'
        else
            reason = 'pcall_error'
        end
    elseif rawIdentity == nil then
        reason = 'nil_return'
    elseif type(rawIdentity) ~= 'table' then
        reason = 'invalid_return_format'
    elseif not identity then
        reason = reason or 'missing_citizenid'
    end

    recordIdentityDiagnostics(normalizedSource, nil, reason)
    MZPhoneServer.Security.Log(
        'identity',
        normalizedSource,
        ('resolve_failed reason=%s'):format(tostring(reason)),
        true
    )

    return nil, reason
end

function MZPhoneServer.Framework.LogPlayerNotLoaded(source, context)
    local coreState = GetResourceState(Config.Framework.Resource)
    local diagnostics = MZPhoneServer.Framework.GetPlayerDiagnostics(source)

    MZPhoneServer.Security.Log(
        'identity_unavailable',
        source,
        ('context=%s core=%s identityResolved=%s identitySource=%s identityErr=%s isLoaded=%s loadedErr=%s player=%s playerFields=%s session=%s sessionFields=%s waitedMs=%s ensureTried=%s ensureResult=%s'):format(
            tostring(context or 'unknown'),
            tostring(coreState),
            tostring(diagnostics.identityResolved),
            tostring(diagnostics.identitySource),
            tostring(diagnostics.identityError),
            tostring(diagnostics.coreIsLoadedRaw),
            tostring(diagnostics.coreIsLoadedError),
            tostring(diagnostics.coreGetPlayerSummary),
            tostring(diagnostics.coreGetPlayerFields),
            tostring(diagnostics.coreGetSessionSummary),
            tostring(diagnostics.coreGetSessionFields),
            tostring(diagnostics.waitedMs),
            tostring(diagnostics.ensureTried),
            tostring(diagnostics.ensureResult)
        ),
        true
    )
end

function MZPhoneServer.Framework.GetSourceByCitizenId(citizenid)
    local ok, source = callExport(Config.Framework.Resource, 'GetSourceByCitizenId', citizenid)
    if ok and source then
        return source
    end

    local player = MZPhoneServer.Framework.GetPlayerByCitizenId(citizenid)
    return player and player.source or nil
end

function MZPhoneServer.Framework.GetIdentity(source, options)
    options = type(options) == 'table' and options or {}

    local resolved, resolveErr = MZPhoneServer.Framework.ResolveIdentity(source)
    if not resolved then
        MZPhoneServer.Framework.LogPlayerNotLoaded(source, options.context or 'get_identity')
        return nil, resolveErr or 'identity_unavailable'
    end

    local citizenid, idErr = MZPhoneServer.Framework.GetCharacterId(resolved)
    if not citizenid then
        MZPhoneServer.Security.Log(
            'identity_unavailable',
            source,
            ('context=%s identifier_error=%s identity_source=%s'):format(
                tostring(options.context or 'get_identity'),
                tostring(idErr),
                tostring(resolved.loadedFrom or '')
            ),
            true
        )
        return nil, idErr
    end

    return {
        source = source,
        citizenid = citizenid,
        characterId = citizenid,
        identitySource = tostring(resolved.loadedFrom or ''),
        identifier = '',
        firstname = tostring(resolved.firstname or ''),
        lastname = tostring(resolved.lastname or ''),
        birthdate = tostring(resolved.birthdate or ''),
        nationality = tostring(resolved.nationality or ''),
        phone = tostring(resolved.phone or '')
    }
end

function MZPhoneServer.Framework.HasPhoneItem(source)
    if Config.Phone.RequireItem ~= true then
        return true, nil
    end

    local itemName = Config.Phone.ItemName or 'phone'
    local adapter = Config.Inventory.Adapter or 'mz_core'

    if adapter == 'mz_core' then
        local player = MZPhoneServer.Framework.GetPlayer(source)
        if not player then
            local ensured, ensureReason = MZPhoneServer.Framework.EnsurePlayerLoaded(source)
            MZPhoneServer.Security.Log(
                'inventory',
                source,
                ('ensure_for_inventory result=%s reason=%s'):format(tostring(ensured ~= nil), tostring(ensureReason or ''))
            )
        end

        local ok, result, detail = callExport(Config.Framework.Resource, 'HasPlayerItem', source, itemName, 1)
        if ok then
            MZPhoneServer.Security.Log(
                'inventory',
                source,
                ('HasPlayerItem item=%s result=%s detail=%s'):format(tostring(itemName), tostring(result), tostring(detail))
            )

            if result == true then
                return true, nil
            end

            if type(detail) == 'number' then
                return false, 'missing_phone'
            end

            if detail == 'player_not_loaded' then
                return false, 'inventory_unavailable'
            end

            return false, detail or 'missing_phone'
        end

        MZPhoneServer.Security.Log(
            'framework',
            source,
            ('HasPlayerItem unavailable item=%s detail=%s'):format(tostring(itemName), tostring(detail))
        )

        return false, 'inventory_unavailable'
    end

    if adapter == 'ox_inventory' and resourceStarted('ox_inventory') then
        local ok, count = pcall(function()
            return exports.ox_inventory:Search(source, 'count', itemName)
        end)
        if ok then
            if (tonumber(count) or 0) > 0 then
                return true, nil
            end

            return false, 'missing_phone'
        end

        return false, 'inventory_unavailable'
    end

    return false, 'inventory_unavailable'
end

function MZPhoneServer.Framework.Notify(source, data)
    local notifyResource = Config.Framework.NotifyResource
    if resourceStarted(notifyResource) then
        local ok = pcall(function()
            exports[notifyResource]:Notify(source, data or {})
        end)

        if ok then
            return
        end
    end

    TriggerClientEvent('mz_phone:client:notify', source, data or {})
end

function MZPhoneServer.Framework.SyncPhoneToCore(source, phoneNumber)
    if Config.Phone.SyncGeneratedNumberToCore ~= true then
        return false, 'disabled'
    end

    local identity, identityErr = MZPhoneServer.Framework.GetIdentity(source, { context = 'sync_phone_to_core' })
    if not identity then
        return false, identityErr or 'identity_unavailable'
    end

    local ok, result, detail = callExport(Config.Framework.Resource, 'SetPlayerPhoneByCitizenId', identity.citizenid, phoneNumber)
    if ok then
        return result, detail
    end

    return false, 'export_failed'
end
