MZPhone = MZPhone or {}
MZPhone.Framework = {}
MZPhone.Debug = MZPhone.Debug or {}
MZPhone.Framework.PlayerData = nil
MZPhone.Framework.PlayerLoaded = false

local function resourceStarted(resourceName)
    return GetResourceState(resourceName) == 'started'
end

local function debugEnabled()
    return type(Config.Debug) == 'table' and Config.Debug.Enabled == true
end

function MZPhone.Debug.Log(action, message)
    if not debugEnabled() or Config.Debug.PrintClient == false then
        return
    end

    print(('[mz_phone][client][%s] %s'):format(tostring(action), tostring(message or '')))
end

function MZPhone.Debug.Nui(action, message)
    if not debugEnabled() or Config.Debug.NuiMessages ~= true then
        return
    end

    print(('[mz_phone][nui][%s] %s'):format(tostring(action), tostring(message or '')))
end

function MZPhone.Framework.GetPlayerData()
    local resourceName = Config.Framework.Resource
    if not resourceStarted(resourceName) then
        return nil
    end

    local ok, data = pcall(function()
        return exports[resourceName]:GetPlayerData()
    end)

    if ok then
        return data
    end

    return nil
end

function MZPhone.Framework.IsPlayerLoaded()
    if MZPhone.Framework.PlayerLoaded == true then
        return true
    end

    local data = MZPhone.Framework.GetPlayerData()
    if type(data) == 'table' and data.citizenid then
        MZPhone.Framework.PlayerData = data
        MZPhone.Framework.PlayerLoaded = true
        return true
    end

    return false
end

function MZPhone.Framework.Notify(message, notifyType, title)
    local payload = {
        type = notifyType or 'info',
        title = title or 'Celular',
        message = message or '',
        duration = 4500
    }

    local notifyResource = Config.Framework.NotifyResource
    if resourceStarted(notifyResource) then
        local ok = pcall(function()
            exports[notifyResource]:Notify(payload)
        end)

        if ok then
            return
        end
    end

    TriggerEvent('chat:addMessage', {
        args = { payload.title, payload.message }
    })
end

RegisterNetEvent('mz_core:client:playerLoaded', function(playerData)
    MZPhone.Framework.PlayerData = playerData
    MZPhone.Framework.PlayerLoaded = type(playerData) == 'table' and playerData.citizenid ~= nil
    MZPhone.Debug.Log('framework', ('mz_core playerLoaded=%s'):format(tostring(MZPhone.Framework.PlayerLoaded)))
end)

CreateThread(function()
    Wait(2500)
    local data = MZPhone.Framework.GetPlayerData()
    if type(data) == 'table' then
        MZPhone.Framework.PlayerData = data
        MZPhone.Framework.PlayerLoaded = data.citizenid ~= nil
        MZPhone.Debug.Log('framework', ('initial playerLoaded=%s'):format(tostring(MZPhone.Framework.PlayerLoaded)))
    end
end)
