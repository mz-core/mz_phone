MZPhone = MZPhone or {}
MZPhone.Notifications = {}

function MZPhone.Notifications.Push(data)
    if MZPhone.Debug and MZPhone.Debug.Log then
        MZPhone.Debug.Log('notification', ('type=%s title=%s'):format(tostring(data and data.type), tostring(data and data.title)))
    end

    SendNUIMessage({
        action = 'notify',
        data = data or {}
    })
end

RegisterNetEvent('mz_phone:client:notify', function(data)
    MZPhone.Notifications.Push(data or {})
end)
