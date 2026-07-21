local function ok(cb, payload)
    cb(payload or { ok = true })
end

local function nuiLog(action, message)
    if MZPhone and MZPhone.Debug and MZPhone.Debug.Nui then
        MZPhone.Debug.Nui(action, message)
    end
end

RegisterNUICallback('phoneReady', function(_, cb)
    nuiLog('phoneReady', 'request load')
    TriggerServerEvent('mz_phone:server:load')
    ok(cb)
end)

RegisterNUICallback('phoneSave', function(data, cb)
    nuiLog('phoneSave', 'save settings')
    TriggerServerEvent('mz_phone:server:save', data or {})
    ok(cb)
end)

RegisterNUICallback('close', function(_, cb)
    nuiLog('close', 'close requested')
    MZPhone.SetOpen(false)
    ok(cb)
end)

RegisterNUICallback('bankRequest', function(data, cb)
    nuiLog('bankRequest', ('action=%s'):format(tostring(data and data.action)))
    TriggerServerEvent(
        'mz_phone:server:bankRequest',
        data and data.requestId,
        data and data.action,
        data and data.payload or {}
    )
    ok(cb)
end)

RegisterNUICallback('bankClose', function(_, cb)
    TriggerServerEvent('mz_phone:server:bankClose')
    ok(cb)
end)

RegisterNUICallback('getNotes', function(_, cb)
    nuiLog('getNotes', 'request notes')
    TriggerServerEvent('mz_phone:server:getNotes')
    ok(cb)
end)

RegisterNUICallback('createNote', function(data, cb)
    nuiLog('createNote', 'create note')
    TriggerServerEvent('mz_phone:server:createNote', data or {})
    ok(cb)
end)

RegisterNUICallback('updateNote', function(data, cb)
    nuiLog('updateNote', ('id=%s'):format(tostring(data and data.noteId)))
    TriggerServerEvent('mz_phone:server:updateNote', data and data.noteId, data and data.payload or {})
    ok(cb)
end)

RegisterNUICallback('deleteNote', function(data, cb)
    nuiLog('deleteNote', ('id=%s'):format(tostring(data and data.noteId)))
    TriggerServerEvent('mz_phone:server:deleteNote', data and data.noteId)
    ok(cb)
end)

RegisterNUICallback('getContacts', function(_, cb)
    nuiLog('getContacts', 'request contacts')
    TriggerServerEvent('mz_phone:server:getContacts')
    ok(cb)
end)

RegisterNUICallback('createContact', function(data, cb)
    nuiLog('createContact', 'create contact')
    TriggerServerEvent('mz_phone:server:createContact', data or {})
    ok(cb)
end)

RegisterNUICallback('updateContact', function(data, cb)
    TriggerServerEvent('mz_phone:server:updateContact', data and data.contactId, data and data.payload or {})
    ok(cb)
end)

RegisterNUICallback('deleteContact', function(data, cb)
    nuiLog('deleteContact', ('id=%s'):format(tostring(data and data.contactId)))
    TriggerServerEvent('mz_phone:server:deleteContact', data and data.contactId)
    ok(cb)
end)

RegisterNUICallback('toggleFavoriteContact', function(data, cb)
    TriggerServerEvent('mz_phone:server:toggleFavoriteContact', data and data.contactId)
    ok(cb)
end)

RegisterNUICallback('getConversations', function(_, cb)
    nuiLog('getConversations', 'request conversations')
    TriggerServerEvent('mz_phone:server:getConversations')
    ok(cb)
end)

RegisterNUICallback('getConversationMessages', function(data, cb)
    TriggerServerEvent('mz_phone:server:getConversationMessages', data and data.conversationId)
    ok(cb)
end)

RegisterNUICallback('createConversation', function(data, cb)
    TriggerServerEvent('mz_phone:server:createConversation', data or {})
    ok(cb)
end)

RegisterNUICallback('sendMessage', function(data, cb)
    nuiLog('sendMessage', ('conversation=%s'):format(tostring(data and data.conversationId)))
    TriggerServerEvent('mz_phone:server:sendMessage', data and data.conversationId, data or {})
    ok(cb)
end)

RegisterNUICallback('markConversationRead', function(data, cb)
    TriggerServerEvent('mz_phone:server:markConversationRead', data and data.conversationId)
    ok(cb)
end)

RegisterNUICallback('getGallery', function(_, cb)
    nuiLog('getGallery', 'request gallery')
    TriggerServerEvent('mz_phone:server:getGallery')
    ok(cb)
end)

RegisterNUICallback('addGalleryPhoto', function(data, cb)
    nuiLog('addGalleryPhoto', 'add gallery photo')
    TriggerServerEvent('mz_phone:server:addGalleryPhoto', data or {})
    ok(cb)
end)

RegisterNUICallback('deleteGalleryPhoto', function(data, cb)
    nuiLog('deleteGalleryPhoto', ('id=%s'):format(tostring(data and data.photoId)))
    TriggerServerEvent('mz_phone:server:deleteGalleryPhoto', data and data.photoId)
    ok(cb)
end)

RegisterNUICallback('toggleGalleryFavorite', function(data, cb)
    TriggerServerEvent('mz_phone:server:toggleGalleryFavorite', data and data.photoId, data and data.favorite == true)
    ok(cb)
end)

RegisterNUICallback('openCameraMode', function(data, cb)
    nuiLog('openCameraMode', 'camera mode requested')

    if MZPhone.Camera and MZPhone.Camera.StartCameraMode then
        MZPhone.Camera.StartCameraMode(data or {}, cb)
        return
    end

    ok(cb, { ok = false, error = 'camera_unavailable' })
end)

RegisterNUICallback('takePhoto', function(data, cb)
    nuiLog('takePhoto', 'camera capture requested')

    if MZPhone.Camera and MZPhone.Camera.TakePhoto then
        MZPhone.Camera.TakePhoto(data or {}, cb)
        return
    end

    ok(cb, { ok = false, error = 'camera_unavailable' })
end)

RegisterNUICallback('setWaypoint', function(data, cb)
    data = type(data) == 'table' and data or {}
    local x = tonumber(data.x)
    local y = tonumber(data.y)

    if not x or not y or math.abs(x) > 10000.0 or math.abs(y) > 10000.0 then
        ok(cb, { ok = false, error = 'invalid_coords' })
        return
    end

    SetNewWaypoint(x + 0.0, y + 0.0)

    if MZPhone.Framework and MZPhone.Framework.Notify then
        MZPhone.Framework.Notify('GPS marcado no mapa.', 'success', 'Mensagens')
    end

    ok(cb, { ok = true })
end)

RegisterNUICallback('getRealEstateListings', function(data, cb)
    nuiLog('getRealEstateListings', 'request real estate listings')
    TriggerServerEvent('mz_phone:server:getRealEstateListings', data or {})
    ok(cb)
end)

RegisterNUICallback('getRealEstateListing', function(data, cb)
    local listingCode = data and data.listingCode or nil
    nuiLog('getRealEstateListing', ('listing=%s'):format(tostring(listingCode)))
    TriggerServerEvent('mz_phone:server:getRealEstateListing', listingCode)
    ok(cb)
end)

RegisterNUICallback('getRealEstateBrokerAccess', function(_, cb)
    nuiLog('getRealEstateBrokerAccess', 'request real estate broker access')
    TriggerServerEvent('mz_phone:server:getRealEstateBrokerAccess')
    ok(cb)
end)

RegisterNUICallback('getRealEstateProperties', function(_, cb)
    nuiLog('getRealEstateProperties', 'request real estate properties')
    TriggerServerEvent('mz_phone:server:getRealEstateProperties')
    ok(cb)
end)

RegisterNUICallback('getMyRealEstateListings', function(_, cb)
    nuiLog('getMyRealEstateListings', 'request my real estate listings')
    TriggerServerEvent('mz_phone:server:getMyRealEstateListings')
    ok(cb)
end)

RegisterNUICallback('getMyRealEstateListing', function(data, cb)
    local listingCode = data and data.listingCode or nil
    nuiLog('getMyRealEstateListing', ('listing=%s'):format(tostring(listingCode)))
    TriggerServerEvent('mz_phone:server:getMyRealEstateListing', listingCode)
    ok(cb)
end)

RegisterNUICallback('createRealEstateListing', function(data, cb)
    nuiLog('createRealEstateListing', 'callback received')
    TriggerServerEvent('mz_phone:server:createRealEstateListing', data or {})
    ok(cb)
end)

RegisterNUICallback('updateRealEstateListing', function(data, cb)
    local listingCode = data and data.listingCode or nil
    nuiLog('updateRealEstateListing', ('listing=%s'):format(tostring(listingCode)))
    TriggerServerEvent('mz_phone:server:updateRealEstateListing', listingCode, data and data.payload or {})
    ok(cb)
end)

RegisterNUICallback('setRealEstateListingStatus', function(data, cb)
    local listingCode = data and data.listingCode or nil
    local status = data and data.status or nil
    nuiLog('setRealEstateListingStatus', ('listing=%s status=%s'):format(tostring(listingCode), tostring(status)))
    TriggerServerEvent('mz_phone:server:setRealEstateListingStatus', listingCode, status)
    ok(cb)
end)

RegisterNUICallback('getRealEstateGalleryPhotos', function(_, cb)
    nuiLog('getRealEstateGalleryPhotos', 'request real estate gallery photos')
    TriggerServerEvent('mz_phone:server:getRealEstateGalleryPhotos')
    ok(cb)
end)

RegisterNUICallback('getRealEstateListingPhotos', function(data, cb)
    local listingCode = data and data.listingCode or nil
    nuiLog('getRealEstateListingPhotos', ('listing=%s'):format(tostring(listingCode)))
    TriggerServerEvent('mz_phone:server:getRealEstateListingPhotos', listingCode)
    ok(cb)
end)

RegisterNUICallback('attachRealEstateGalleryPhoto', function(data, cb)
    local listingCode = data and data.listingCode or nil
    local galleryPhotoId = data and (data.galleryPhotoId or data.photoId) or nil
    nuiLog('attachRealEstateGalleryPhoto', ('listing=%s photo=%s'):format(tostring(listingCode), tostring(galleryPhotoId)))
    TriggerServerEvent('mz_phone:server:attachRealEstateGalleryPhoto', listingCode, galleryPhotoId)
    ok(cb)
end)

RegisterNUICallback('setRealEstatePrimaryPhoto', function(data, cb)
    local listingCode = data and data.listingCode or nil
    local photoId = data and data.photoId or nil
    nuiLog('setRealEstatePrimaryPhoto', ('listing=%s photo=%s'):format(tostring(listingCode), tostring(photoId)))
    TriggerServerEvent('mz_phone:server:setRealEstatePrimaryPhoto', listingCode, photoId)
    ok(cb)
end)

RegisterNUICallback('removeRealEstatePhoto', function(data, cb)
    local listingCode = data and data.listingCode or nil
    local photoId = data and data.photoId or nil
    nuiLog('removeRealEstatePhoto', ('listing=%s photo=%s'):format(tostring(listingCode), tostring(photoId)))
    TriggerServerEvent('mz_phone:server:removeRealEstatePhoto', listingCode, photoId)
    ok(cb)
end)

RegisterNUICallback('getCalls', function(_, cb)
    TriggerServerEvent('mz_phone:server:getCalls')
    ok(cb)
end)

RegisterNUICallback('getCallHistory', function(_, cb)
    TriggerServerEvent('mz_phone:server:getCallHistory')
    ok(cb)
end)

RegisterNUICallback('createCall', function(data, cb)
    TriggerServerEvent('mz_phone:server:createCall', data or {})
    ok(cb)
end)

RegisterNUICallback('deleteCall', function(data, cb)
    TriggerServerEvent('mz_phone:server:deleteCall', data and data.callId)
    ok(cb)
end)

RegisterNUICallback('clearCalls', function(_, cb)
    TriggerServerEvent('mz_phone:server:clearCalls')
    ok(cb)
end)

RegisterNUICallback('callUser', function(data, cb)
    nuiLog('callUser', ('number=%s'):format(tostring(data and data.number)))
    TriggerServerEvent('mz_phone:server:startCall', data or {})
    ok(cb)
end)

RegisterNUICallback('acceptCall', function(data, cb)
    nuiLog('acceptCall', ('callId=%s'):format(tostring(data and data.callId)))
    TriggerServerEvent('mz_phone:server:acceptCall', data and data.callId)
    ok(cb)
end)

RegisterNUICallback('declineCall', function(data, cb)
    nuiLog('declineCall', ('callId=%s'):format(tostring(data and data.callId)))
    TriggerServerEvent('mz_phone:server:declineCall', data and data.callId)
    ok(cb)
end)

RegisterNUICallback('endVoiceCall', function(data, cb)
    nuiLog('endVoiceCall', ('callId=%s'):format(tostring(data and data.callId)))
    TriggerServerEvent('mz_phone:server:endCall', data and data.callId)

    if data and data.closePhoneAfterCall == true then
        nuiLog('endVoiceCall', 'closing phone after dialing cancel')
        MZPhone.SetOpen(false)
    end

    ok(cb)
end)

RegisterNetEvent('mz_phone:client:receiveContacts', function(contacts)
    MZPhone.Debug.Log('contacts', ('received count=%s'):format(tostring(#(contacts or {}))))
    SendNUIMessage({ action = 'receiveContacts', contacts = contacts or {} })
end)

RegisterNetEvent('mz_phone:client:bankResponse', function(data)
    SendNUIMessage({ action = 'bankResponse', data = data or {} })
end)

RegisterNetEvent('mz_phone:client:receiveNotes', function(notes)
    MZPhone.Debug.Log('notes', ('received count=%s'):format(tostring(#(notes or {}))))
    SendNUIMessage({ action = 'receiveNotes', notes = notes or {} })
end)

RegisterNetEvent('mz_phone:client:receiveConversations', function(data)
    MZPhone.Debug.Log('messages', ('received conversations=%s'):format(tostring(#(data or {}))))
    SendNUIMessage({ action = 'receiveConversations', data = data or {} })
end)

RegisterNetEvent('mz_phone:client:receiveConversationMessages', function(data)
    local count = type(data) == 'table' and type(data.messages) == 'table' and #data.messages or 0
    MZPhone.Debug.Log('messages', ('received conversation=%s count=%s'):format(tostring(data and data.conversationId), tostring(count)))
    SendNUIMessage({ action = 'receiveConversationMessages', data = data or {} })
end)

RegisterNetEvent('mz_phone:client:receiveCalls', function(data)
    SendNUIMessage({ action = 'receiveCalls', calls = data or {} })
end)

RegisterNetEvent('mz_phone:client:receiveGallery', function(data)
    SendNUIMessage({ action = 'receiveGallery', photos = data or {} })
end)

RegisterNetEvent('mz_phone:client:receiveRealEstateListings', function(data)
    SendNUIMessage({ action = 'receiveRealEstateListings', data = data or {} })
end)

RegisterNetEvent('mz_phone:client:receiveRealEstateListing', function(data)
    SendNUIMessage({ action = 'receiveRealEstateListing', data = data or {} })
end)

RegisterNetEvent('mz_phone:client:receiveRealEstateBrokerAccess', function(data)
    SendNUIMessage({ action = 'receiveRealEstateBrokerAccess', data = data or {} })
end)

RegisterNetEvent('mz_phone:client:receiveRealEstateProperties', function(data)
    SendNUIMessage({ action = 'receiveRealEstateProperties', data = data or {} })
end)

RegisterNetEvent('mz_phone:client:receiveMyRealEstateListings', function(data)
    SendNUIMessage({ action = 'receiveMyRealEstateListings', data = data or {} })
end)

RegisterNetEvent('mz_phone:client:receiveMyRealEstateListing', function(data)
    SendNUIMessage({ action = 'receiveMyRealEstateListing', data = data or {} })
end)

RegisterNetEvent('mz_phone:client:receiveRealEstateAction', function(data)
    SendNUIMessage({ action = 'receiveRealEstateAction', data = data or {} })
end)
