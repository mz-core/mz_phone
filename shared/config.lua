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
        OpenDirectly = true,
        HidePhoneWhileActive = true,
        HideHudBeforeCapture = true,
        CaptureDelayMs = 250,
        AllowSelfie = true,
        MaxDistance = 2.0,
        Zoom = {
            Enabled = true,
            MinFov = 30.0,
            MaxFov = 70.0,
            Step = 2.5,
            DefaultFov = 55.0
        },
        SwitchCamera = {
            Enabled = true,
            Key = 38,
            AllowSelfie = true
        },
        BackCamera = {
            Enabled = true,
            Offset = {
                x = 0.0,
                y = 0.55,
                z = 0.72
            },
            LookOffset = {
                x = 0.0,
                y = 5.0,
                z = 0.74
            },
            RotationOffset = {
                pitch = 0.0,
                roll = 0.0,
                yaw = 0.0
            },
            HidePlayerWhileActive = false,
            HidePlayerOnlyForCapture = true,
            UseLocalInvisible = true,
            HidePropBeforeCapture = true
        },
        SelfieCamera = {
            Enabled = true,
            UsePhonePropAsLens = true,
            PhoneLensOffset = {
                x = 0.0,
                y = 0.04,
                z = 0.03
            },
            FallbackHandOffset = {
                x = 0.10,
                y = 0.18,
                z = 0.04
            },
            LookAt = {
                Bone = 31086,
                Offset = { x = 0.0, y = 0.0, z = -0.10 }
            },
            DistanceFallback = 0.85,
            HeightFallback = 0.68,
            HidePropInSelfieCapture = false,
            Distance = 1.15,
            Height = 0.72,
            SideOffset = 0.0,
            LookAtHeight = 0.62,
            Fov = 55.0,
            MinFov = 35.0,
            MaxFov = 75.0,
            ShowPlayer = true,
            Orbit = {
                Enabled = true,
                MaxYaw = 35.0,
                MaxPitch = 18.0,
                Sensitivity = 2.0
            }
        },
        HoldAnimation = {
            Enabled = true,
            Model = 'prop_amb_phone',
            Prop = 'prop_amb_phone',
            PropModels = {
                'prop_amb_phone',
                'prop_npc_phone_02',
                'prop_phone_ing'
            },
            Bone = 28422,
            Dict = 'cellphone@',
            DictInVehicle = 'anim@cellphone@in_car@ps',
            EnterAnim = 'cellphone_text_in',
            IdleAnim = 'cellphone_text_read_base',
            Anim = 'cellphone_text_read_base',
            ExitAnim = 'cellphone_text_out',
            CallAnim = 'cellphone_text_to_call',
            CallToTextAnim = 'cellphone_call_to_text',
            ExitCallAnim = 'cellphone_call_out',
            ExitVehicleAnim = 'cellphone_horizontal_exit',
            Offset = { x = 0.0, y = 0.0, z = 0.0 },
            Rotation = { x = 0.0, y = 0.0, z = 0.0 },
            HidePropBeforeCapture = true,
            HidePropInBackMode = true,
            ShowPropInSelfieMode = true,
            DisableWeapon = true,
            CleanupOnStop = true,
            ActiveProfile = 'text',
            SelfieProfile = 'text',
            DebugCommand = true,
            DebugTestDurationMs = 10000,
            Profiles = {
                text = {
                    Dict = 'cellphone@',
                    Anim = 'cellphone_text_read_base',
                    Flag = 49
                },
                call = {
                    Dict = 'cellphone@',
                    Anim = 'cellphone_call_listen_base',
                    Flag = 49
                },
                selfie = {
                    Dict = 'cellphone@self@franklin@',
                    Anim = 'peace',
                    Flag = 49,
                    FallbackProfile = 'text'
                }
            },
            Back = {
                Visible = false,
                Offset = { x = 0.0, y = 0.0, z = 0.0 },
                Rotation = { x = 0.0, y = 0.0, z = 0.0 }
            },
            Selfie = {
                Visible = true,
                Offset = { x = 0.0, y = 0.0, z = 0.0 },
                Rotation = { x = 0.0, y = 0.0, z = 0.0 }
            }
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
            Mode = 'auto', -- auto, disabled, vps, discord_direct, discord_proxy, vps_discord
            FieldName = 'file',
            Auto = {
                Prefer = 'vps', -- vps ou discord_direct
                AllowDiscordDirectFallback = true
            },
            VPS = {
                Url = '',
                Token = ''
            },
            DiscordDirect = {
                WebhookUrl = ''
            },
            DiscordProxy = {
                Url = '',
                Token = ''
            },
            VPSDiscord = {
                Url = '',
                Token = ''
            }
        },
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
