MZPhoneServer = MZPhoneServer or {}
MZPhoneServer.Service = {}

local Repository = MZPhoneServer.Repository
local Security = MZPhoneServer.Security
local Framework = MZPhoneServer.Framework

local function fullName(identity)
    local name = ((identity.firstname or '') .. ' ' .. (identity.lastname or '')):gsub('^%s+', ''):gsub('%s+$', '')
    if name == '' then
        name = 'Desconhecido'
    end
    return name
end

local function randomDigits(length)
    local output = ''
    for _ = 1, length do
        output = output .. tostring(math.random(0, 9))
    end
    return output
end

local function generatePhoneNumber()
    return tostring(Config.Phone.NumberPrefix or '') .. randomDigits(Config.Phone.NumberDigits or 6)
end

local function decodeSettingsJson(value)
    if type(value) ~= 'string' or value == '' then
        return {}
    end

    local ok, decoded = pcall(json.decode, value)
    if ok and type(decoded) == 'table' then
        return decoded
    end

    return {}
end

local function ensureSettings(identity)
    local settings = Repository.GetSettings(identity.citizenid)
    if settings then
        return settings, 'loaded'
    end

    Repository.SaveSettings(identity.citizenid, {
        theme = 'dark',
        wallpaper = 'default',
        ringtone = 'default',
        profilePhoto = '',
        settings = {}
    })

    settings = Repository.GetSettings(identity.citizenid)
    Security.Log('settings', identity.source, ('%s citizenid=%s'):format(settings and 'created' or 'create_failed', Security.Mask(identity.citizenid)))

    return settings or {}, settings and 'created' or 'not_created'
end

function MZPhoneServer.Service.EnsurePhoneNumber(identity)
    if identity.phone and identity.phone ~= '' then
        local normalizedCorePhone = Security.NormalizePhone(identity.phone)
        local existingOwner = Repository.GetPhoneByNumber(normalizedCorePhone)
        local status = existingOwner and 'existing' or 'synced'

        if existingOwner and existingOwner.citizenid ~= identity.citizenid then
            Security.Log(
                'number',
                identity.source,
                ('core_phone_collision phone_owner=%s'):format(Security.Mask(existingOwner.citizenid))
            )
            Repository.ReleasePhoneNumber(normalizedCorePhone, identity.citizenid)
            status = 'synced'
        end

        Repository.CreatePhoneNumber(identity.citizenid, normalizedCorePhone)
        Security.Log('number', identity.source, ('using_mz_players_phone number=%s'):format(tostring(normalizedCorePhone)))
        return normalizedCorePhone, status
    end

    local row = Repository.GetPhoneByCharacter(identity.citizenid)
    if row and row.phone_number then
        Framework.SyncPhoneToCore(identity.source, row.phone_number)
        Security.Log('number', identity.source, ('loaded number=%s'):format(tostring(row.phone_number)))
        return row.phone_number, 'synced'
    end

    local maxRetries = tonumber(Config.Phone.NumberRetries) or 10
    for attempt = 1, maxRetries do
        local number = generatePhoneNumber()
        if not Repository.GetPhoneByNumber(number) then
            Repository.CreatePhoneNumber(identity.citizenid, number)
            Framework.SyncPhoneToCore(identity.source, number)
            Security.Log('number', identity.source, ('generated number=%s attempt=%s'):format(tostring(number), tostring(attempt)))
            return number, 'created'
        end

        Security.Log('number', identity.source, ('collision attempt=%s'):format(tostring(attempt)))
    end

    Security.Log('number', identity.source, 'generation_failed')
    return nil, 'number_generation_failed'
end

local function buildDefaults(identity, phoneNumber)
    local settings = ensureSettings(identity)
    local extraSettings = decodeSettingsJson(settings.settings)
    local contacts = Repository.GetContacts(identity.citizenid)
    local conversations = Repository.GetConversations(identity.citizenid)
    local calls = Repository.GetCalls(identity.citizenid)

    Security.Log(
        'load',
        identity.source,
        ('settings=%s contacts=%s conversations=%s'):format(settings.id and 'loaded' or 'not_created', tostring(#contacts), tostring(#conversations))
    )

    return {
        theme = settings.theme or 'dark',
        wallpaper = settings.wallpaper or 'default',
        customWallpaper = extraSettings.customWallpaper or '',
        ringtone = settings.ringtone or 'default',
        profilePhoto = settings.profile_photo or '',
        playerProfile = {
            firstname = identity.firstname or '',
            lastname = identity.lastname or '',
            phoneNumber = phoneNumber or '',
            citizenid = identity.citizenid or '',
            nationality = identity.nationality or '',
            birthdate = identity.birthdate or ''
        },
        contacts = contacts,
        conversations = conversations,
        calls = calls,
        notes = {},
        noteDraft = '',
        contactSearch = '',
        selectedContactId = nil,
        contactDraft = { id = nil, name = '', number = '', avatar = '' },
        selectedConversationId = nil,
        messageDraft = '',
        messagesDeepOpen = false,
        status = { time = '', signal = 4, battery = 100 }
    }
end

function MZPhoneServer.Service.BuildDebugReport(source)
    Security.LogSource('service/BuildDebugReport', source, true)

    local coreResource = Config.Framework.Resource
    local notifyResource = Config.Framework.NotifyResource
    local identity = MZPhoneServer.Framework.GetIdentity(source)
    local diagnostics = MZPhoneServer.Framework.GetPlayerDiagnostics(source)
    local hasPhone = false
    local itemReason = 'identity_unavailable'

    if identity then
        hasPhone, itemReason = Framework.HasPhoneItem(source)
    end

    local report = {
        resource = GetCurrentResourceName(),
        phoneStarted = GetResourceState(GetCurrentResourceName()) == 'started',
        coreState = GetResourceState(coreResource),
        notifyState = GetResourceState(notifyResource),
        identityResolved = identity ~= nil,
        identitySource = identity and identity.identitySource or diagnostics.identitySource,
        identityError = identity and '' or (diagnostics.identityError ~= '' and diagnostics.identityError or 'identity_unavailable'),
        playerLoaded = diagnostics.coreIsLoadedRaw == true,
        characterId = identity and Security.Mask(identity.citizenid) or '',
        citizenid = identity and Security.Mask(identity.citizenid) or Security.Mask(diagnostics.identityCitizenId),
        phoneFromMzPlayers = identity and (identity.phone ~= '' and identity.phone or 'empty') or 'empty',
        itemName = Config.Phone.ItemName,
        hasPhone = hasPhone == true,
        itemReason = itemReason or '',
        phoneNumber = '',
        phoneNumberStatus = 'not_created',
        contacts = 0,
        conversations = 0,
        settings = 'not_loaded',
        coreIsLoadedRaw = diagnostics.coreIsLoadedRaw,
        coreIsLoadedError = diagnostics.coreIsLoadedError,
        coreGetPlayerType = diagnostics.coreGetPlayerType,
        coreGetPlayerFields = diagnostics.coreGetPlayerFields,
        coreGetPlayerSummary = diagnostics.coreGetPlayerSummary,
        coreGetSessionType = diagnostics.coreGetSessionType,
        coreGetSessionFields = diagnostics.coreGetSessionFields,
        coreGetSessionSummary = diagnostics.coreGetSessionSummary,
        loadedEvent = diagnostics.loadedEvent,
        waitResult = diagnostics.waitResult,
        waitForPlayerMs = diagnostics.waitedMs,
        ensureTried = diagnostics.ensureTried,
        ensureResult = diagnostics.ensureResult
    }

    if not identity then
        return report
    end

    local phoneNumber, phoneErr = MZPhoneServer.Service.EnsurePhoneNumber(identity)
    if phoneNumber then
        report.phoneNumber = phoneNumber
        report.phoneNumberStatus = phoneErr or 'existing'
    else
        report.phoneNumberStatus = phoneErr or 'unavailable'
    end

    local contacts = Repository.GetContacts(identity.citizenid)
    local conversations = Repository.GetConversations(identity.citizenid)
    local settings, settingsStatus = ensureSettings(identity)

    report.contacts = #contacts
    report.conversations = #conversations
    report.settings = settingsStatus or (settings and 'loaded' or 'not_created')

    return report
end

function MZPhoneServer.Service.CanUseDebugCommand(source)
    Security.LogSource('service/CanUseDebugCommand', source, true)

    if Config.Debug.AllowCommand ~= true then
        return false, 'disabled'
    end

    local permission = Config.Debug.AdminPermission
    if permission and permission ~= '' and GetResourceState(Config.Framework.Resource) == 'started' then
        local ok, allowed = pcall(function()
            return exports[Config.Framework.Resource]:HasPermission(source, permission)
        end)

        if ok and allowed == true then
            return true, 'permission'
        end
    end

    if Security.DebugEnabled() then
        return true, 'debug_enabled'
    end

    return false, 'not_allowed'
end

function MZPhoneServer.Service.CanOpenPhone(source)
    Security.LogSource('service/CanOpenPhone', source, true)

    local normalizedSource, sourceErr = Security.NormalizeSource(source)
    if not normalizedSource then
        Security.Log('open_check', source, ('denied reason=%s'):format(tostring(sourceErr)), true)
        return false, 'identity_unavailable'
    end

    local identity, identityErr = Security.RequireIdentity(normalizedSource, { context = 'can_open_phone' })
    if not identity then
        Security.Log('open_check', normalizedSource, ('denied reason=%s'):format(tostring(identityErr)), true)
        return false, identityErr or 'identity_unavailable'
    end

    Security.Log('open_check', normalizedSource, ('identity citizenid=%s'):format(Security.Mask(identity.citizenid)))

    local hasPhone, itemReason = Framework.HasPhoneItem(normalizedSource)
    if not hasPhone then
        Security.Log('open_check', normalizedSource, ('denied reason=%s'):format(tostring(itemReason)), true)
        return false, itemReason or 'missing_phone', identity
    end

    Security.Log('open_check', normalizedSource, 'allowed')
    return true, nil, identity
end

function MZPhoneServer.Service.Load(source)
    Security.LogSource('service/Load', source, true)

    if not Security.RateLimit(source, 'load') then
        return nil, 'rate_limited'
    end

    local identity, err = Security.RequireIdentity(source, { context = 'load' })
    if not identity then
        return nil, err
    end

    Security.Log('identity', source, ('citizenid=%s source=%s'):format(Security.Mask(identity.citizenid), tostring(identity.identitySource)))

    local number, numberErr = MZPhoneServer.Service.EnsurePhoneNumber(identity)
    if not number then
        return nil, numberErr or 'number_unavailable'
    end

    return buildDefaults(identity, number)
end

function MZPhoneServer.Service.Save(source, data)
    if not Security.RateLimit(source, 'save') then
        return false, 'rate_limited'
    end

    local identity, err = Security.RequireIdentity(source, { context = 'save' })
    if not identity then
        return false, err
    end

    data = type(data) == 'table' and data or {}

    local payload = {
        theme = Security.SanitizeText(data.theme or 'dark', 32),
        wallpaper = Security.SanitizeText(data.wallpaper or 'default', 120),
        ringtone = Security.SanitizeText(data.ringtone or 'default', 80),
        profilePhoto = Security.SanitizeText(data.profilePhoto or '', 1000),
        settings = {
            customWallpaper = Security.SanitizeText(data.customWallpaper or '', 1000)
        }
    }

    Repository.SaveSettings(identity.citizenid, payload)
    return true
end

local function refreshContacts(source, citizenid)
    TriggerClientEvent('mz_phone:client:receiveContacts', source, Repository.GetContacts(citizenid))
end

function MZPhoneServer.Service.GetContacts(source)
    local identity = Security.RequireIdentity(source, { context = 'get_contacts' })
    if not identity then return end
    refreshContacts(source, identity.citizenid)
end

function MZPhoneServer.Service.CreateContact(source, data)
    if not Security.RateLimit(source, 'contact') then return end
    local identity = Security.RequireIdentity(source, { context = 'create_contact' })
    if not identity then return end

    data = type(data) == 'table' and data or {}
    local payload = {
        name = Security.SanitizeText(data.name, Config.Security.NameMaxLength),
        number = Security.NormalizePhone(data.number),
        avatar = Security.SanitizeText(data.avatar, 1000),
        favorite = data.favorite == true
    }

    if payload.name == '' or payload.number == '' then
        return
    end

    Repository.CreateContact(identity.citizenid, payload)
    Security.Log('contact', source, ('created %s'):format(payload.number))
    refreshContacts(source, identity.citizenid)
end

function MZPhoneServer.Service.UpdateContact(source, contactId, data)
    if not Security.RateLimit(source, 'contact') then return end
    local identity = Security.RequireIdentity(source, { context = 'update_contact' })
    if not identity then return end

    contactId = tonumber(contactId)
    if not contactId then return end

    data = type(data) == 'table' and data or {}
    local current = Repository.GetContact(identity.citizenid, contactId)
    if not current then return end

    local favorite = current.favorite == 1
    if data.favorite ~= nil then
        favorite = data.favorite == true
    end

    local payload = {
        name = Security.SanitizeText(data.name or current.name, Config.Security.NameMaxLength),
        number = Security.NormalizePhone(data.number or current.number),
        avatar = Security.SanitizeText(data.avatar or current.avatar or '', 1000),
        favorite = favorite
    }

    if payload.name == '' or payload.number == '' then
        return
    end

    Repository.UpdateContact(identity.citizenid, contactId, payload)
    refreshContacts(source, identity.citizenid)
end

function MZPhoneServer.Service.DeleteContact(source, contactId)
    if not Security.RateLimit(source, 'contact') then return end
    local identity = Security.RequireIdentity(source, { context = 'delete_contact' })
    if not identity then return end

    contactId = tonumber(contactId)
    if not contactId then return end

    Repository.DeleteContact(identity.citizenid, contactId)
    refreshContacts(source, identity.citizenid)
end

function MZPhoneServer.Service.ToggleFavoriteContact(source, contactId)
    if not Security.RateLimit(source, 'contact') then return end
    local identity = Security.RequireIdentity(source, { context = 'toggle_favorite_contact' })
    if not identity then return end

    contactId = tonumber(contactId)
    if not contactId then return end

    Repository.ToggleFavoriteContact(identity.citizenid, contactId)
    refreshContacts(source, identity.citizenid)
end

local function refreshConversation(source, citizenid, conversationId)
    TriggerClientEvent('mz_phone:client:receiveConversations', source, Repository.GetConversations(citizenid))

    if conversationId then
        TriggerClientEvent('mz_phone:client:receiveConversationMessages', source, {
            conversationId = conversationId,
            messages = Repository.GetMessages(citizenid, conversationId)
        })
    end
end

function MZPhoneServer.Service.GetConversations(source)
    local identity = Security.RequireIdentity(source, { context = 'get_conversations' })
    if not identity then return end
    TriggerClientEvent('mz_phone:client:receiveConversations', source, Repository.GetConversations(identity.citizenid))
end

function MZPhoneServer.Service.GetConversationMessages(source, conversationId)
    local identity = Security.RequireIdentity(source, { context = 'get_conversation_messages' })
    if not identity then return end

    conversationId = tonumber(conversationId)
    if not conversationId then return end

    TriggerClientEvent('mz_phone:client:receiveConversationMessages', source, {
        conversationId = conversationId,
        messages = Repository.GetMessages(identity.citizenid, conversationId)
    })
end

function MZPhoneServer.Service.CreateConversation(source, data)
    if not Security.RateLimit(source, 'conversation') then return end
    local identity = Security.RequireIdentity(source, { context = 'create_conversation' })
    if not identity then return end

    data = type(data) == 'table' and data or {}
    local targetNumber = Security.NormalizePhone(data.target_number or data.number)
    local targetName = Security.SanitizeText(data.target_name or data.name or targetNumber, Config.Security.NameMaxLength)

    if targetNumber == '' then
        return
    end

    local conversationId = Repository.CreateConversation(identity.citizenid, targetNumber, targetName)
    refreshConversation(source, identity.citizenid, conversationId)
end

function MZPhoneServer.Service.SendMessage(source, conversationId, data)
    if not Security.RateLimit(source, 'message') then
        Framework.Notify(source, { type = 'warning', title = 'Celular', message = 'Aguarde antes de enviar outra mensagem.' })
        return
    end

    local identity = Security.RequireIdentity(source, { context = 'send_message' })
    if not identity then return end

    conversationId = tonumber(conversationId)
    if not conversationId then return end

    local conversation = Repository.GetConversation(identity.citizenid, conversationId)
    if not conversation then
        Security.Log('security', source, 'tentou enviar mensagem em conversa de outro dono')
        return
    end

    data = type(data) == 'table' and data or {}
    local message = Security.SanitizeText(data.message, Config.Security.TextMaxLength)
    if message == '' then
        return
    end

    local payload = {
        sender = 'me',
        message = message,
        messageType = Security.SanitizeText(data.message_type or 'text', 30),
        mediaUrl = Security.SanitizeText(data.media_url or '', 1000)
    }

    Repository.CreateMessage(identity.citizenid, conversationId, payload)
    refreshConversation(source, identity.citizenid, conversationId)

    local targetNumber = Security.NormalizePhone(conversation.target_number)
    local targetPhone = Repository.GetPhoneByNumber(targetNumber)
    if not targetPhone or not targetPhone.citizenid then
        return
    end

    local senderNumber = MZPhoneServer.Service.EnsurePhoneNumber(identity)
    local targetConversationId = Repository.CreateConversation(targetPhone.citizenid, senderNumber, fullName(identity))
    Repository.CreateMessage(targetPhone.citizenid, targetConversationId, {
        sender = 'other',
        message = message,
        messageType = payload.messageType,
        mediaUrl = payload.mediaUrl
    })
    Repository.IncrementUnread(targetConversationId)

    local targetSource = Framework.GetSourceByCitizenId(targetPhone.citizenid)
    if targetSource then
        refreshConversation(targetSource, targetPhone.citizenid, targetConversationId)
        TriggerClientEvent('mz_phone:client:notify', targetSource, {
            type = 'message',
            title = fullName(identity),
            message = message,
            appLabel = 'Mensagens'
        })
    end
end

function MZPhoneServer.Service.MarkConversationRead(source, conversationId)
    local identity = Security.RequireIdentity(source, { context = 'mark_conversation_read' })
    if not identity then return end

    conversationId = tonumber(conversationId)
    if not conversationId then return end

    Repository.MarkConversationRead(identity.citizenid, conversationId)
    TriggerClientEvent('mz_phone:client:receiveConversations', source, Repository.GetConversations(identity.citizenid))
end

function MZPhoneServer.Service.GetCalls(source)
    local identity = Security.RequireIdentity(source, { context = 'get_calls' })
    if not identity then return end
    TriggerClientEvent('mz_phone:client:receiveCalls', source, Repository.GetCalls(identity.citizenid))
end

function MZPhoneServer.Service.CreateCall(source, data)
    if not Security.RateLimit(source, 'calls') then return end
    local identity = Security.RequireIdentity(source, { context = 'create_call' })
    if not identity then return end

    data = type(data) == 'table' and data or {}
    Repository.CreateCall(identity.citizenid, {
        number = Security.NormalizePhone(data.number),
        contactId = tonumber(data.contact_id or data.contactId),
        direction = Security.SanitizeText(data.direction or 'outgoing', 20),
        duration = tonumber(data.duration) or 0,
        timestamp = tonumber(data.timestamp) or os.time()
    })

    TriggerClientEvent('mz_phone:client:receiveCalls', source, Repository.GetCalls(identity.citizenid))
end

function MZPhoneServer.Service.DeleteCall(source, callId)
    local identity = Security.RequireIdentity(source, { context = 'delete_call' })
    if not identity then return end

    callId = tonumber(callId)
    if not callId then return end

    Repository.DeleteCall(identity.citizenid, callId)
    TriggerClientEvent('mz_phone:client:receiveCalls', source, Repository.GetCalls(identity.citizenid))
end

function MZPhoneServer.Service.ClearCalls(source)
    local identity = Security.RequireIdentity(source, { context = 'clear_calls' })
    if not identity then return end

    Repository.ClearCalls(identity.citizenid)
    TriggerClientEvent('mz_phone:client:receiveCalls', source, {})
end
