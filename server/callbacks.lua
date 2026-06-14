local Service = MZPhoneServer.Service
local Security = MZPhoneServer.Security
local Framework = MZPhoneServer.Framework

local function runSafe(label, source, fn)
    local ok, result, extra = xpcall(fn, debug.traceback)
    if ok then
        return result, extra
    end

    Security.Log('sql_or_service_error', source, ('context=%s error=%s'):format(tostring(label), tostring(result)), true)
    TriggerClientEvent('mz_phone:client:openDenied', source, 'generic_error')
    return nil, 'internal_error'
end

RegisterNetEvent('mz_phone:server:requestOpen', function()
    local src = source
    Security.LogSource('callback/open', src, true)

    runSafe('requestOpen', src, function()
        Security.Log('open', src, 'request')

        local allowed, reason, identity = Service.CanOpenPhone(src)
        if not allowed then
            Security.Log('open', src, ('denied reason=%s'):format(tostring(reason)))
            TriggerClientEvent('mz_phone:client:openDenied', src, reason or 'identity_unavailable')
            return
        end

        Security.Log('open', src, ('identity citizenid=%s'):format(Security.Mask(identity and identity.citizenid)))

        local data, loadErr = Service.Load(src)
        if not data then
            Security.Log('open', src, ('load_failed reason=%s'):format(tostring(loadErr)))
            TriggerClientEvent('mz_phone:client:openDenied', src, loadErr or 'generic_error')
            return
        end

        Security.Log('open', src, 'allowed')
        TriggerClientEvent('mz_phone:client:openAllowed', src, data)
    end)
end)

RegisterNetEvent('mz_phone:server:load', function()
    local src = source
    Security.LogSource('callback/load', src, true)

    local data, err = runSafe('load', src, function()
        return Service.Load(src)
    end)

    if not data then
        Security.Log('load', src, err or 'failed')
        return
    end

    TriggerClientEvent('mz_phone:client:loaded', src, data)
end)

RegisterNetEvent('mz_phone:server:save', function(data)
    local src = source
    runSafe('save', src, function()
        Service.Save(src, data or {})
    end)
end)

RegisterNetEvent('mz_phone:server:getNotes', function()
    local src = source
    runSafe('getNotes', src, function()
        Service.GetNotes(src)
    end)
end)

RegisterNetEvent('mz_phone:server:createNote', function(data)
    local src = source
    runSafe('createNote', src, function()
        Service.CreateNote(src, data or {})
    end)
end)

RegisterNetEvent('mz_phone:server:updateNote', function(noteId, data)
    local src = source
    runSafe('updateNote', src, function()
        Service.UpdateNote(src, noteId, data or {})
    end)
end)

RegisterNetEvent('mz_phone:server:deleteNote', function(noteId)
    local src = source
    runSafe('deleteNote', src, function()
        Service.DeleteNote(src, noteId)
    end)
end)

RegisterNetEvent('mz_phone:server:getContacts', function()
    local src = source
    runSafe('getContacts', src, function()
        Service.GetContacts(src)
    end)
end)

RegisterNetEvent('mz_phone:server:createContact', function(data)
    local src = source
    runSafe('createContact', src, function()
        Service.CreateContact(src, data or {})
    end)
end)

RegisterNetEvent('mz_phone:server:updateContact', function(contactId, data)
    local src = source
    runSafe('updateContact', src, function()
        Service.UpdateContact(src, contactId, data or {})
    end)
end)

RegisterNetEvent('mz_phone:server:deleteContact', function(contactId)
    local src = source
    runSafe('deleteContact', src, function()
        Service.DeleteContact(src, contactId)
    end)
end)

RegisterNetEvent('mz_phone:server:toggleFavoriteContact', function(contactId)
    local src = source
    runSafe('toggleFavoriteContact', src, function()
        Service.ToggleFavoriteContact(src, contactId)
    end)
end)

RegisterNetEvent('mz_phone:server:getConversations', function()
    local src = source
    runSafe('getConversations', src, function()
        Service.GetConversations(src)
    end)
end)

RegisterNetEvent('mz_phone:server:getConversationMessages', function(conversationId)
    local src = source
    runSafe('getConversationMessages', src, function()
        Service.GetConversationMessages(src, conversationId)
    end)
end)

RegisterNetEvent('mz_phone:server:createConversation', function(data)
    local src = source
    runSafe('createConversation', src, function()
        Service.CreateConversation(src, data or {})
    end)
end)

RegisterNetEvent('mz_phone:server:sendMessage', function(conversationId, data)
    local src = source
    runSafe('sendMessage', src, function()
        Service.SendMessage(src, conversationId, data or {})
    end)
end)

RegisterNetEvent('mz_phone:server:markConversationRead', function(conversationId)
    local src = source
    runSafe('markConversationRead', src, function()
        Service.MarkConversationRead(src, conversationId)
    end)
end)

RegisterNetEvent('mz_phone:server:getGallery', function()
    local src = source
    runSafe('getGallery', src, function()
        Service.GetGallery(src)
    end)
end)

RegisterNetEvent('mz_phone:server:addGalleryPhoto', function(data)
    local src = source
    runSafe('addGalleryPhoto', src, function()
        Service.AddGalleryPhoto(src, data or {})
    end)
end)

RegisterNetEvent('mz_phone:server:deleteGalleryPhoto', function(photoId)
    local src = source
    runSafe('deleteGalleryPhoto', src, function()
        Service.DeleteGalleryPhoto(src, photoId)
    end)
end)

RegisterNetEvent('mz_phone:server:toggleGalleryFavorite', function(photoId, favorite)
    local src = source
    runSafe('toggleGalleryFavorite', src, function()
        Service.ToggleGalleryFavorite(src, photoId, favorite)
    end)
end)

RegisterNetEvent('mz_phone:server:getRealEstateListings', function(filters)
    local src = source
    runSafe('getRealEstateListings', src, function()
        local listings, err = Service.GetRealEstateListings(src, filters or {})
        TriggerClientEvent('mz_phone:client:receiveRealEstateListings', src, {
            ok = listings ~= nil,
            error = err,
            listings = listings or {}
        })
    end)
end)

RegisterNetEvent('mz_phone:server:getRealEstateListing', function(listingCode)
    local src = source
    runSafe('getRealEstateListing', src, function()
        local listing, err = Service.GetRealEstateListing(src, listingCode)
        TriggerClientEvent('mz_phone:client:receiveRealEstateListing', src, {
            ok = listing ~= nil,
            error = err,
            listing = listing
        })
    end)
end)

RegisterNetEvent('mz_phone:server:getRealEstateBrokerAccess', function()
    local src = source
    runSafe('getRealEstateBrokerAccess', src, function()
        local access, err = Service.GetRealEstateBrokerAccess(src)
        TriggerClientEvent('mz_phone:client:receiveRealEstateBrokerAccess', src, {
            ok = access ~= nil,
            error = err,
            access = access
        })
    end)
end)

RegisterNetEvent('mz_phone:server:getRealEstateProperties', function()
    local src = source
    runSafe('getRealEstateProperties', src, function()
        local properties, err = Service.GetRealEstateProperties(src)
        TriggerClientEvent('mz_phone:client:receiveRealEstateProperties', src, {
            ok = properties ~= nil,
            error = err,
            properties = properties or {}
        })
    end)
end)

RegisterNetEvent('mz_phone:server:getMyRealEstateListings', function()
    local src = source
    runSafe('getMyRealEstateListings', src, function()
        local listings, err = Service.GetMyRealEstateListings(src)
        TriggerClientEvent('mz_phone:client:receiveMyRealEstateListings', src, {
            ok = listings ~= nil,
            error = err,
            listings = listings or {}
        })
    end)
end)

RegisterNetEvent('mz_phone:server:getMyRealEstateListing', function(listingCode)
    local src = source
    runSafe('getMyRealEstateListing', src, function()
        local listing, err = Service.GetMyRealEstateListing(src, listingCode)
        TriggerClientEvent('mz_phone:client:receiveMyRealEstateListing', src, {
            ok = listing ~= nil,
            error = err,
            listing = listing
        })
    end)
end)

RegisterNetEvent('mz_phone:server:createRealEstateListing', function(data)
    local src = source
    runSafe('createRealEstateListing', src, function()
        local result, err = Service.CreateRealEstateListing(src, data or {})
        TriggerClientEvent('mz_phone:client:receiveRealEstateAction', src, {
            ok = result ~= nil,
            action = 'create',
            error = err,
            result = result
        })
    end)
end)

RegisterNetEvent('mz_phone:server:updateRealEstateListing', function(listingCode, data)
    local src = source
    runSafe('updateRealEstateListing', src, function()
        local result, err = Service.UpdateRealEstateListing(src, listingCode, data or {})
        TriggerClientEvent('mz_phone:client:receiveRealEstateAction', src, {
            ok = result ~= nil,
            action = 'update',
            error = err,
            result = result
        })
    end)
end)

RegisterNetEvent('mz_phone:server:setRealEstateListingStatus', function(listingCode, status)
    local src = source
    runSafe('setRealEstateListingStatus', src, function()
        local result, err = Service.SetRealEstateListingStatus(src, listingCode, status)
        TriggerClientEvent('mz_phone:client:receiveRealEstateAction', src, {
            ok = result ~= nil,
            action = 'status',
            error = err,
            result = result
        })
    end)
end)

RegisterNetEvent('mz_phone:server:getRealEstateGalleryPhotos', function()
    local src = source
    runSafe('getRealEstateGalleryPhotos', src, function()
        local photos, err = Service.GetPhoneGalleryForRealEstate(src)
        TriggerClientEvent('mz_phone:client:receiveGallery', src, photos or {})
        TriggerClientEvent('mz_phone:client:receiveRealEstateAction', src, {
            ok = photos ~= nil,
            action = 'gallery',
            error = err,
            result = { photos = photos or {} }
        })
    end)
end)

RegisterNetEvent('mz_phone:server:getRealEstateListingPhotos', function(listingCode)
    local src = source
    runSafe('getRealEstateListingPhotos', src, function()
        local result, err = Service.GetRealEstateListingPhotos(src, listingCode)
        TriggerClientEvent('mz_phone:client:receiveRealEstateAction', src, {
            ok = result ~= nil,
            action = 'photos',
            error = err,
            result = result
        })
    end)
end)

RegisterNetEvent('mz_phone:server:attachRealEstateGalleryPhoto', function(listingCode, galleryPhotoId)
    local src = source
    runSafe('attachRealEstateGalleryPhoto', src, function()
        local result, err = Service.AttachGalleryPhotoToRealEstateListing(src, listingCode, galleryPhotoId)
        TriggerClientEvent('mz_phone:client:receiveRealEstateAction', src, {
            ok = result ~= nil,
            action = 'photo_attach',
            error = err,
            result = result
        })
    end)
end)

RegisterNetEvent('mz_phone:server:setRealEstatePrimaryPhoto', function(listingCode, photoId)
    local src = source
    runSafe('setRealEstatePrimaryPhoto', src, function()
        local result, err = Service.SetRealEstateListingPrimaryPhoto(src, listingCode, photoId)
        TriggerClientEvent('mz_phone:client:receiveRealEstateAction', src, {
            ok = result ~= nil,
            action = 'photo_primary',
            error = err,
            result = result
        })
    end)
end)

RegisterNetEvent('mz_phone:server:removeRealEstatePhoto', function(listingCode, photoId)
    local src = source
    runSafe('removeRealEstatePhoto', src, function()
        local result, err = Service.RemoveRealEstateListingPhoto(src, listingCode, photoId)
        TriggerClientEvent('mz_phone:client:receiveRealEstateAction', src, {
            ok = result ~= nil,
            action = 'photo_remove',
            error = err,
            result = result
        })
    end)
end)

RegisterNetEvent('mz_phone:server:saveCameraPhoto', function(requestId, imageUrl, metadata)
    local src = source
    local safeRequestId = tostring(requestId or '')

    local ok, photoOrErr, err = xpcall(function()
        return Service.SaveCameraPhoto(src, imageUrl, metadata or {})
    end, debug.traceback)

    if not ok then
        Security.Log('camera_error', src, ('request=%s error=%s'):format(safeRequestId, tostring(photoOrErr)), true)
        TriggerClientEvent('mz_phone:client:cameraPhotoSaved', src, {
            requestId = safeRequestId,
            ok = false,
            error = 'internal_error'
        })
        return
    end

    if not photoOrErr then
        TriggerClientEvent('mz_phone:client:cameraPhotoSaved', src, {
            requestId = safeRequestId,
            ok = false,
            error = err or 'save_failed'
        })
        return
    end

    TriggerClientEvent('mz_phone:client:cameraPhotoSaved', src, {
        requestId = safeRequestId,
        ok = true,
        photo = photoOrErr
    })
end)

RegisterNetEvent('mz_phone:server:getCalls', function()
    local src = source
    runSafe('getCalls', src, function()
        Service.GetCalls(src)
    end)
end)

RegisterNetEvent('mz_phone:server:getCallHistory', function()
    local src = source
    runSafe('getCallHistory', src, function()
        Service.GetCallHistory(src)
    end)
end)

RegisterNetEvent('mz_phone:server:startCall', function(data)
    local src = source
    runSafe('startCall', src, function()
        Service.StartCall(src, data or {})
    end)
end)

RegisterNetEvent('mz_phone:server:acceptCall', function(callId)
    local src = source
    runSafe('acceptCall', src, function()
        Service.AcceptCall(src, callId)
    end)
end)

RegisterNetEvent('mz_phone:server:declineCall', function(callId)
    local src = source
    runSafe('declineCall', src, function()
        Service.DeclineCall(src, callId)
    end)
end)

RegisterNetEvent('mz_phone:server:endCall', function(callId)
    local src = source
    runSafe('endCall', src, function()
        Service.EndCall(src, callId)
    end)
end)

RegisterNetEvent('mz_phone:server:createCall', function(data)
    local src = source
    runSafe('createCall', src, function()
        Service.CreateCall(src, data or {})
    end)
end)

RegisterNetEvent('mz_phone:server:deleteCall', function(callId)
    local src = source
    runSafe('deleteCall', src, function()
        Service.DeleteCall(src, callId)
    end)
end)

RegisterNetEvent('mz_phone:server:clearCalls', function()
    local src = source
    runSafe('clearCalls', src, function()
        Service.ClearCalls(src)
    end)
end)

RegisterNetEvent('mz_phone:server:debugReport', function()
    local src = source
    Security.LogSource('callback/debugReport', src, true)

    runSafe('debugReport', src, function()
        local allowed, reason = Service.CanUseDebugCommand(src)
        if not allowed then
            TriggerClientEvent('mz_phone:client:debugReport', src, nil, reason or 'not_allowed')
            return
        end

        TriggerClientEvent('mz_phone:client:debugReport', src, Service.BuildDebugReport(src))
    end)
end)
