MZPhone = MZPhone or {}
MZPhone.Calls = MZPhone.Calls or {}

local function sendCallMessage(action, data)
    MZPhone.Debug.Log('calls', ('event=%s callId=%s'):format(tostring(action), tostring(data and data.callId)))
    SendNUIMessage({
        action = action,
        data = data or {}
    })
end

local callPreviewFocus = false

local function isPhoneOpen()
    return MZPhone.IsOpen and MZPhone.IsOpen() == true
end

local function enableCallPreviewFocus()
    if isPhoneOpen() then
        return
    end

    callPreviewFocus = true
    if MZPhone.AcquireFocus then
        MZPhone.AcquireFocus('incoming_call_closed_phone')
    else
        SetNuiFocus(true, true)
        if type(SetNuiFocusKeepInput) == 'function' then
            SetNuiFocusKeepInput(false)
        end
    end
end

local function releaseCallPreviewFocus(reason)
    if isPhoneOpen() then
        callPreviewFocus = false
        return
    end

    local hadPreviewFocus = callPreviewFocus == true
    callPreviewFocus = false

    if MZPhone.ReleaseFocus then
        MZPhone.ReleaseFocus(reason or (hadPreviewFocus and 'call_preview_end' or 'call_end_phone_closed'))
    else
        SetNuiFocus(false, false)
        if type(SetNuiFocusKeepInput) == 'function' then
            SetNuiFocusKeepInput(false)
        end
    end
end

RegisterNetEvent('mz_phone:client:incomingCall', function(data)
    enableCallPreviewFocus()
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
    releaseCallPreviewFocus('call_declined')
end)

RegisterNetEvent('mz_phone:client:callEnded', function(data)
    sendCallMessage('callEnded', data or {})
    releaseCallPreviewFocus('call_ended')
end)

RegisterNetEvent('mz_phone:client:callMissed', function(data)
    sendCallMessage('callMissed', data or {})
    releaseCallPreviewFocus('call_missed')
end)

RegisterNetEvent('mz_phone:client:callUnanswered', function(data)
    sendCallMessage('callUnanswered', data or {})
    releaseCallPreviewFocus('call_unanswered')
end)

RegisterNetEvent('mz_phone:client:callUnavailable', function(data)
    sendCallMessage('callUnavailable', data or {})
    releaseCallPreviewFocus('call_unavailable')
end)

RegisterNetEvent('mz_phone:client:callBusy', function(data)
    sendCallMessage('callBusy', data or {})
    releaseCallPreviewFocus('call_busy')
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then
        return
    end

    releaseCallPreviewFocus('resource_stop')
end)
