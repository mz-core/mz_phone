math.randomseed(os.time())

exports('CreateBankTransferNotifications', function(request)
    local callerResource = GetInvokingResource()
    return MZPhoneServer.Service.CreateBankTransferNotifications(request, callerResource)
end)

AddEventHandler('onResourceStart', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then
        return
    end

    MZPhoneServer.Repository.Prepare()
    print('^2[mz_phone]^7 tabelas verificadas e resource iniciado.')
end)
