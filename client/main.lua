RegisterCommand(Config.Phone.Command, function()
    MZPhone.RequestOpen()
end, false)

RegisterCommand('mzphone_debug', function()
    if Config.Debug.AllowCommand ~= true then
        MZPhone.Framework.Notify('Debug do celular desativado na config.', 'error')
        return
    end

    MZPhone.Debug.Log('command', 'mzphone_debug requested')
    TriggerServerEvent('mz_phone:server:debugReport')
end, false)

RegisterCommand('+mz_phone_toggle', function()
    MZPhone.RequestOpen()
end, false)

RegisterCommand('-mz_phone_toggle', function()
end, false)

RegisterKeyMapping('+mz_phone_toggle', 'Abrir celular', 'keyboard', Config.Phone.Keybind)

RegisterNetEvent('mz_phone:client:debugReport', function(report, deniedReason)
    if not report then
        local message = deniedReason == 'not_allowed'
            and 'Debug bloqueado. Ative Config.Debug.Enabled ou use permissao administrativa.'
            or 'Debug indisponivel.'

        print(('[mz_phone][debug] denied reason=%s'):format(tostring(deniedReason)))
        MZPhone.Framework.Notify(message, 'error')
        return
    end

    local lines = {
        '===== mz_phone debug =====',
        ('resource=%s started=%s'):format(tostring(report.resource), tostring(report.phoneStarted)),
        ('mz_core=%s mz_notify=%s'):format(tostring(report.coreState), tostring(report.notifyState)),
        ('identityResolved=%s identitySource=%s'):format(tostring(report.identityResolved), tostring(report.identitySource)),
        ('identityError=%s'):format(tostring(report.identityError or '')),
        ('citizenid=%s playerLoaded=%s'):format(tostring(report.citizenid or report.characterId), tostring(report.playerLoaded)),
        ('phoneFromMzPlayers=%s'):format(tostring(report.phoneFromMzPlayers)),
        ('coreLoadedRaw=%s getPlayer=%s fields=%s'):format(tostring(report.coreIsLoadedRaw), tostring(report.coreGetPlayerType), tostring(report.coreGetPlayerFields)),
        ('playerSummary=%s'):format(tostring(report.coreGetPlayerSummary)),
        ('getSession=%s fields=%s'):format(tostring(report.coreGetSessionType), tostring(report.coreGetSessionFields)),
        ('sessionSummary=%s'):format(tostring(report.coreGetSessionSummary)),
        ('loadedEvent=%s waitResult=%s waitedMs=%s'):format(tostring(report.loadedEvent), tostring(report.waitResult), tostring(report.waitForPlayerMs)),
        ('ensureTried=%s ensureResult=%s'):format(tostring(report.ensureTried), tostring(report.ensureResult)),
        ('item=%s hasPhone=%s reason=%s'):format(tostring(report.itemName), tostring(report.hasPhone), tostring(report.itemReason)),
        ('phoneNumber=%s status=%s'):format(tostring(report.phoneNumber ~= '' and report.phoneNumber or 'not_created'), tostring(report.phoneNumberStatus)),
        ('contacts=%s conversations=%s settings=%s'):format(tostring(report.contacts), tostring(report.conversations), tostring(report.settings)),
        '=========================='
    }

    for _, line in ipairs(lines) do
        print(line)
    end

    MZPhone.Framework.Notify('Relatorio mz_phone enviado ao F8.', 'info')
end)
