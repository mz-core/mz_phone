Config = Config or {}

Config.Debug = {
    Enabled = false,
    PrintServer = true,
    PrintClient = true,
    NuiMessages = false,
    AllowCommand = true,
    AdminPermission = 'mz_phone.debug'
}

Config.Phone = {
    Command = 'celular',
    Keybind = 'M',
    RequireItem = false,
    ItemName = 'cellphone',
    NumberPrefix = '555',
    NumberDigits = 6,
    NumberRetries = 10,
    SyncGeneratedNumberToCore = true,
    RetryOpenWhenLoading = true,
    RetryOpenDelayMs = 2000,
    RetryOpenMaxAttempts = 3,
    Calls = {
        Enabled = true,
        VoiceAdapter = 'none',
        RingTimeoutMs = 30000,
        RateLimitMs = 3000,
        MaxHistory = 50
    }
}

Config.Framework = {
    Resource = 'mz_core',
    NotifyResource = 'mz_notify',
    PlayerLoadWaitMs = 8000,
    PlayerLoadStepMs = 250
}

Config.Inventory = {
    Adapter = 'mz_core'
}

Config.Security = {
    TextMaxLength = 500,
    NameMaxLength = 80,
    PhoneMaxLength = 32,
    RateLimits = {
        load = { limit = 12, window = 30 },
        save = { limit = 10, window = 30 },
        contact = { limit = 20, window = 30 },
        message = { limit = 8, window = 10 },
        conversation = { limit = 15, window = 30 },
        notification = { limit = 10, window = 10 },
        calls = { limit = 8, window = 30 }
    }
}
