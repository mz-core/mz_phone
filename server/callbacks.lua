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
