MZPhone = MZPhone or {}
MZPhone.Camera = MZPhone.Camera or {}

local pendingRequests = {}
local lastCaptureAt = 0
local cameraMode = false
local isCapturing = false
local previousPhoneOpen = false
local restoreApp = 'camera'
local cameraCam = nil
local cameraFov = nil
local previousPedCamViewMode = nil
local previousVehicleCamViewMode = nil
local forcedFirstPerson = false
local playerHiddenForCapture = false

local function cameraConfig()
    return Config.Phone and Config.Phone.Camera or {}
end

local function firstPersonConfig()
    local cfg = cameraConfig()
    return type(cfg.FirstPerson) == 'table' and cfg.FirstPerson or {}
end

local function uploadConfig()
    local cfg = cameraConfig()
    local upload = type(cfg.Upload) == 'table' and cfg.Upload or {}
    local newUploadUrl = type(upload.UploadUrl) == 'string' and upload.UploadUrl or ''
    local legacyUploadUrl = type(cfg.UploadUrl) == 'string' and cfg.UploadUrl or ''
    local usesLegacyUploadUrl = newUploadUrl == '' and legacyUploadUrl ~= ''
    local fieldName = usesLegacyUploadUrl and cfg.FieldName or upload.FieldName

    return {
        adapter = tostring(upload.Adapter or 'legacy'),
        uploadUrl = usesLegacyUploadUrl and legacyUploadUrl or newUploadUrl,
        fieldName = tostring(fieldName or cfg.FieldName or 'file')
    }
end

local function cameraLog(message)
    if MZPhone.Debug and MZPhone.Debug.Log then
        MZPhone.Debug.Log('camera', message)
    end
end

local function cameraNotify(message, notifyType)
    if MZPhone.Framework and MZPhone.Framework.Notify then
        MZPhone.Framework.Notify(message, notifyType or 'primary', 'Camera')
    end
end

local function releasePhoneFocus(reason)
    if MZPhone.ReleaseFocus then
        MZPhone.ReleaseFocus(reason)
    else
        SetNuiFocus(false, false)
        if type(SetNuiFocusKeepInput) == 'function' then
            SetNuiFocusKeepInput(false)
        end
    end
end

local function sendCameraHud(visible, data)
    SendNUIMessage({
        action = 'cameraHud',
        visible = visible == true,
        data = data or {}
    })
end

local function sendCameraStatus(data)
    SendNUIMessage({
        action = 'cameraStatus',
        data = data or {}
    })
end

local function reopenPhone(appId)
    if previousPhoneOpen ~= true then
        return
    end

    MZPhone.SetOpen(true)

    SetTimeout(150, function()
        SendNUIMessage({
            action = 'openApp',
            app = appId or restoreApp or 'camera'
        })
    end)
end

local function forceFirstPersonCamera()
    local fp = firstPersonConfig()
    if fp.Enabled ~= true or fp.ForceOnOpen ~= true then
        return
    end

    local okPed, pedMode = pcall(GetFollowPedCamViewMode)
    if okPed then
        previousPedCamViewMode = pedMode
    end

    if type(GetFollowVehicleCamViewMode) == 'function' then
        local okVehicle, vehicleMode = pcall(GetFollowVehicleCamViewMode)
        if okVehicle then
            previousVehicleCamViewMode = vehicleMode
        end
    end

    local ped = PlayerPedId()
    if IsPedInAnyVehicle(ped, false) and type(SetFollowVehicleCamViewMode) == 'function' then
        SetFollowVehicleCamViewMode(4)
    else
        SetFollowPedCamViewMode(4)
    end

    forcedFirstPerson = true
end

local function restoreCameraView()
    local fp = firstPersonConfig()

    if forcedFirstPerson and fp.RestorePreviousView ~= false then
        if previousPedCamViewMode ~= nil then
            SetFollowPedCamViewMode(previousPedCamViewMode)
        end

        if previousVehicleCamViewMode ~= nil and type(SetFollowVehicleCamViewMode) == 'function' then
            SetFollowVehicleCamViewMode(previousVehicleCamViewMode)
        end
    end

    forcedFirstPerson = false
    previousPedCamViewMode = nil
    previousVehicleCamViewMode = nil
end

local function hidePlayerForCapture()
    local fp = firstPersonConfig()
    if fp.HidePlayerBeforeCapture ~= true then
        return 0
    end

    SetEntityVisible(PlayerPedId(), false, false)
    playerHiddenForCapture = true

    return tonumber(fp.HidePlayerDelayMs) or 120
end

local function restorePlayerVisibility()
    if not playerHiddenForCapture then
        return
    end

    SetEntityVisible(PlayerPedId(), true, false)
    playerHiddenForCapture = false
end

local function finishRequest(requestId, payload)
    local pending = pendingRequests[requestId]
    if not pending then
        return
    end

    pendingRequests[requestId] = nil
    payload = payload or { ok = false, error = 'unknown' }
    restorePlayerVisibility()

    if pending.cb then
        pending.cb(payload)
    end

    if pending.mode == 'camera' then
        if payload.ok == true then
            sendCameraStatus({ ok = true, photo = payload.photo })
            cameraNotify('Foto salva na galeria.', 'success')
            MZPhone.Camera.StopCameraMode('saved', {
                restorePhone = true,
                openApp = 'gallery'
            })
        else
            isCapturing = false
            sendCameraHud(true, {
                status = 'error',
                error = payload.error or 'save_failed'
            })
            sendCameraStatus({
                ok = false,
                error = payload.error or 'save_failed'
            })
        end
    end
end

local function firstUrlFromList(items)
    if type(items) ~= 'table' then
        return nil
    end

    for _, item in ipairs(items) do
        if type(item) == 'table' then
            if type(item.url) == 'string' and item.url ~= '' then
                return item.url
            end

            if type(item.proxy_url) == 'string' and item.proxy_url ~= '' then
                return item.proxy_url
            end
        end
    end

    local zeroItem = items[0]
    if type(zeroItem) == 'table' then
        if type(zeroItem.url) == 'string' and zeroItem.url ~= '' then
            return zeroItem.url
        end

        if type(zeroItem.proxy_url) == 'string' and zeroItem.proxy_url ~= '' then
            return zeroItem.proxy_url
        end
    end

    return nil
end

local function uploadMetadata(decoded, fallbackAdapter)
    decoded = type(decoded) == 'table' and decoded or {}

    return {
        uploadAdapter = tostring(decoded.adapter or fallbackAdapter or 'legacy'),
        localUrl = type(decoded.localUrl) == 'string' and decoded.localUrl or '',
        discordUrl = type(decoded.discordUrl) == 'string' and decoded.discordUrl or '',
        discordMessageId = type(decoded.discordMessageId) == 'string' and decoded.discordMessageId or '',
        discordChannelId = type(decoded.discordChannelId) == 'string' and decoded.discordChannelId or '',
        uploadWarning = type(decoded.warning) == 'string' and decoded.warning or ''
    }
end

local function decodeScreenshotResponse(response, fallbackAdapter)
    if type(response) ~= 'string' or response == '' then
        return nil, 'empty_upload_response'
    end

    local ok, decoded = pcall(json.decode, response)
    if not ok or type(decoded) ~= 'table' then
        return nil, 'invalid_upload_response'
    end

    local meta = uploadMetadata(decoded, fallbackAdapter)

    if type(decoded.url) == 'string' and decoded.url ~= '' then
        return decoded.url, nil, meta
    end

    if type(decoded.localUrl) == 'string' and decoded.localUrl ~= '' then
        return decoded.localUrl, nil, meta
    end

    if type(decoded.discordUrl) == 'string' and decoded.discordUrl ~= '' then
        return decoded.discordUrl, nil, meta
    end

    if type(decoded.image_url) == 'string' and decoded.image_url ~= '' then
        return decoded.image_url, nil, meta
    end

    if type(decoded.imageUrl) == 'string' and decoded.imageUrl ~= '' then
        return decoded.imageUrl, nil, meta
    end

    if type(decoded.data) == 'table' then
        local nestedMeta = uploadMetadata(decoded.data, decoded.adapter or fallbackAdapter)

        if type(decoded.data.url) == 'string' and decoded.data.url ~= '' then
            return decoded.data.url, nil, nestedMeta
        end

        if type(decoded.data.localUrl) == 'string' and decoded.data.localUrl ~= '' then
            return decoded.data.localUrl, nil, nestedMeta
        end

        if type(decoded.data.discordUrl) == 'string' and decoded.data.discordUrl ~= '' then
            return decoded.data.discordUrl, nil, nestedMeta
        end

        if type(decoded.data.image_url) == 'string' and decoded.data.image_url ~= '' then
            return decoded.data.image_url, nil, nestedMeta
        end
    end

    local attachmentUrl = firstUrlFromList(decoded.attachments)
    if attachmentUrl then
        return attachmentUrl, nil, meta
    end

    local fileUrl = firstUrlFromList(decoded.files)
    if fileUrl then
        return fileUrl, nil, meta
    end

    return nil, 'upload_url_not_found'
end

local function cameraMetadata(data)
    data = type(data) == 'table' and data or {}
    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    local cfg = cameraConfig()
    local upload = uploadConfig()
    local gameplayCoords = GetGameplayCamCoord()
    local gameplayRot = GetGameplayCamRot(2)

    return {
        adapter = tostring(cfg.Adapter or 'none'),
        encoding = tostring(cfg.Encoding or 'jpg'),
        mode = tostring(cfg.Mode or 'gameplay'),
        source = 'camera',
        uploadAdapter = tostring((data.upload or {}).uploadAdapter or upload.adapter),
        width = tonumber(data.width),
        height = tonumber(data.height),
        coords = {
            x = coords.x,
            y = coords.y,
            z = coords.z
        },
        camera = {
            x = gameplayCoords.x,
            y = gameplayCoords.y,
            z = gameplayCoords.z,
            pitch = gameplayRot.x,
            roll = gameplayRot.y,
            yaw = gameplayRot.z,
            fov = cameraFov or GetGameplayCamFov()
        }
    }
end

local function mergeUploadMetadata(metadata, uploadMeta)
    metadata = type(metadata) == 'table' and metadata or {}
    uploadMeta = type(uploadMeta) == 'table' and uploadMeta or {}

    metadata.uploadAdapter = uploadMeta.uploadAdapter or metadata.uploadAdapter
    metadata.localUrl = uploadMeta.localUrl or metadata.localUrl
    metadata.discordUrl = uploadMeta.discordUrl or metadata.discordUrl
    metadata.discordMessageId = uploadMeta.discordMessageId or metadata.discordMessageId
    metadata.discordChannelId = uploadMeta.discordChannelId or metadata.discordChannelId

    if uploadMeta.uploadWarning and uploadMeta.uploadWarning ~= '' then
        metadata.warning = uploadMeta.uploadWarning
    end

    return metadata
end

function MZPhone.Camera.CreatePhoneCamera()
    local cfg = cameraConfig()
    local mode = tostring(cfg.Mode or 'gameplay')

    if mode ~= 'scripted' then
        cameraFov = GetGameplayCamFov()
        return false
    end

    local ped = PlayerPedId()
    local coords = GetGameplayCamCoord()
    local rot = GetGameplayCamRot(2)

    cameraFov = GetGameplayCamFov()
    cameraCam = CreateCam('DEFAULT_SCRIPTED_CAMERA', true)
    SetCamCoord(cameraCam, coords.x, coords.y, coords.z)
    SetCamRot(cameraCam, rot.x, rot.y, rot.z, 2)
    SetCamFov(cameraCam, cameraFov)
    RenderScriptCams(true, false, 0, true, true)
    FreezeEntityPosition(ped, true)

    return true
end

function MZPhone.Camera.DestroyPhoneCamera()
    if cameraCam then
        RenderScriptCams(false, false, 0, true, true)
        DestroyCam(cameraCam, false)
        cameraCam = nil
    end
end

local function updateCameraZoom(direction)
    local cfg = cameraConfig()
    local zoom = type(cfg.Zoom) == 'table' and cfg.Zoom or {}
    if zoom.Enabled ~= true then
        return
    end

    local currentFov = cameraFov or GetGameplayCamFov()
    local step = tonumber(zoom.Step) or 2.0
    local minFov = tonumber(zoom.MinFov) or 30.0
    local maxFov = tonumber(zoom.MaxFov) or 70.0
    local nextFov = math.max(minFov, math.min(maxFov, currentFov + (direction * step)))

    cameraFov = nextFov

    if cameraCam then
        SetCamFov(cameraCam, nextFov)
    else
        SetGameplayCamRelativePitch(GetGameplayCamRelativePitch(), 1.0)
    end
end

local function canCapture(cb)
    local cfg = cameraConfig()
    local upload = uploadConfig()

    if cfg.Enabled == false then
        cb({ ok = false, error = 'camera_disabled' })
        return false
    end

    local now = GetGameTimer()
    local cooldown = tonumber(cfg.CooldownMs) or 5000
    if cooldown > 0 and lastCaptureAt > 0 and now - lastCaptureAt < cooldown then
        cb({ ok = false, error = 'cooldown', remainingMs = cooldown - (now - lastCaptureAt) })
        return false
    end

    local adapter = tostring(cfg.Adapter or 'none')
    if adapter ~= 'screenshot-basic' then
        cb({ ok = false, error = 'camera_adapter_unavailable' })
        return false
    end

    if GetResourceState('screenshot-basic') ~= 'started' then
        cb({ ok = false, error = 'screenshot_basic_not_started' })
        return false
    end

    if tostring(cfg.SaveMode or 'url') ~= 'url' then
        cb({ ok = false, error = 'camera_save_mode_unsupported' })
        return false
    end

    if upload.uploadUrl == '' then
        cb({ ok = false, error = 'camera_upload_not_configured' })
        return false
    end

    return true
end

function MZPhone.Camera.CapturePhoto(data, cb)
    cb = type(cb) == 'function' and cb or function() end
    data = type(data) == 'table' and data or {}

    if cameraMode ~= true then
        cb({ ok = false, error = 'camera_mode_inactive' })
        return
    end

    if isCapturing then
        cb({ ok = false, error = 'camera_busy' })
        return
    end

    local captureError = nil
    if not canCapture(function(payload)
        captureError = payload or { ok = false, error = 'save_failed' }
        cb(captureError)
    end) then
        sendCameraHud(true, {
            status = 'error',
            error = captureError and captureError.error or 'save_failed'
        })
        sendCameraStatus(captureError or { ok = false, error = 'save_failed' })
        return
    end

    local cfg = cameraConfig()
    local upload = uploadConfig()
    local uploadUrl = upload.uploadUrl
    local requestId = ('%s:%s'):format(GetGameTimer(), math.random(100000, 999999))

    isCapturing = true
    lastCaptureAt = GetGameTimer()
    sendCameraHud(true, { status = 'capturing' })
    pendingRequests[requestId] = {
        cb = cb,
        mode = 'camera',
        data = data
    }

    SetTimeout(30000, function()
        finishRequest(requestId, { ok = false, error = 'camera_timeout' })
    end)

    cameraLog(('capture request=%s adapter=%s'):format(requestId, tostring(cfg.Adapter or 'none')))

    CreateThread(function()
        if cfg.HideHudBeforeCapture ~= false then
            sendCameraHud(false)
        end

        local delay = tonumber(cfg.CaptureDelayMs) or 250
        if delay > 0 then
            Wait(delay)
        end

        releasePhoneFocus('camera_capture')

        local hideDelay = hidePlayerForCapture()
        if hideDelay > 0 then
            Wait(hideDelay)
        end

        local exportOk, exportErr = pcall(function()
            exports['screenshot-basic']:requestScreenshotUpload(
                uploadUrl,
                upload.fieldName,
                {
                    encoding = tostring(cfg.Encoding or 'jpg'),
                    quality = tonumber(cfg.Quality) or 0.85
                },
                function(response)
                    restorePlayerVisibility()

                    local imageUrl, uploadErr, uploadMeta = decodeScreenshotResponse(response, upload.adapter)
                    if not imageUrl then
                        finishRequest(requestId, { ok = false, error = uploadErr or 'upload_failed' })
                        return
                    end

                    TriggerServerEvent('mz_phone:server:saveCameraPhoto', requestId, imageUrl, mergeUploadMetadata(cameraMetadata(data), uploadMeta))
                end
            )
        end)

        if not exportOk then
            restorePlayerVisibility()
            cameraLog(('screenshot-basic failed request=%s error=%s'):format(requestId, tostring(exportErr)))
            finishRequest(requestId, { ok = false, error = 'screenshot_basic_failed' })
        end
    end)
end

function MZPhone.Camera.RestorePhoneAfterCamera(appId)
    reopenPhone(appId)
end

function MZPhone.Camera.StopCameraMode(reason, options)
    options = type(options) == 'table' and options or {}
    local wasActive = cameraMode == true

    cameraMode = false
    isCapturing = false

    sendCameraHud(false)
    restorePlayerVisibility()
    MZPhone.Camera.DestroyPhoneCamera()
    restoreCameraView()
    FreezeEntityPosition(PlayerPedId(), false)
    releasePhoneFocus(reason or 'camera_stop')

    if wasActive and reason ~= 'saved' and reason ~= 'resource_stop' then
        sendCameraStatus({ ok = false, error = reason or 'camera_cancelled' })
    end

    if options.restorePhone ~= false and reason ~= 'resource_stop' then
        reopenPhone(options.openApp or restoreApp)
    end
end

function MZPhone.Camera.HandleCameraControls()
    CreateThread(function()
        while cameraMode do
            DisableControlAction(0, 24, true)
            DisableControlAction(0, 25, true)
            DisableControlAction(0, 37, true)
            DisableControlAction(0, 44, true)
            DisableControlAction(0, 140, true)
            DisableControlAction(0, 141, true)
            DisableControlAction(0, 142, true)
            DisableControlAction(0, 199, true)
            DisableControlAction(0, 200, true)

            if not isCapturing then
                if IsDisabledControlJustPressed(0, 24) or IsControlJustPressed(0, 191) then
                    MZPhone.Camera.CapturePhoto({}, function() end)
                elseif IsDisabledControlJustPressed(0, 199)
                    or IsDisabledControlJustPressed(0, 200)
                    or IsControlJustPressed(0, 177)
                    or IsControlJustPressed(0, 322) then
                    MZPhone.Camera.StopCameraMode('camera_cancelled', { restorePhone = true })
                elseif IsControlJustPressed(0, 241) then
                    updateCameraZoom(-1)
                elseif IsControlJustPressed(0, 242) then
                    updateCameraZoom(1)
                end
            end

            Wait(0)
        end
    end)
end

function MZPhone.Camera.StartCameraMode(data, cb)
    cb = type(cb) == 'function' and cb or function() end
    data = type(data) == 'table' and data or {}
    local cfg = cameraConfig()

    if cfg.Enabled == false then
        cb({ ok = false, error = 'camera_disabled' })
        return
    end

    if cameraMode == true then
        cb({ ok = true, active = true })
        return
    end

    previousPhoneOpen = MZPhone.IsOpen and MZPhone.IsOpen() == true or false
    restoreApp = tostring(data.restoreApp or 'camera')

    if cfg.HidePhoneWhileActive ~= false and previousPhoneOpen then
        MZPhone.SetOpen(false)
    end

    releasePhoneFocus('camera_start')
    forceFirstPersonCamera()
    MZPhone.Camera.CreatePhoneCamera()

    cameraMode = true
    isCapturing = false

    sendCameraHud(true, {
        status = 'ready',
        mode = tostring(cfg.Mode or 'gameplay'),
        zoom = cfg.Zoom or {}
    })

    MZPhone.Camera.HandleCameraControls()
    cb({ ok = true, mode = tostring(cfg.Mode or 'gameplay') })
end

function MZPhone.Camera.TakePhoto(data, cb)
    MZPhone.Camera.StartCameraMode(data, cb)
end

RegisterNetEvent('mz_phone:client:cameraPhotoSaved', function(payload)
    payload = type(payload) == 'table' and payload or {}
    local requestId = tostring(payload.requestId or '')
    finishRequest(requestId, payload)
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then
        return
    end

    if cameraMode then
        MZPhone.Camera.StopCameraMode('resource_stop', { restorePhone = false })
    end
end)
