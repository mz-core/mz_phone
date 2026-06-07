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
    },
    Gallery = {
        Enabled = true,
        MaxPhotos = 200,
        PageSize = 40,
        AllowManualUrlAdd = false,
        AllowedImageSchemes = {
            http = true,
            https = true
        },
        AllowedLocalPrefixes = {
            'gallery/'
        }
    },
    Camera = {
        Enabled = true,
        Mode = 'gameplay',
        HidePhoneWhileActive = true,
        HideHudBeforeCapture = true,
        CaptureDelayMs = 250,
        AllowSelfie = true,
        MaxDistance = 2.0,
        Zoom = {
            Enabled = true,
            MinFov = 30.0,
            MaxFov = 70.0,
            Step = 2.0
        },
        FirstPerson = {
            Enabled = true,
            ForceOnOpen = true,
            RestorePreviousView = true,
            HidePlayerBeforeCapture = false,
            HidePlayerDelayMs = 120
        },
        Adapter = 'screenshot-basic',
        SaveMode = 'url',
        Upload = {
            Adapter = 'local',
            UploadUrl = '',
            FieldName = 'file',
            Local = {
                Enabled = true,
                PublicBaseUrl = '',
                MaxFileSizeMb = 5
            },
            Discord = {
                Enabled = false,
                WebhookUrl = '',
                UseAsPrimary = false
            }
        },
        UploadUrl = '',
        FieldName = 'file',
        Quality = 0.85,
        Encoding = 'jpg',
        CooldownMs = 5000,
        MaxPhotosPerUser = 200
    },
    Audio = {
        Enabled = true,
        DefaultRingtone = 'ringtone',
        RingtoneVolume = 0.45
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
        calls = { limit = 8, window = 30 },
        gallery = { limit = 20, window = 30 }
    }
}
