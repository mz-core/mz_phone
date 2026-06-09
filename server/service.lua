MZPhoneServer = MZPhoneServer or {}
MZPhoneServer.Service = {}

local Repository = MZPhoneServer.Repository
local Security = MZPhoneServer.Security
local Framework = MZPhoneServer.Framework

local function phoneAudioSource(soundName)
    local value = tostring(soundName or ''):gsub('^%s+', ''):gsub('%s+$', '')
    if value == '' then
        value = 'notification'
    end

    if value:find('^https?://') or value:find('^nui://') or value:find('^sounds/') or value:find('/') then
        return value
    end

    if value:find('%.') then
        return ('sounds/%s'):format(value)
    end

    return ('sounds/%s.mp3'):format(value)
end

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

local function galleryConfig()
    return Config.Phone and Config.Phone.Gallery or {}
end

local function cameraConfig()
    return Config.Phone and Config.Phone.Camera or {}
end

local function galleryPageSize()
    local cfg = galleryConfig()
    return tonumber(cfg.PageSize) or 40
end

local function galleryMaxPhotos()
    local cfg = galleryConfig()
    return tonumber(cfg.MaxPhotos) or 200
end

local function cameraMaxPhotos()
    local cfg = cameraConfig()
    return tonumber(cfg.MaxPhotosPerUser) or galleryMaxPhotos()
end

local function isGalleryEnabled()
    return galleryConfig().Enabled ~= false
end

local function validImageUrl(value)
    value = Security.SanitizeText(value, 1000)
    if value == '' then
        return false, 'invalid_url'
    end

    if value:find('[%s<>"]') then
        return false, 'invalid_url'
    end

    local scheme = value:match('^([%a][%w+%-%.]*):')
    if scheme then
        scheme = scheme:lower()
        local allowedSchemes = galleryConfig().AllowedImageSchemes or {}
        if allowedSchemes[scheme] == true then
            return true, nil, value
        end

        return false, 'scheme_not_allowed'
    end

    local prefixes = galleryConfig().AllowedLocalPrefixes or {}
    for _, prefix in ipairs(prefixes) do
        prefix = tostring(prefix or '')
        if prefix ~= '' and value:sub(1, #prefix) == prefix and not value:find('%.%.', 1, true) then
            return true, nil, value
        end
    end

    return false, 'local_path_not_allowed'
end

local function sanitizeOptionalImageUrl(value)
    value = Security.SanitizeText(value or '', 1000)
    if value == '' then
        return ''
    end

    local ok, _, normalized = validImageUrl(value)
    if ok then
        return normalized
    end

    return ''
end

local function validHttpUrl(value)
    value = Security.SanitizeText(value or '', 1000)
    if value == '' or value:find('[%s<>"]') then
        return false, 'invalid_url'
    end

    local scheme = value:match('^([%a][%w+%-%.]*):')
    scheme = scheme and scheme:lower() or ''
    if scheme ~= 'http' and scheme ~= 'https' then
        return false, 'scheme_not_allowed'
    end

    return true, nil, value
end

local function normalizeMessageType(value)
    value = Security.SanitizeText(value or 'text', 30):lower()
    if value == 'image' or value == 'location' or value == 'url' then
        return value
    end

    return 'text'
end

local function serverPlayerCoords(source)
    local okPed, ped = pcall(GetPlayerPed, source)
    if not okPed or not ped or ped == 0 then
        return nil
    end

    local okCoords, coords = pcall(GetEntityCoords, ped)
    if not okCoords or not coords then
        return nil
    end

    local x = tonumber(coords.x)
    local y = tonumber(coords.y)
    local z = tonumber(coords.z)
    if not x or not y or not z then
        return nil
    end

    if math.abs(x) > 10000.0 or math.abs(y) > 10000.0 or math.abs(z) > 2000.0 then
        return nil
    end

    return {
        x = x,
        y = y,
        z = z
    }
end

local function messageNotifyText(messageType, message)
    if messageType == 'image' then
        return 'Foto'
    end

    if messageType == 'location' then
        return 'Localizacao compartilhada'
    end

    if messageType == 'url' then
        return 'Link'
    end

    return message
end

local function normalizeGalleryPhoto(row)
    if type(row) ~= 'table' then
        return nil
    end

    local metadata = {}
    if type(row.metadata) == 'string' and row.metadata ~= '' then
        local ok, decoded = pcall(json.decode, row.metadata)
        if ok and type(decoded) == 'table' then
            metadata = decoded
        end
    elseif type(row.metadata) == 'table' then
        metadata = row.metadata
    end

    return {
        id = row.id,
        image_url = row.image_url or row.url or '',
        thumbnail_url = row.thumbnail_url or '',
        caption = row.caption or '',
        source = row.source or 'manual',
        favorite = row.favorite == true or tonumber(row.favorite) == 1,
        metadata = metadata,
        created_at = row.created_at or '',
        deleted_at = row.deleted_at or nil
    }
end

local function normalizeGalleryList(rows)
    local out = {}
    for _, row in ipairs(rows or {}) do
        out[#out + 1] = normalizeGalleryPhoto(row)
    end
    return out
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
    local dbProfile = Repository.GetPlayerProfile(identity.citizenid) or {}
    local notes = Repository.GetNotes(identity.citizenid)
    local contacts = Repository.GetContacts(identity.citizenid)
    local conversations = Repository.GetConversations(identity.citizenid)
    local calls = Repository.GetCalls(identity.citizenid)
    local gallery = isGalleryEnabled() and normalizeGalleryList(Repository.GetGalleryPhotos(identity.citizenid, galleryPageSize(), 0)) or {}

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
        audio = {
            enabled = Config.Phone.Audio == nil or Config.Phone.Audio.Enabled ~= false,
            defaultRingtone = Config.Phone.Audio and Config.Phone.Audio.DefaultRingtone or 'ringtone',
            ringtoneVolume = Config.Phone.Audio and Config.Phone.Audio.RingtoneVolume or 0.45,
            locationClick = {
                enabled = not (Config.Phone.Audio and Config.Phone.Audio.LocationClick and Config.Phone.Audio.LocationClick.Enabled == false),
                sound = Config.Phone.Audio and Config.Phone.Audio.LocationClick and Config.Phone.Audio.LocationClick.Sound or 'notification',
                source = phoneAudioSource(Config.Phone.Audio and Config.Phone.Audio.LocationClick and Config.Phone.Audio.LocationClick.Sound or 'notification'),
                volume = Config.Phone.Audio and Config.Phone.Audio.LocationClick and Config.Phone.Audio.LocationClick.Volume or 0.35
            }
        },
        profilePhoto = settings.profile_photo or '',
        playerProfile = {
            firstname = identity.firstname ~= '' and identity.firstname or dbProfile.firstname or '',
            lastname = identity.lastname ~= '' and identity.lastname or dbProfile.lastname or '',
            phoneNumber = phoneNumber or dbProfile.phone or '',
            citizenid = identity.citizenid or '',
            nationality = identity.nationality ~= '' and identity.nationality or dbProfile.nationality or '',
            birthdate = identity.birthdate ~= '' and identity.birthdate or dbProfile.birthdate or ''
        },
        contacts = contacts,
        conversations = conversations,
        calls = calls,
        gallery = gallery,
        gallerySelectedPhotoId = nil,
        notes = notes,
        noteDraft = { title = '', content = '' },
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
        profilePhoto = sanitizeOptionalImageUrl(data.profilePhoto),
        settings = {
            customWallpaper = sanitizeOptionalImageUrl(data.customWallpaper)
        }
    }

    Repository.SaveSettings(identity.citizenid, payload)
    return true
end

local function refreshNotes(source, citizenid)
    TriggerClientEvent('mz_phone:client:receiveNotes', source, Repository.GetNotes(citizenid))
end

function MZPhoneServer.Service.GetNotes(source)
    local identity = Security.RequireIdentity(source, { context = 'get_notes' })
    if not identity then return end

    refreshNotes(source, identity.citizenid)
end

function MZPhoneServer.Service.CreateNote(source, data)
    if not Security.RateLimit(source, 'note') then return end

    local identity = Security.RequireIdentity(source, { context = 'create_note' })
    if not identity then return end

    data = type(data) == 'table' and data or {}
    local payload = {
        title = Security.SanitizeText(data.title or '', 160),
        content = Security.SanitizeText(data.content or '', 5000)
    }

    if payload.title == '' and payload.content == '' then
        return
    end

    Repository.CreateNote(identity.citizenid, payload)
    refreshNotes(source, identity.citizenid)
end

function MZPhoneServer.Service.UpdateNote(source, noteId, data)
    if not Security.RateLimit(source, 'note') then return end

    local identity = Security.RequireIdentity(source, { context = 'update_note' })
    if not identity then return end

    noteId = tonumber(noteId)
    if not noteId then return end

    data = type(data) == 'table' and data or {}
    local payload = {
        title = Security.SanitizeText(data.title or '', 160),
        content = Security.SanitizeText(data.content or '', 5000)
    }

    if payload.title == '' and payload.content == '' then
        return
    end

    Repository.UpdateNote(identity.citizenid, noteId, payload)
    refreshNotes(source, identity.citizenid)
end

function MZPhoneServer.Service.DeleteNote(source, noteId)
    if not Security.RateLimit(source, 'note') then return end

    local identity = Security.RequireIdentity(source, { context = 'delete_note' })
    if not identity then return end

    noteId = tonumber(noteId)
    if not noteId then return end

    Repository.DeleteNote(identity.citizenid, noteId)
    refreshNotes(source, identity.citizenid)
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
        avatar = sanitizeOptionalImageUrl(data.avatar),
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
        avatar = sanitizeOptionalImageUrl(data.avatar or current.avatar or ''),
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
    local targetName = Repository.FindContactNameByNumber(identity.citizenid, targetNumber)
    targetName = targetName or Security.SanitizeText(data.target_name or data.name or targetNumber, Config.Security.NameMaxLength)

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
    local messageType = normalizeMessageType(data.message_type or data.messageType)
    local message = Security.SanitizeText(data.message, Config.Security.TextMaxLength)
    local mediaUrl = ''
    local metadata = {}

    if messageType == 'text' then
        if message == '' then
            return
        end
    elseif messageType == 'image' then
        if message == '' then
            message = 'Foto'
        end

        local photoId = tonumber(data.photoId or data.photo_id or data.mediaId)
        if photoId then
            local photo = Repository.GetGalleryPhotoById(photoId)
            if not photo or photo.owner_citizenid ~= identity.citizenid or photo.deleted_at ~= nil then
                Security.Log('security', source, ('tentou enviar foto sem posse photo=%s'):format(tostring(photoId)))
                return
            end

            mediaUrl = sanitizeOptionalImageUrl(photo.image_url)
            if mediaUrl == '' then
                return
            end

            metadata.photoId = photo.id
            metadata.source = Security.SanitizeText(photo.source or data.source or 'gallery', 32)
        else
            mediaUrl = sanitizeOptionalImageUrl(data.media_url or data.mediaUrl or '')
            if mediaUrl == '' then
                return
            end

            metadata.source = Security.SanitizeText(data.source or 'url', 32)
        end
    elseif messageType == 'location' then
        local coords = serverPlayerCoords(source)
        if not coords then
            Framework.Notify(source, { type = 'error', title = 'Mensagens', message = 'Nao foi possivel obter sua localizacao.' })
            return
        end

        message = message ~= '' and message or 'Localizacao compartilhada'
        metadata = {
            x = coords.x,
            y = coords.y,
            z = coords.z,
            label = Security.SanitizeText(data.label or 'Localizacao', 80),
            source = 'server'
        }
    elseif messageType == 'url' then
        local rawUrl = data.media_url or data.mediaUrl or message
        local okUrl, _, normalizedUrl = validHttpUrl(rawUrl)
        if not okUrl then
            return
        end

        mediaUrl = normalizedUrl
        message = message ~= '' and message or normalizedUrl
    end

    local payload = {
        sender = 'me',
        message = message,
        messageType = messageType,
        mediaUrl = mediaUrl,
        metadata = metadata
    }

    Repository.CreateMessage(identity.citizenid, conversationId, payload)
    refreshConversation(source, identity.citizenid, conversationId)

    local targetNumber = Security.NormalizePhone(conversation.target_number)
    local targetPhone = Repository.GetPhoneByNumber(targetNumber)
    if not targetPhone or not targetPhone.citizenid then
        return
    end

    local senderNumber = MZPhoneServer.Service.EnsurePhoneNumber(identity)
    local receiverContactName = Repository.FindContactNameByNumber(targetPhone.citizenid, senderNumber)
    local senderDisplayName = receiverContactName or fullName(identity)
    local targetConversationId = Repository.CreateConversation(targetPhone.citizenid, senderNumber, senderDisplayName)
    Repository.CreateMessage(targetPhone.citizenid, targetConversationId, {
        sender = 'other',
        message = message,
        messageType = payload.messageType,
        mediaUrl = payload.mediaUrl,
        metadata = payload.metadata
    })
    Repository.IncrementUnread(targetConversationId)

    local targetSource = Framework.GetSourceByCitizenId(targetPhone.citizenid)
    if targetSource then
        refreshConversation(targetSource, targetPhone.citizenid, targetConversationId)
        TriggerClientEvent('mz_phone:client:notify', targetSource, {
            type = 'message',
            title = senderDisplayName,
            message = messageNotifyText(payload.messageType, message),
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

local function sendGallery(source, citizenid)
    TriggerClientEvent('mz_phone:client:receiveGallery', source, normalizeGalleryList(
        Repository.GetGalleryPhotos(citizenid, galleryPageSize(), 0)
    ))
end

function MZPhoneServer.Service.GetGallery(source)
    if not isGalleryEnabled() then
        TriggerClientEvent('mz_phone:client:receiveGallery', source, {})
        return
    end

    local identity = Security.RequireIdentity(source, { context = 'get_gallery' })
    if not identity then return end

    sendGallery(source, identity.citizenid)
end

function MZPhoneServer.Service.RegisterCameraPhoto(source, imageUrl, metadata)
    if not isGalleryEnabled() then
        return nil, 'gallery_disabled'
    end

    if not Security.RateLimit(source, 'gallery') then
        return nil, 'rate_limited'
    end

    local identity = Security.RequireIdentity(source, { context = 'register_camera_photo' })
    if not identity then
        return nil, 'identity_unavailable'
    end

    local maxPhotos = cameraMaxPhotos()
    local photos = Repository.GetGalleryPhotos(identity.citizenid, maxPhotos, 0)
    if #photos >= maxPhotos then
        return nil, 'gallery_limit_reached'
    end

    local okUrl, urlErr, normalizedUrl = validImageUrl(imageUrl)
    if not okUrl then
        return nil, urlErr or 'invalid_url'
    end

    local photo = Repository.RegisterGalleryPhoto(identity.citizenid, normalizedUrl, {
        source = 'camera',
        metadata = type(metadata) == 'table' and metadata or {}
    })

    sendGallery(source, identity.citizenid)
    return normalizeGalleryPhoto(photo), nil
end

function MZPhoneServer.Service.SaveCameraPhoto(source, imageUrl, metadata)
    metadata = type(metadata) == 'table' and metadata or {}
    metadata.created_by = 'mz_phone_camera'

    return MZPhoneServer.Service.RegisterCameraPhoto(source, imageUrl, metadata)
end

function MZPhoneServer.Service.AddGalleryPhoto(source, payload)
    if not isGalleryEnabled() then return false, 'gallery_disabled' end
    if galleryConfig().AllowManualUrlAdd ~= true then return false, 'manual_add_disabled' end
    if not Security.RateLimit(source, 'gallery') then return false, 'rate_limited' end

    local identity = Security.RequireIdentity(source, { context = 'add_gallery_photo' })
    if not identity then return false, 'identity_unavailable' end

    payload = type(payload) == 'table' and payload or {}
    local photos = Repository.GetGalleryPhotos(identity.citizenid, galleryMaxPhotos(), 0)
    if #photos >= galleryMaxPhotos() then
        return false, 'gallery_limit_reached'
    end

    local okUrl, urlErr, normalizedUrl = validImageUrl(payload.image_url or payload.imageUrl or payload.url)
    if not okUrl then return false, urlErr or 'invalid_url' end

    local okThumb, _, normalizedThumb = true, nil, ''
    local rawThumb = payload.thumbnail_url or payload.thumbnailUrl or ''
    if rawThumb ~= '' then
        okThumb, _, normalizedThumb = validImageUrl(rawThumb)
        if not okThumb then
            normalizedThumb = ''
        end
    end

    local photo = Repository.CreateGalleryPhoto(identity.citizenid, {
        imageUrl = normalizedUrl,
        thumbnailUrl = normalizedThumb ~= '' and normalizedThumb or nil,
        caption = Security.SanitizeText(payload.caption or '', 255),
        source = Security.SanitizeText(payload.source or 'manual', 32),
        favorite = payload.favorite == true,
        metadata = type(payload.metadata) == 'table' and payload.metadata or {}
    })

    sendGallery(source, identity.citizenid)
    return normalizeGalleryPhoto(photo), nil
end

function MZPhoneServer.Service.DeleteGalleryPhoto(source, photoId)
    if not isGalleryEnabled() then return false, 'gallery_disabled' end
    if not Security.RateLimit(source, 'gallery') then return false, 'rate_limited' end

    local identity = Security.RequireIdentity(source, { context = 'delete_gallery_photo' })
    if not identity then return false, 'identity_unavailable' end

    photoId = tonumber(photoId)
    if not photoId then return false, 'invalid_photo' end

    local affected = Repository.DeleteGalleryPhoto(identity.citizenid, photoId)
    sendGallery(source, identity.citizenid)

    return tonumber(affected) and tonumber(affected) > 0, affected
end

function MZPhoneServer.Service.ToggleGalleryFavorite(source, photoId, favorite)
    if not isGalleryEnabled() then return false, 'gallery_disabled' end
    if not Security.RateLimit(source, 'gallery') then return false, 'rate_limited' end

    local identity = Security.RequireIdentity(source, { context = 'toggle_gallery_favorite' })
    if not identity then return false, 'identity_unavailable' end

    photoId = tonumber(photoId)
    if not photoId then return false, 'invalid_photo' end

    local photo = Repository.ToggleGalleryFavorite(identity.citizenid, photoId, favorite == true)
    sendGallery(source, identity.citizenid)

    return normalizeGalleryPhoto(photo), photo and nil or 'not_found'
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
