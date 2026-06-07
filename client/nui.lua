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

RegisterNUICallback('getNotes', function(_, cb)
    SendNUIMessage({ action = 'receiveNotes', notes = {} })
    ok(cb)
end)

RegisterNUICallback('createNote', function(_, cb)
    SendNUIMessage({ action = 'receiveNotes', notes = {} })
    ok(cb)
end)

RegisterNUICallback('updateNote', function(_, cb)
    SendNUIMessage({ action = 'receiveNotes', notes = {} })
    ok(cb)
end)

RegisterNUICallback('deleteNote', function(_, cb)
    SendNUIMessage({ action = 'receiveNotes', notes = {} })
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
    ok(cb)
end)

RegisterNetEvent('mz_phone:client:receiveContacts', function(contacts)
    MZPhone.Debug.Log('contacts', ('received count=%s'):format(tostring(#(contacts or {}))))
    SendNUIMessage({ action = 'receiveContacts', contacts = contacts or {} })
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
