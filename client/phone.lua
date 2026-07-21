MZPhone = MZPhone or {}

local phoneOpen = false
local openRetryAttempts = 0
local retryInProgress = false

local function setKeepInput(state)
    if type(SetNuiFocusKeepInput) == 'function' then
        SetNuiFocusKeepInput(state == true)
    end
end

function MZPhone.IsOpen()
    return phoneOpen == true
end

function MZPhone.AcquireFocus(reason)
    MZPhone.Debug.Log('focus', ('acquire reason=%s'):format(tostring(reason or 'unknown')))
    SetNuiFocus(true, true)
    setKeepInput(false)
end

function MZPhone.ReleaseFocus(reason)
    MZPhone.Debug.Log('focus', ('release reason=%s'):format(tostring(reason or 'unknown')))
    SetNuiFocus(false, false)
    setKeepInput(false)
end

function MZPhone.SetOpen(state, data)
    local wasOpen = phoneOpen == true
    phoneOpen = state == true

    if phoneOpen then
        if PhoneAnimation and PhoneAnimation.Open then
            PhoneAnimation.Open()
        end
        MZPhone.Debug.Log('phone', 'open')
    else
        if PhoneAnimation and PhoneAnimation.Close then
            PhoneAnimation.Close()
        end
        MZPhone.Debug.Log('phone', 'close')
    end

    if phoneOpen then
        MZPhone.AcquireFocus('open_phone')
    else
        MZPhone.ReleaseFocus('close_phone')
    end

    SendNUIMessage({
        action = phoneOpen and 'open' or 'close'
    })

    if phoneOpen and data then
        SendNUIMessage({
            action = 'loadData',
            data = data or {}
        })
    end

    if wasOpen and not phoneOpen then
        TriggerServerEvent('mz_phone:server:bankClose')
    end
end

function MZPhone.RequestOpen()
    if phoneOpen then
        MZPhone.SetOpen(false)
        return
    end

    MZPhone.Debug.Log('phone', ('requestOpen clientPlayerLoaded=%s'):format(tostring(MZPhone.Framework.IsPlayerLoaded())))
    TriggerServerEvent('mz_phone:server:requestOpen')
end

RegisterNetEvent('mz_phone:client:openAllowed', function(data)
    openRetryAttempts = 0
    retryInProgress = false
    MZPhone.Debug.Log('phone', 'openAllowed')
    MZPhone.SetOpen(true, data)
end)

RegisterNetEvent('mz_phone:client:openDenied', function(reason)
    MZPhone.Debug.Log('phone', ('openDenied reason=%s'):format(tostring(reason)))

    local message = 'Nao foi possivel abrir o celular.'

    if reason == 'missing_phone' then
        message = 'Voce precisa de um celular.'
    elseif reason == 'identity_unavailable' then
        message = 'Nao foi possivel identificar seu personagem.'
    elseif reason == 'player_not_loaded' then
        message = 'Seu personagem ainda nao carregou.'
    elseif reason == 'inventory_unavailable' then
        message = 'Inventario indisponivel no momento.'
    end

    MZPhone.Framework.Notify(message, 'error')

    if reason == 'player_not_loaded'
        and Config.Phone.RetryOpenWhenLoading == true
        and retryInProgress ~= true
        and openRetryAttempts < (tonumber(Config.Phone.RetryOpenMaxAttempts) or 0) then
        openRetryAttempts = openRetryAttempts + 1
        retryInProgress = true

        local delay = tonumber(Config.Phone.RetryOpenDelayMs) or 2000
        MZPhone.Debug.Log('phone', ('retry scheduled attempt=%s delay=%s'):format(tostring(openRetryAttempts), tostring(delay)))

        SetTimeout(delay, function()
            retryInProgress = false
            if not phoneOpen then
                MZPhone.RequestOpen()
            end
        end)
    end
end)

RegisterNetEvent('mz_phone:client:loaded', function(data)
    MZPhone.Debug.Log('phone', 'loaded data received')
    SendNUIMessage({
        action = 'loadData',
        data = data or {}
    })
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then
        return
    end

    if PhoneAnimation and PhoneAnimation.Cleanup then
        PhoneAnimation.Cleanup()
    end

    MZPhone.ReleaseFocus('resource_stop')
end)
