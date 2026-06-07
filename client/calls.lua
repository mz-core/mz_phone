MZPhone = MZPhone or {}
MZPhone.Calls = MZPhone.Calls or {}

local function sendCallMessage(action, data)
    MZPhone.Debug.Log('calls', ('event=%s callId=%s'):format(tostring(action), tostring(data and data.callId)))
    SendNUIMessage({
        action = action,
        data = data or {}
    })
end

RegisterNetEvent('mz_phone:client:incomingCall', function(data)
    sendCallMessage('incomingCall', data or {})
end)

RegisterNetEvent('mz_phone:client:outgoingCallStarted', function(data)
    sendCallMessage('outgoingCallStarted', data or {})
end)

RegisterNetEvent('mz_phone:client:callAccepted', function(data)
    sendCallMessage('callAccepted', data or {})
end)

RegisterNetEvent('mz_phone:client:callDeclined', function(data)
    sendCallMessage('callDeclined', data or {})
end)

RegisterNetEvent('mz_phone:client:callEnded', function(data)
    sendCallMessage('callEnded', data or {})
end)

RegisterNetEvent('mz_phone:client:callMissed', function(data)
    sendCallMessage('callMissed', data or {})
end)

RegisterNetEvent('mz_phone:client:callUnanswered', function(data)
    sendCallMessage('callUnanswered', data or {})
end)

RegisterNetEvent('mz_phone:client:callUnavailable', function(data)
    sendCallMessage('callUnavailable', data or {})
end)

RegisterNetEvent('mz_phone:client:callBusy', function(data)
    sendCallMessage('callBusy', data or {})
end)
