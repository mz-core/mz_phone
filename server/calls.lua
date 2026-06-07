MZPhoneServer = MZPhoneServer or {}
MZPhoneServer.Calls = MZPhoneServer.Calls or {}

local Calls = MZPhoneServer.Calls
local Repository = MZPhoneServer.Repository
local Security = MZPhoneServer.Security
local Framework = MZPhoneServer.Framework
local Service = MZPhoneServer.Service

local ActiveByCallId = {}
local ActiveByCitizenid = {}
local LastStartBySource = {}

local function callsConfig()
    return Config.Phone and Config.Phone.Calls or {}
end

local function callsEnabled()
    local cfg = callsConfig()
    return cfg.Enabled ~= false
end

local function logCall(action, source, message, force)
    Security.Log(('calls/%s'):format(tostring(action)), source, message, force)
end

local function sendCallEvent(source, eventName, payload)
    if source then
        TriggerClientEvent(('mz_phone:client:%s'):format(eventName), source, payload or {})
    end
end

local function sendCallUnavailable(source, reason)
    sendCallEvent(source, 'callUnavailable', {
        reason = reason or 'unavailable'
    })
end

local function sendCallBusy(source, reason)
    sendCallEvent(source, 'callBusy', {
        reason = reason or 'busy'
    })
end

local function refreshHistoryByCitizenid(citizenid)
    local targetSource = Framework.GetSourceByCitizenId(citizenid)
    if not targetSource then
        return
    end

    TriggerClientEvent('mz_phone:client:receiveCalls', targetSource, Repository.GetCalls(citizenid))
end

local function refreshBoth(call)
    if not call then
        return
    end

    if call.caller_citizenid and call.caller_citizenid ~= '' then
        refreshHistoryByCitizenid(call.caller_citizenid)
    end

    if call.receiver_citizenid and call.receiver_citizenid ~= '' then
        refreshHistoryByCitizenid(call.receiver_citizenid)
    end
end

local function clearActive(call)
    if not call then
        return
    end

    ActiveByCallId[tonumber(call.id)] = nil

    if call.caller_citizenid and ActiveByCitizenid[call.caller_citizenid] == tonumber(call.id) then
        ActiveByCitizenid[call.caller_citizenid] = nil
    end

    if call.receiver_citizenid and ActiveByCitizenid[call.receiver_citizenid] == tonumber(call.id) then
        ActiveByCitizenid[call.receiver_citizenid] = nil
    end
end

local function getOnlineSource(citizenid)
    local targetSource = Framework.GetSourceByCitizenId(citizenid)
    targetSource = tonumber(targetSource)
    if not targetSource or targetSource <= 0 then
        return nil
    end

    return targetSource
end

local function getIdentityAndNumber(source, context)
    local identity, identityErr = Security.RequireIdentity(source, { context = context })
    if not identity then
        return nil, nil, identityErr or 'identity_unavailable'
    end

    local phoneNumber, numberErr = Service.EnsurePhoneNumber(identity)
    if not phoneNumber or phoneNumber == '' then
        return nil, nil, numberErr or 'number_unavailable'
    end

    return identity, phoneNumber, nil
end

local function identityFallbackName(identity)
    local name = ((identity.firstname or '') .. ' ' .. (identity.lastname or '')):gsub('^%s+', ''):gsub('%s+$', '')
    if name == '' then
        return nil
    end

    return name
end

local function resolveDisplayName(ownerCitizenid, remoteNumber, fallbackName)
    local contactName = Repository.FindContactNameByNumber(ownerCitizenid, remoteNumber)
    if contactName and contactName ~= '' then
        return contactName
    end

    if fallbackName and fallbackName ~= '' then
        return fallbackName
    end

    if remoteNumber and remoteNumber ~= '' then
        return remoteNumber
    end

    return 'Desconhecido'
end

local function startRingTimeout(callId)
    local timeout = tonumber(callsConfig().RingTimeoutMs) or 30000

    CreateThread(function()
        Wait(timeout)

        local call = Repository.GetCallById(callId)
        if not call or call.status ~= 'ringing' then
            return
        end

        local timeoutStatus = call.receiver_citizenid and 'missed' or 'unanswered'
        if timeoutStatus == 'missed' then
            Repository.MarkCallMissed(callId)
        else
            Repository.MarkCallUnanswered(callId)
        end

        call = Repository.GetCallById(callId)
        clearActive(call)
        refreshBoth(call)

        local callerSource = getOnlineSource(call.caller_citizenid)
        local receiverSource = call.receiver_citizenid and getOnlineSource(call.receiver_citizenid) or nil

        logCall('timeout', callerSource or receiverSource, ('callId=%s status=%s'):format(tostring(callId), timeoutStatus), true)

        sendCallEvent(callerSource, timeoutStatus == 'unanswered' and 'callUnanswered' or 'callMissed', {
            callId = callId,
            targetNumber = call.receiver_number,
            reason = 'timeout',
            status = timeoutStatus
        })

        sendCallEvent(receiverSource, 'callMissed', {
            callId = callId,
            fromNumber = call.caller_number,
            reason = 'timeout',
            status = timeoutStatus
        })
    end)
end

function Calls.StartCall(source, data)
    if callsEnabled() ~= true then
        sendCallUnavailable(source, 'disabled')
        return false, 'disabled'
    end

    source = Security.NormalizeSource(source)
    if not source then
        return false, 'invalid_source'
    end

    local rateLimitMs = tonumber(callsConfig().RateLimitMs) or 3000
    local now = GetGameTimer()
    if LastStartBySource[source] and now - LastStartBySource[source] < rateLimitMs then
        sendCallUnavailable(source, 'rate_limited')
        return false, 'rate_limited'
    end
    LastStartBySource[source] = now

    local caller, callerNumber, identityErr = getIdentityAndNumber(source, 'calls_start')
    if not caller then
        sendCallUnavailable(source, identityErr or 'identity_unavailable')
        return false, identityErr or 'identity_unavailable'
    end

    data = type(data) == 'table' and data or {}
    local receiverNumber = Security.NormalizePhone(data.number or data.targetNumber or '')

    logCall(
        'start',
        source,
        ('source=%s caller=%s number=%s'):format(tostring(source), Security.Mask(caller.citizenid), tostring(receiverNumber)),
        true
    )

    if receiverNumber == '' then
        sendCallUnavailable(source, 'invalid_number')
        return false, 'invalid_number'
    end

    if receiverNumber == callerNumber then
        sendCallUnavailable(source, 'self_call')
        return false, 'self_call'
    end

    if ActiveByCitizenid[caller.citizenid] then
        sendCallBusy(source, 'caller_busy')
        return false, 'caller_busy'
    end

    local receiverPhone = Repository.FindNumberOwner(receiverNumber)
    local receiverCitizenid = receiverPhone and receiverPhone.citizenid or nil
    local receiverSource = receiverCitizenid and getOnlineSource(receiverCitizenid) or nil
    local receiverOnline = receiverSource ~= nil
    local receiverBusy = receiverCitizenid and ActiveByCitizenid[receiverCitizenid] ~= nil

    logCall(
        'lookup',
        source,
        ('number=%s exists=%s online=%s busy=%s'):format(
            tostring(receiverNumber),
            tostring(receiverCitizenid ~= nil),
            tostring(receiverOnline),
            tostring(receiverBusy)
        ),
        true
    )

    if receiverCitizenid == caller.citizenid then
        sendCallUnavailable(source, 'self_call')
        return false, 'self_call'
    end

    local callId = Repository.CreateCall({
        ownerCitizenid = caller.citizenid,
        callerCitizenid = caller.citizenid,
        receiverCitizenid = receiverCitizenid,
        callerNumber = callerNumber,
        receiverNumber = receiverNumber,
        number = receiverNumber,
        direction = 'outgoing',
        status = 'ringing',
        timestamp = os.time() * 1000
    })

    local call = Repository.GetCallById(callId)
    ActiveByCallId[callId] = {
        id = callId,
        callerCitizenid = caller.citizenid,
        receiverCitizenid = receiverCitizenid,
        startedAt = os.time()
    }
    ActiveByCitizenid[caller.citizenid] = callId
    if receiverCitizenid and receiverOnline and not receiverBusy then
        ActiveByCitizenid[receiverCitizenid] = callId
    end

    logCall(
        'ringing',
        source,
        ('callId=%s simulated=true receiverOnline=%s unknownNumber=%s targetSource=%s receiver=%s'):format(
            tostring(callId),
            tostring(receiverOnline),
            tostring(receiverCitizenid == nil),
            tostring(receiverSource),
            Security.Mask(receiverCitizenid)
        ),
        true
    )

    sendCallEvent(source, 'outgoingCallStarted', {
        callId = callId,
        targetNumber = receiverNumber,
        displayName = resolveDisplayName(caller.citizenid, receiverNumber, receiverNumber),
        fallbackName = receiverNumber,
        voiceAdapter = callsConfig().VoiceAdapter or 'none'
    })

    if receiverSource and not receiverBusy then
        sendCallEvent(receiverSource, 'incomingCall', {
            callId = callId,
            fromNumber = callerNumber,
            displayName = resolveDisplayName(receiverCitizenid, callerNumber, identityFallbackName(caller) or callerNumber),
            fallbackName = identityFallbackName(caller) or callerNumber,
            voiceAdapter = callsConfig().VoiceAdapter or 'none'
        })
    end

    refreshBoth(call)
    startRingTimeout(callId)

    return true, callId
end

local function getOwnedCall(source, callId, action)
    local identity, _, identityErr = getIdentityAndNumber(source, ('calls_%s'):format(action or 'action'))
    if not identity then
        return nil, nil, identityErr or 'identity_unavailable'
    end

    callId = tonumber(callId)
    if not callId then
        return nil, identity, 'invalid_call'
    end

    local call = Repository.GetCallById(callId)
    if not call then
        return nil, identity, 'call_not_found'
    end

    if call.caller_citizenid ~= identity.citizenid and call.receiver_citizenid ~= identity.citizenid then
        return nil, identity, 'not_call_participant'
    end

    return call, identity, nil
end

function Calls.AcceptCall(source, callId)
    local call, identity, err = getOwnedCall(source, callId, 'accept')
    if not call then
        sendCallUnavailable(source, err)
        return false, err
    end

    if call.receiver_citizenid ~= identity.citizenid then
        sendCallUnavailable(source, 'not_receiver')
        return false, 'not_receiver'
    end

    if call.status ~= 'ringing' then
        sendCallUnavailable(source, 'call_not_ringing')
        return false, 'call_not_ringing'
    end

    Repository.MarkCallAnswered(call.id)
    call = Repository.GetCallById(call.id)

    local callerSource = getOnlineSource(call.caller_citizenid)
    local receiverSource = getOnlineSource(call.receiver_citizenid)

    logCall('accept', source, ('callId=%s'):format(tostring(call.id)), true)

    sendCallEvent(callerSource, 'callAccepted', {
        callId = call.id,
        targetNumber = call.receiver_number,
        displayName = resolveDisplayName(call.caller_citizenid, call.receiver_number, call.receiver_number),
        voiceAdapter = callsConfig().VoiceAdapter or 'none'
    })

    sendCallEvent(receiverSource, 'callAccepted', {
        callId = call.id,
        fromNumber = call.caller_number,
        displayName = resolveDisplayName(call.receiver_citizenid, call.caller_number, call.caller_number),
        voiceAdapter = callsConfig().VoiceAdapter or 'none'
    })

    refreshBoth(call)
    return true
end

function Calls.DeclineCall(source, callId)
    local call, identity, err = getOwnedCall(source, callId, 'decline')
    if not call then
        sendCallUnavailable(source, err)
        return false, err
    end

    if call.receiver_citizenid ~= identity.citizenid then
        sendCallUnavailable(source, 'not_receiver')
        return false, 'not_receiver'
    end

    if call.status ~= 'ringing' then
        sendCallUnavailable(source, 'call_not_ringing')
        return false, 'call_not_ringing'
    end

    Repository.MarkCallDeclined(call.id)
    call = Repository.GetCallById(call.id)
    clearActive(call)

    local callerSource = getOnlineSource(call.caller_citizenid)
    local receiverSource = getOnlineSource(call.receiver_citizenid)

    logCall('decline', source, ('callId=%s'):format(tostring(call.id)), true)

    sendCallEvent(callerSource, 'callDeclined', {
        callId = call.id,
        targetNumber = call.receiver_number
    })

    sendCallEvent(receiverSource, 'callDeclined', {
        callId = call.id,
        fromNumber = call.caller_number
    })

    refreshBoth(call)
    return true
end

function Calls.EndCall(source, callId)
    local call, _, err = getOwnedCall(source, callId, 'end')
    if not call then
        sendCallUnavailable(source, err)
        return false, err
    end

    if call.status ~= 'ringing' and call.status ~= 'accepted' then
        sendCallUnavailable(source, 'call_not_active')
        return false, 'call_not_active'
    end

    Repository.MarkCallEnded(call.id)
    call = Repository.GetCallById(call.id)
    clearActive(call)

    local callerSource = getOnlineSource(call.caller_citizenid)
    local receiverSource = getOnlineSource(call.receiver_citizenid)

    logCall('end', source, ('callId=%s'):format(tostring(call.id)), true)

    sendCallEvent(callerSource, 'callEnded', {
        callId = call.id,
        duration = call.duration or 0
    })

    sendCallEvent(receiverSource, 'callEnded', {
        callId = call.id,
        duration = call.duration or 0
    })

    refreshBoth(call)
    return true
end

function Calls.GetCallHistory(source)
    local identity = Security.RequireIdentity(source, { context = 'get_call_history' })
    if not identity then
        return
    end

    TriggerClientEvent('mz_phone:client:receiveCalls', source, Repository.GetCalls(identity.citizenid))
end

function Calls.ClearHistory(source)
    local identity = Security.RequireIdentity(source, { context = 'clear_call_history' })
    if not identity then
        return
    end

    Repository.ClearCalls(identity.citizenid)
    TriggerClientEvent('mz_phone:client:receiveCalls', source, {})
end

function Calls.DeleteHistoryItem(source, callId)
    local identity = Security.RequireIdentity(source, { context = 'delete_call_history_item' })
    if not identity then
        return
    end

    callId = tonumber(callId)
    if not callId then
        return
    end

    Repository.DeleteCall(identity.citizenid, callId)
    TriggerClientEvent('mz_phone:client:receiveCalls', source, Repository.GetCalls(identity.citizenid))
end

function Service.GetCalls(source)
    Calls.GetCallHistory(source)
end

function Service.CreateCall(source, data)
    Calls.StartCall(source, data)
end

function Service.DeleteCall(source, callId)
    Calls.DeleteHistoryItem(source, callId)
end

function Service.ClearCalls(source)
    Calls.ClearHistory(source)
end

function Service.StartCall(source, data)
    return Calls.StartCall(source, data)
end

function Service.AcceptCall(source, callId)
    return Calls.AcceptCall(source, callId)
end

function Service.DeclineCall(source, callId)
    return Calls.DeclineCall(source, callId)
end

function Service.EndCall(source, callId)
    return Calls.EndCall(source, callId)
end

function Service.GetCallHistory(source)
    return Calls.GetCallHistory(source)
end
