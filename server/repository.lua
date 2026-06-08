MZPhoneServer = MZPhoneServer or {}
MZPhoneServer.Repository = {}

local Repository = MZPhoneServer.Repository

local function columnExists(tableName, columnName)
    local row = MySQL.single.await([[
        SELECT COUNT(*) AS count
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = ?
            AND COLUMN_NAME = ?
    ]], { tableName, columnName })

    return row and tonumber(row.count) and tonumber(row.count) > 0
end

local function renameColumnIfNeeded(tableName, oldName, newName, definition)
    if columnExists(tableName, newName) or not columnExists(tableName, oldName) then
        return
    end

    MySQL.query.await(('ALTER TABLE `%s` CHANGE `%s` `%s` %s'):format(tableName, oldName, newName, definition))
end

local function addColumnIfMissing(tableName, columnName, definition)
    if columnExists(tableName, columnName) then
        return
    end

    MySQL.query.await(('ALTER TABLE `%s` ADD COLUMN `%s` %s'):format(tableName, columnName, definition))
end

local function migrateLegacyColumns()
    renameColumnIfNeeded('mz_phone_numbers', 'character_id', 'citizenid', 'VARCHAR(64) NOT NULL')

    renameColumnIfNeeded('mz_phone_contacts', 'character_id', 'owner_citizenid', 'VARCHAR(64) NOT NULL')
    renameColumnIfNeeded('mz_phone_contacts', 'citizenid', 'owner_citizenid', 'VARCHAR(64) NOT NULL')
    renameColumnIfNeeded('mz_phone_contacts', 'name', 'contact_name', 'VARCHAR(100) NOT NULL')
    renameColumnIfNeeded('mz_phone_contacts', 'number', 'contact_phone', 'VARCHAR(32) NOT NULL')

    renameColumnIfNeeded('mz_phone_conversations', 'character_id', 'owner_citizenid', 'VARCHAR(64) NOT NULL')
    renameColumnIfNeeded('mz_phone_conversations', 'citizenid', 'owner_citizenid', 'VARCHAR(64) NOT NULL')
    renameColumnIfNeeded('mz_phone_messages', 'character_id', 'owner_citizenid', 'VARCHAR(64) NOT NULL')
    renameColumnIfNeeded('mz_phone_messages', 'citizenid', 'owner_citizenid', 'VARCHAR(64) NOT NULL')
    renameColumnIfNeeded('mz_phone_calls', 'character_id', 'owner_citizenid', 'VARCHAR(64) NOT NULL')
    renameColumnIfNeeded('mz_phone_calls', 'citizenid', 'owner_citizenid', 'VARCHAR(64) NOT NULL')

    renameColumnIfNeeded('mz_phone_gallery', 'character_id', 'owner_citizenid', 'VARCHAR(64) NOT NULL')
    renameColumnIfNeeded('mz_phone_gallery', 'citizenid', 'owner_citizenid', 'VARCHAR(64) NOT NULL')
    renameColumnIfNeeded('mz_phone_gallery', 'url', 'image_url', 'TEXT NOT NULL')
    renameColumnIfNeeded('mz_phone_apps', 'character_id', 'citizenid', 'VARCHAR(64) NOT NULL')
    renameColumnIfNeeded('mz_phone_settings', 'character_id', 'citizenid', 'VARCHAR(64) NOT NULL')
    renameColumnIfNeeded('mz_phone_notifications', 'character_id', 'citizenid', 'VARCHAR(64) NOT NULL')
end

local function migrateGalleryColumns()
    addColumnIfMissing('mz_phone_gallery', 'thumbnail_url', 'TEXT NULL')
    addColumnIfMissing('mz_phone_gallery', 'source', "VARCHAR(32) NOT NULL DEFAULT 'manual'")
    addColumnIfMissing('mz_phone_gallery', 'favorite', 'TINYINT(1) NOT NULL DEFAULT 0')
    addColumnIfMissing('mz_phone_gallery', 'metadata', 'JSON NULL')
    addColumnIfMissing('mz_phone_gallery', 'deleted_at', 'TIMESTAMP NULL')
end

local function migrateMessageColumns()
    addColumnIfMissing('mz_phone_messages', 'metadata', 'JSON NULL')
end

local function migrateCallColumns()
    addColumnIfMissing('mz_phone_calls', 'caller_citizenid', 'VARCHAR(64) NULL')
    addColumnIfMissing('mz_phone_calls', 'receiver_citizenid', 'VARCHAR(64) NULL')
    addColumnIfMissing('mz_phone_calls', 'caller_number', 'VARCHAR(32) NULL')
    addColumnIfMissing('mz_phone_calls', 'receiver_number', 'VARCHAR(32) NULL')
    addColumnIfMissing('mz_phone_calls', 'status', "VARCHAR(20) NOT NULL DEFAULT 'ended'")
    addColumnIfMissing('mz_phone_calls', 'started_at', 'TIMESTAMP NULL')
    addColumnIfMissing('mz_phone_calls', 'answered_at', 'TIMESTAMP NULL')
    addColumnIfMissing('mz_phone_calls', 'ended_at', 'TIMESTAMP NULL')
end

function Repository.Prepare()
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS mz_phone_numbers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            citizenid VARCHAR(64) NOT NULL,
            phone_number VARCHAR(32) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_mz_phone_numbers_citizenid (citizenid),
            UNIQUE KEY uq_mz_phone_numbers_number (phone_number)
        )
    ]])

    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS mz_phone_contacts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            owner_citizenid VARCHAR(64) NOT NULL,
            contact_name VARCHAR(100) NOT NULL,
            contact_phone VARCHAR(32) NOT NULL,
            avatar TEXT NULL,
            favorite TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_mz_phone_contacts_owner (owner_citizenid)
        )
    ]])

    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS mz_phone_conversations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            owner_citizenid VARCHAR(64) NOT NULL,
            target_number VARCHAR(32) NOT NULL,
            target_name VARCHAR(100) DEFAULT NULL,
            unread_count INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_mz_phone_conversation_target (owner_citizenid, target_number),
            INDEX idx_mz_phone_conversations_owner (owner_citizenid)
        )
    ]])

    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS mz_phone_messages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            conversation_id INT NOT NULL,
            owner_citizenid VARCHAR(64) NOT NULL,
            sender VARCHAR(20) NOT NULL DEFAULT 'me',
            message TEXT NULL,
            message_type VARCHAR(30) NOT NULL DEFAULT 'text',
            media_url TEXT NULL,
            metadata JSON NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_mz_phone_messages_conversation (conversation_id),
            INDEX idx_mz_phone_messages_owner (owner_citizenid)
        )
    ]])

    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS mz_phone_calls (
            id INT AUTO_INCREMENT PRIMARY KEY,
            owner_citizenid VARCHAR(64) NOT NULL,
            caller_citizenid VARCHAR(64) NULL,
            receiver_citizenid VARCHAR(64) NULL,
            caller_number VARCHAR(32) NULL,
            receiver_number VARCHAR(32) NULL,
            number VARCHAR(32) DEFAULT NULL,
            contact_id INT DEFAULT NULL,
            direction VARCHAR(20) DEFAULT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'ended',
            started_at TIMESTAMP NULL,
            answered_at TIMESTAMP NULL,
            ended_at TIMESTAMP NULL,
            duration INT NOT NULL DEFAULT 0,
            timestamp BIGINT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_mz_phone_calls_owner (owner_citizenid),
            INDEX idx_mz_phone_calls_caller (caller_citizenid),
            INDEX idx_mz_phone_calls_receiver (receiver_citizenid),
            INDEX idx_mz_phone_calls_status (status)
        )
    ]])

    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS mz_phone_gallery (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            owner_citizenid VARCHAR(64) NOT NULL,
            image_url TEXT NOT NULL,
            thumbnail_url TEXT NULL,
            caption VARCHAR(255) DEFAULT NULL,
            source VARCHAR(32) NOT NULL DEFAULT 'manual',
            favorite TINYINT(1) NOT NULL DEFAULT 0,
            metadata JSON NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            deleted_at TIMESTAMP NULL,
            INDEX idx_mz_phone_gallery_owner (owner_citizenid),
            INDEX idx_mz_phone_gallery_created (created_at)
        )
    ]])

    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS mz_phone_apps (
            id INT AUTO_INCREMENT PRIMARY KEY,
            citizenid VARCHAR(64) NOT NULL,
            app_id VARCHAR(64) NOT NULL,
            enabled TINYINT(1) NOT NULL DEFAULT 1,
            settings JSON NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_mz_phone_apps_citizenid_app (citizenid, app_id)
        )
    ]])

    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS mz_phone_settings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            citizenid VARCHAR(64) NOT NULL,
            theme VARCHAR(32) NOT NULL DEFAULT 'dark',
            wallpaper VARCHAR(120) NOT NULL DEFAULT 'default',
            ringtone VARCHAR(80) NOT NULL DEFAULT 'default',
            profile_photo TEXT NULL,
            settings JSON NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_mz_phone_settings_citizenid (citizenid)
        )
    ]])

    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS mz_phone_notifications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            citizenid VARCHAR(64) NOT NULL,
            app_id VARCHAR(64) DEFAULT NULL,
            title VARCHAR(120) DEFAULT NULL,
            message VARCHAR(500) DEFAULT NULL,
            data JSON NULL,
            read_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_mz_phone_notifications_citizenid (citizenid)
        )
    ]])

    migrateLegacyColumns()
    migrateGalleryColumns()
    migrateMessageColumns()
    migrateCallColumns()
end

function Repository.GetPhoneByCharacter(citizenid)
    return MySQL.single.await([[
        SELECT citizenid, phone_number
        FROM mz_phone_numbers
        WHERE citizenid = ?
        LIMIT 1
    ]], { citizenid })
end

function Repository.GetPhoneByNumber(phoneNumber)
    return MySQL.single.await([[
        SELECT citizenid, phone_number
        FROM mz_phone_numbers
        WHERE phone_number = ?
        LIMIT 1
    ]], { phoneNumber })
end

function Repository.FindNumberOwner(phoneNumber)
    local row = Repository.GetPhoneByNumber(phoneNumber)
    if row then
        return row
    end

    row = MySQL.single.await([[
        SELECT citizenid, phone AS phone_number
        FROM mz_players
        WHERE phone = ?
        LIMIT 1
    ]], { phoneNumber })

    if row and row.citizenid then
        return row
    end

    return nil
end

function Repository.CreatePhoneNumber(citizenid, phoneNumber)
    MySQL.insert.await([[
        INSERT INTO mz_phone_numbers (citizenid, phone_number)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE phone_number = VALUES(phone_number)
    ]], { citizenid, phoneNumber })

    return Repository.GetPhoneByCharacter(citizenid)
end

function Repository.ReleasePhoneNumber(phoneNumber, exceptCitizenid)
    return MySQL.update.await([[
        DELETE FROM mz_phone_numbers
        WHERE phone_number = ? AND citizenid <> ?
    ]], { phoneNumber, exceptCitizenid })
end

function Repository.GetSettings(citizenid)
    return MySQL.single.await([[
        SELECT *
        FROM mz_phone_settings
        WHERE citizenid = ?
        LIMIT 1
    ]], { citizenid })
end

function Repository.SaveSettings(citizenid, data)
    MySQL.insert.await([[
        INSERT INTO mz_phone_settings (citizenid, theme, wallpaper, ringtone, profile_photo, settings)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            theme = VALUES(theme),
            wallpaper = VALUES(wallpaper),
            ringtone = VALUES(ringtone),
            profile_photo = VALUES(profile_photo),
            settings = VALUES(settings)
    ]], {
        citizenid,
        data.theme,
        data.wallpaper,
        data.ringtone,
        data.profilePhoto,
        json.encode(data.settings or {})
    })
end

function Repository.GetContacts(citizenid)
    return MySQL.query.await([[
        SELECT id, contact_name AS name, contact_phone AS number, avatar, favorite, created_at, updated_at
        FROM mz_phone_contacts
        WHERE owner_citizenid = ?
        ORDER BY favorite DESC, contact_name ASC, id DESC
    ]], { citizenid }) or {}
end

function Repository.GetContact(citizenid, contactId)
    return MySQL.single.await([[
        SELECT id, contact_name AS name, contact_phone AS number, avatar, favorite
        FROM mz_phone_contacts
        WHERE id = ? AND owner_citizenid = ?
        LIMIT 1
    ]], { contactId, citizenid })
end

function Repository.GetContactByNumber(citizenid, phoneNumber)
    return MySQL.single.await([[
        SELECT id, contact_name AS name, contact_phone AS number, avatar, favorite
        FROM mz_phone_contacts
        WHERE owner_citizenid = ? AND contact_phone = ?
        ORDER BY favorite DESC, id DESC
        LIMIT 1
    ]], { citizenid, phoneNumber })
end

function Repository.FindContactNameByNumber(citizenid, phoneNumber)
    local contact = Repository.GetContactByNumber(citizenid, phoneNumber)
    return contact and contact.name or nil
end

function Repository.CreateContact(citizenid, data)
    return MySQL.insert.await([[
        INSERT INTO mz_phone_contacts (owner_citizenid, contact_name, contact_phone, avatar, favorite)
        VALUES (?, ?, ?, ?, ?)
    ]], { citizenid, data.name, data.number, data.avatar, data.favorite and 1 or 0 })
end

function Repository.UpdateContact(citizenid, contactId, data)
    return MySQL.update.await([[
        UPDATE mz_phone_contacts
        SET contact_name = ?, contact_phone = ?, avatar = ?, favorite = ?
        WHERE id = ? AND owner_citizenid = ?
    ]], { data.name, data.number, data.avatar, data.favorite and 1 or 0, contactId, citizenid })
end

function Repository.DeleteContact(citizenid, contactId)
    return MySQL.update.await([[
        DELETE FROM mz_phone_contacts
        WHERE id = ? AND owner_citizenid = ?
    ]], { contactId, citizenid })
end

function Repository.ToggleFavoriteContact(citizenid, contactId)
    local contact = Repository.GetContact(citizenid, contactId)
    if not contact then
        return false
    end

    local nextFavorite = contact.favorite == 1 and 0 or 1
    MySQL.update.await([[
        UPDATE mz_phone_contacts
        SET favorite = ?
        WHERE id = ? AND owner_citizenid = ?
    ]], { nextFavorite, contactId, citizenid })

    return true
end

function Repository.GetConversations(citizenid)
    return MySQL.query.await([[
        SELECT
            id,
            owner_citizenid,
            target_number,
            target_name,
            COALESCE((
                SELECT contact_name
                FROM mz_phone_contacts
                WHERE owner_citizenid = ? AND contact_phone = mz_phone_conversations.target_number
                ORDER BY favorite DESC, id DESC
                LIMIT 1
            ), target_name, target_number) AS display_name,
            (
                SELECT message
                FROM mz_phone_messages
                WHERE conversation_id = mz_phone_conversations.id
                    AND owner_citizenid = mz_phone_conversations.owner_citizenid
                ORDER BY id DESC
                LIMIT 1
            ) AS last_message,
            (
                SELECT message_type
                FROM mz_phone_messages
                WHERE conversation_id = mz_phone_conversations.id
                    AND owner_citizenid = mz_phone_conversations.owner_citizenid
                ORDER BY id DESC
                LIMIT 1
            ) AS last_message_type,
            (
                SELECT created_at
                FROM mz_phone_messages
                WHERE conversation_id = mz_phone_conversations.id
                    AND owner_citizenid = mz_phone_conversations.owner_citizenid
                ORDER BY id DESC
                LIMIT 1
            ) AS last_message_at,
            unread_count,
            created_at,
            updated_at
        FROM mz_phone_conversations
        WHERE owner_citizenid = ?
        ORDER BY updated_at DESC, id DESC
    ]], { citizenid, citizenid }) or {}
end

function Repository.GetConversation(citizenid, conversationId)
    return MySQL.single.await([[
        SELECT
            id,
            owner_citizenid,
            target_number,
            target_name,
            COALESCE((
                SELECT contact_name
                FROM mz_phone_contacts
                WHERE owner_citizenid = ? AND contact_phone = mz_phone_conversations.target_number
                ORDER BY favorite DESC, id DESC
                LIMIT 1
            ), target_name, target_number) AS display_name,
            unread_count,
            created_at,
            updated_at
        FROM mz_phone_conversations
        WHERE id = ? AND owner_citizenid = ?
        LIMIT 1
    ]], { citizenid, conversationId, citizenid })
end

function Repository.FindConversationByNumber(citizenid, targetNumber)
    return MySQL.single.await([[
        SELECT
            id,
            owner_citizenid,
            target_number,
            target_name,
            COALESCE((
                SELECT contact_name
                FROM mz_phone_contacts
                WHERE owner_citizenid = ? AND contact_phone = mz_phone_conversations.target_number
                ORDER BY favorite DESC, id DESC
                LIMIT 1
            ), target_name, target_number) AS display_name,
            unread_count,
            created_at,
            updated_at
        FROM mz_phone_conversations
        WHERE owner_citizenid = ? AND target_number = ?
        LIMIT 1
    ]], { citizenid, citizenid, targetNumber })
end

function Repository.CreateConversation(citizenid, targetNumber, targetName)
    local existing = Repository.FindConversationByNumber(citizenid, targetNumber)
    if existing then
        if targetName and targetName ~= '' then
            MySQL.update.await([[
                UPDATE mz_phone_conversations
                SET target_name = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND owner_citizenid = ?
            ]], { targetName, existing.id, citizenid })
        end
        return existing.id
    end

    return MySQL.insert.await([[
        INSERT INTO mz_phone_conversations (owner_citizenid, target_number, target_name, unread_count)
        VALUES (?, ?, ?, 0)
    ]], { citizenid, targetNumber, targetName or '' })
end

function Repository.GetMessages(citizenid, conversationId)
    local conversation = Repository.GetConversation(citizenid, conversationId)
    if not conversation then
        return {}
    end

    return MySQL.query.await([[
        SELECT id, conversation_id, sender, message, message_type, media_url, metadata, created_at
        FROM mz_phone_messages
        WHERE conversation_id = ? AND owner_citizenid = ?
        ORDER BY id ASC
    ]], { conversationId, citizenid }) or {}
end

function Repository.CreateMessage(citizenid, conversationId, data)
    local insertId = MySQL.insert.await([[
        INSERT INTO mz_phone_messages (conversation_id, owner_citizenid, sender, message, message_type, media_url, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ]], {
        conversationId,
        citizenid,
        data.sender,
        data.message,
        data.messageType,
        data.mediaUrl,
        json.encode(type(data.metadata) == 'table' and data.metadata or {})
    })

    MySQL.update.await([[
        UPDATE mz_phone_conversations
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND owner_citizenid = ?
    ]], { conversationId, citizenid })

    return insertId
end

function Repository.IncrementUnread(conversationId)
    MySQL.update.await([[
        UPDATE mz_phone_conversations
        SET unread_count = unread_count + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ]], { conversationId })
end

function Repository.MarkConversationRead(citizenid, conversationId)
    return MySQL.update.await([[
        UPDATE mz_phone_conversations
        SET unread_count = 0
        WHERE id = ? AND owner_citizenid = ?
    ]], { conversationId, citizenid })
end

function Repository.CreateGalleryPhoto(ownerCitizenid, data)
    data = type(data) == 'table' and data or {}

    local photoId = MySQL.insert.await([[
        INSERT INTO mz_phone_gallery (
            owner_citizenid,
            image_url,
            thumbnail_url,
            caption,
            source,
            favorite,
            metadata
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ]], {
        ownerCitizenid,
        data.imageUrl,
        data.thumbnailUrl,
        data.caption,
        data.source or 'manual',
        data.favorite == true and 1 or 0,
        json.encode(data.metadata or {})
    })

    return Repository.GetGalleryPhotoById(photoId)
end

function Repository.RegisterGalleryPhoto(ownerCitizenid, imageUrl, options)
    options = type(options) == 'table' and options or {}

    return Repository.CreateGalleryPhoto(ownerCitizenid, {
        imageUrl = imageUrl,
        thumbnailUrl = options.thumbnailUrl,
        caption = options.caption,
        source = options.source or 'camera',
        favorite = options.favorite == true,
        metadata = options.metadata or {}
    })
end

function Repository.GetGalleryPhotos(ownerCitizenid, limit, offset)
    limit = math.max(1, math.min(tonumber(limit) or 40, 200))
    offset = math.max(0, tonumber(offset) or 0)

    return MySQL.query.await([[
        SELECT
            id,
            owner_citizenid,
            image_url,
            thumbnail_url,
            caption,
            source,
            favorite,
            metadata,
            created_at,
            deleted_at
        FROM mz_phone_gallery
        WHERE owner_citizenid = ? AND deleted_at IS NULL
        ORDER BY favorite DESC, created_at DESC, id DESC
        LIMIT ? OFFSET ?
    ]], { ownerCitizenid, limit, offset }) or {}
end

function Repository.GetGalleryPhotoById(id)
    id = tonumber(id)
    if not id then
        return nil
    end

    return MySQL.single.await([[
        SELECT
            id,
            owner_citizenid,
            image_url,
            thumbnail_url,
            caption,
            source,
            favorite,
            metadata,
            created_at,
            deleted_at
        FROM mz_phone_gallery
        WHERE id = ?
        LIMIT 1
    ]], { id })
end

function Repository.DeleteGalleryPhoto(ownerCitizenid, photoId)
    return MySQL.update.await([[
        UPDATE mz_phone_gallery
        SET deleted_at = CURRENT_TIMESTAMP
        WHERE id = ? AND owner_citizenid = ? AND deleted_at IS NULL
    ]], { photoId, ownerCitizenid })
end

function Repository.ToggleGalleryFavorite(ownerCitizenid, photoId, favorite)
    local updated = MySQL.update.await([[
        UPDATE mz_phone_gallery
        SET favorite = ?
        WHERE id = ? AND owner_citizenid = ? AND deleted_at IS NULL
    ]], { favorite == true and 1 or 0, photoId, ownerCitizenid })

    if not updated or tonumber(updated) <= 0 then
        return nil
    end

    return Repository.GetGalleryPhotoById(photoId)
end

function Repository.GetCallHistoryByCitizenId(citizenid, limit)
    limit = tonumber(limit) or 50

    return MySQL.query.await([[
        SELECT
            id,
            CASE
                WHEN caller_citizenid = ? THEN COALESCE(receiver_number, number, '')
                WHEN receiver_citizenid = ? THEN COALESCE(caller_number, number, '')
                ELSE COALESCE(number, receiver_number, caller_number, '')
            END AS number,
            COALESCE((
                SELECT contact_name
                FROM mz_phone_contacts
                WHERE owner_citizenid = ?
                    AND contact_phone = CASE
                        WHEN caller_citizenid = ? THEN COALESCE(receiver_number, number, '')
                        WHEN receiver_citizenid = ? THEN COALESCE(caller_number, number, '')
                        ELSE COALESCE(number, receiver_number, caller_number, '')
                    END
                ORDER BY favorite DESC, id DESC
                LIMIT 1
            ), CASE
                WHEN caller_citizenid = ? THEN COALESCE(receiver_number, number, '')
                WHEN receiver_citizenid = ? THEN COALESCE(caller_number, number, '')
                ELSE COALESCE(number, receiver_number, caller_number, '')
            END) AS display_name,
            contact_id,
            CASE
                WHEN status IN ('missed', 'unanswered') THEN 'missed'
                WHEN caller_citizenid = ? THEN 'outgoing'
                WHEN receiver_citizenid = ? THEN 'incoming'
                ELSE COALESCE(direction, 'outgoing')
            END AS direction,
            status,
            duration,
            COALESCE(timestamp, CAST(UNIX_TIMESTAMP(COALESCE(started_at, created_at)) * 1000 AS UNSIGNED)) AS timestamp,
            started_at,
            answered_at,
            ended_at,
            created_at
        FROM mz_phone_calls
        WHERE caller_citizenid = ?
            OR receiver_citizenid = ?
            OR owner_citizenid = ?
        ORDER BY id DESC
        LIMIT ?
    ]], {
        citizenid,
        citizenid,
        citizenid,
        citizenid,
        citizenid,
        citizenid,
        citizenid,
        citizenid,
        citizenid,
        citizenid,
        citizenid,
        citizenid,
        limit
    }) or {}
end

function Repository.GetCalls(citizenid)
    local limit = Config and Config.Phone and Config.Phone.Calls and Config.Phone.Calls.MaxHistory or 50
    return Repository.GetCallHistoryByCitizenId(citizenid, limit)
end

function Repository.CreateCall(data)
    data = type(data) == 'table' and data or {}

    return MySQL.insert.await([[
        INSERT INTO mz_phone_calls (
            owner_citizenid,
            caller_citizenid,
            receiver_citizenid,
            caller_number,
            receiver_number,
            number,
            contact_id,
            direction,
            status,
            started_at,
            duration,
            timestamp
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
    ]], {
        data.ownerCitizenid or data.callerCitizenid,
        data.callerCitizenid,
        data.receiverCitizenid,
        data.callerNumber,
        data.receiverNumber,
        data.number or data.receiverNumber,
        data.contactId,
        data.direction,
        data.status or 'ringing',
        tonumber(data.duration) or 0,
        tonumber(data.timestamp)
    })
end

function Repository.GetCallById(callId)
    return MySQL.single.await([[
        SELECT *
        FROM mz_phone_calls
        WHERE id = ?
        LIMIT 1
    ]], { callId })
end

function Repository.UpdateCallStatus(callId, status)
    return MySQL.update.await([[
        UPDATE mz_phone_calls
        SET status = ?
        WHERE id = ?
    ]], { status, callId })
end

function Repository.MarkCallAnswered(callId)
    return MySQL.update.await([[
        UPDATE mz_phone_calls
        SET status = 'accepted', answered_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'ringing'
    ]], { callId })
end

function Repository.MarkCallDeclined(callId)
    return MySQL.update.await([[
        UPDATE mz_phone_calls
        SET status = 'declined', ended_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'ringing'
    ]], { callId })
end

function Repository.MarkCallMissed(callId)
    return MySQL.update.await([[
        UPDATE mz_phone_calls
        SET status = 'missed', ended_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'ringing'
    ]], { callId })
end

function Repository.MarkCallUnanswered(callId)
    return MySQL.update.await([[
        UPDATE mz_phone_calls
        SET status = 'unanswered', ended_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'ringing'
    ]], { callId })
end

function Repository.MarkCallFailed(callId)
    return MySQL.update.await([[
        UPDATE mz_phone_calls
        SET status = 'failed', ended_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'ringing'
    ]], { callId })
end

function Repository.MarkCallEnded(callId)
    return MySQL.update.await([[
        UPDATE mz_phone_calls
        SET status = 'ended',
            ended_at = CURRENT_TIMESTAMP,
            duration = CASE
                WHEN answered_at IS NOT NULL THEN TIMESTAMPDIFF(SECOND, answered_at, CURRENT_TIMESTAMP)
                ELSE duration
            END
        WHERE id = ? AND status IN ('ringing', 'accepted')
    ]], { callId })
end

function Repository.DeleteCall(citizenid, callId)
    return MySQL.update.await([[
        DELETE FROM mz_phone_calls
        WHERE id = ? AND (owner_citizenid = ? OR caller_citizenid = ? OR receiver_citizenid = ?)
    ]], { callId, citizenid, citizenid, citizenid })
end

function Repository.ClearCalls(citizenid)
    return MySQL.update.await([[
        DELETE FROM mz_phone_calls
        WHERE owner_citizenid = ? OR caller_citizenid = ? OR receiver_citizenid = ?
    ]], { citizenid, citizenid, citizenid })
end
