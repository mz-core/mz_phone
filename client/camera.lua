MZPhone = MZPhone or {}
MZPhone.Camera = MZPhone.Camera or {}

local pendingRequests = {}
local lastCaptureAt = 0
local cameraMode = false
local isCapturing = false
local previousPhoneOpen = false
local restoreApp = 'camera'
local cameraResultMode = false
local cameraResultReturnApp = 'home'
local cameraCam = nil
local cameraFov = nil
local previousGameplayFov = nil
local previousPedCamViewMode = nil
local previousVehicleCamViewMode = nil
local forcedFirstPerson = false
local playerHiddenForCapture = false
local playerHiddenForCamera = false
local cameraFacing = 'back'
local cameraHoldProp = nil
local cameraHoldHidden = false
local cameraHoldAnim = {
    dict = nil,
    anim = nil
}
local cameraRotX = 0.0
local cameraRotZ = 0.0
local selfieOrbitYaw = 0.0
local selfieOrbitPitch = 0.0

local function cameraConfig()
    return Config.Phone and Config.Phone.Camera or {}
end

local function firstPersonConfig()
    local cfg = cameraConfig()
    return type(cfg.FirstPerson) == 'table' and cfg.FirstPerson or {}
end

local function zoomConfig()
    local cfg = cameraConfig()
    return type(cfg.Zoom) == 'table' and cfg.Zoom or {}
end

local function switchCameraConfig()
    local cfg = cameraConfig()
    return type(cfg.SwitchCamera) == 'table' and cfg.SwitchCamera or {}
end

local function backCameraConfig()
    local cfg = cameraConfig()
    return type(cfg.BackCamera) == 'table' and cfg.BackCamera or {}
end

local function selfieCameraConfig()
    local cfg = cameraConfig()
    return type(cfg.SelfieCamera) == 'table' and cfg.SelfieCamera or {}
end

local function holdAnimationConfig()
    local cfg = cameraConfig()
    return type(cfg.HoldAnimation) == 'table' and cfg.HoldAnimation or {}
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

local function loadAnimDict(dict)
    if HasAnimDictLoaded(dict) then
        return true
    end

    RequestAnimDict(dict)

    local timeout = 0
    while not HasAnimDictLoaded(dict) and timeout < 200 do
        Wait(10)
        timeout = timeout + 1
    end

    return HasAnimDictLoaded(dict)
end

local function loadModel(model)
    if HasModelLoaded(model) then
        return true
    end

    RequestModel(model)

    local timeout = 0
    while not HasModelLoaded(model) and timeout < 200 do
        Wait(10)
        timeout = timeout + 1
    end

    return HasModelLoaded(model)
end

local function clamp(value, minValue, maxValue)
    return math.max(minValue, math.min(maxValue, value))
end

local function rotationToDirection(rot)
    local pitch = math.rad(rot.x)
    local yaw = math.rad(rot.z)
    local cosPitch = math.cos(pitch)

    return vector3(
        -math.sin(yaw) * cosPitch,
        math.cos(yaw) * cosPitch,
        math.sin(pitch)
    )
end

local function setBackCameraTransform()
    if not cameraCam then
        return
    end

    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    local forward = GetEntityForwardVector(ped)
    local right = vector3(forward.y, -forward.x, 0.0)
    local backCfg = backCameraConfig()
    local offset = type(backCfg.Offset) == 'table' and backCfg.Offset or {}
    local rotOffset = type(backCfg.RotationOffset) == 'table' and backCfg.RotationOffset or {}
    local offsetX = tonumber(offset.x) or 0.0
    local offsetY = tonumber(offset.y) or 0.42
    local offsetZ = tonumber(offset.z) or 0.72

    SetCamCoord(
        cameraCam,
        coords.x + (right.x * offsetX) + (forward.x * offsetY),
        coords.y + (right.y * offsetX) + (forward.y * offsetY),
        coords.z + offsetZ
    )
    SetCamRot(
        cameraCam,
        cameraRotX + (tonumber(rotOffset.pitch) or 0.0),
        tonumber(rotOffset.roll) or 0.0,
        cameraRotZ + (tonumber(rotOffset.yaw) or 0.0),
        2
    )
    SetCamFov(cameraCam, cameraFov)
end

local function zoomLabel()
    local zoom = zoomConfig()
    local selfie = selfieCameraConfig()
    local maxFov = cameraFacing == 'front' and (tonumber(selfie.MaxFov) or 75.0) or (tonumber(zoom.MaxFov) or 70.0)
    local current = tonumber(cameraFov) or maxFov
    local ratio = maxFov / math.max(current, 1.0)

    return ('%.1fx'):format(ratio)
end

local function cameraFovLimits()
    if cameraFacing == 'front' then
        local selfie = selfieCameraConfig()
        return {
            min = tonumber(selfie.MinFov) or 35.0,
            max = tonumber(selfie.MaxFov) or 75.0,
            default = tonumber(selfie.Fov) or 55.0,
            step = tonumber(zoomConfig().Step) or 2.5
        }
    end

    local zoom = zoomConfig()
    return {
        min = tonumber(zoom.MinFov) or 30.0,
        max = tonumber(zoom.MaxFov) or 70.0,
        default = tonumber(zoom.DefaultFov) or tonumber(zoom.MaxFov) or 55.0,
        step = tonumber(zoom.Step) or 2.5
    }
end

local function cameraHudPayload(status, extra)
    local switchCfg = switchCameraConfig()
    local payload = {
        status = status or 'ready',
        mode = tostring(cameraConfig().Mode or 'gameplay'),
        facing = cameraFacing,
        zoom = zoomConfig(),
        zoomLabel = zoomLabel(),
        switchCamera = {
            Enabled = switchCfg.Enabled == true and switchCfg.AllowSelfie ~= false,
            Key = tonumber(switchCfg.Key) or 38
        }
    }

    if type(extra) == 'table' then
        for key, value in pairs(extra) do
            payload[key] = value
        end
    end

    return payload
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
        local targetApp = appId or restoreApp or 'camera'
        if targetApp == 'home' then
            return
        end

        SendNUIMessage({
            action = 'openApp',
            app = targetApp
        })
    end)
end

local function forceFirstPersonCamera()
    local fp = firstPersonConfig()
    if fp.Enabled ~= true or fp.ForceOnOpen ~= true then
        return
    end

    if not forcedFirstPerson then
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
    if fp.HidePlayerBeforeCapture ~= true or cameraFacing == 'front' then
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

    SetEntityVisible(PlayerPedId(), not playerHiddenForCamera, false)
    playerHiddenForCapture = false
end

local function HideLocalPlayerForCamera(reason)
    local backCfg = backCameraConfig()
    if cameraFacing ~= 'back' or backCfg.HidePlayerWhileActive ~= true then
        return
    end

    SetEntityVisible(PlayerPedId(), false, false)
    playerHiddenForCamera = true
    cameraLog(('hide player reason=%s'):format(tostring(reason or 'camera_back')))
end

local function RestoreLocalPlayerAfterCamera(reason)
    if not playerHiddenForCamera then
        return
    end

    SetEntityVisible(PlayerPedId(), true, false)
    playerHiddenForCamera = false
    cameraLog(('restore player reason=%s'):format(tostring(reason or 'camera_restore')))
end

local ApplyCameraPropVisibility

local function StartCameraHoldAnim()
    local cfg = holdAnimationConfig()
    if cfg.Enabled ~= true then
        return
    end

    local dict = tostring(cfg.Dict or 'cellphone@')
    local anim = tostring(cfg.Anim or 'cellphone_text_read_base')
    local ped = PlayerPedId()

    if loadAnimDict(dict) then
        TaskPlayAnim(ped, dict, anim, 3.0, 3.0, -1, 49, 0.0, false, false, false)
        cameraHoldAnim.dict = dict
        cameraHoldAnim.anim = anim
    end

    if DoesEntityExist(cameraHoldProp) then
        return
    end

    local model = GetHashKey(tostring(cfg.Prop or 'prop_npc_phone_02'))
    if not loadModel(model) then
        return
    end

    local coords = GetEntityCoords(ped)
    cameraHoldProp = CreateObject(model, coords.x, coords.y, coords.z, true, true, false)

    if DoesEntityExist(cameraHoldProp) then
        local offset = type(cfg.Offset) == 'table' and cfg.Offset or {}
        local rotation = type(cfg.Rotation) == 'table' and cfg.Rotation or {}
        AttachEntityToEntity(
            cameraHoldProp,
            ped,
            GetPedBoneIndex(ped, tonumber(cfg.Bone) or 28422),
            tonumber(offset.x) or 0.0,
            tonumber(offset.y) or 0.0,
            tonumber(offset.z) or 0.0,
            tonumber(rotation.x) or 0.0,
            tonumber(rotation.y) or 0.0,
            tonumber(rotation.z) or 0.0,
            true, true, false, true, 1, true
        )
    end

    SetModelAsNoLongerNeeded(model)
    ApplyCameraPropVisibility()
end

local function StopCameraHoldAnim()
    local ped = PlayerPedId()

    if cameraHoldAnim.dict and cameraHoldAnim.anim then
        StopAnimTask(ped, cameraHoldAnim.dict, cameraHoldAnim.anim, 1.0)
    end

    if DoesEntityExist(cameraHoldProp) then
        DeleteEntity(cameraHoldProp)
    end

    cameraHoldProp = nil
    cameraHoldHidden = false
    cameraHoldAnim.dict = nil
    cameraHoldAnim.anim = nil
end

local function HideCameraPropForCapture()
    local cfg = holdAnimationConfig()
    local backCfg = backCameraConfig()
    local hideInBack = cfg.HidePropBeforeCapture == true or backCfg.HidePropBeforeCapture == true
    if cameraFacing == 'back' and not hideInBack then
        return
    end

    if cameraFacing == 'front' and cfg.HidePropBeforeCapture ~= true then
        return
    end

    if DoesEntityExist(cameraHoldProp) then
        SetEntityVisible(cameraHoldProp, false, false)
        cameraHoldHidden = true
    end
end

local function RestoreCameraPropAfterCapture()
    if cameraHoldHidden and DoesEntityExist(cameraHoldProp) then
        SetEntityVisible(cameraHoldProp, true, false)
    end

    cameraHoldHidden = false

    if cameraMode then
        ApplyCameraPropVisibility()
    end
end

function ApplyCameraPropVisibility()
    if not DoesEntityExist(cameraHoldProp) then
        return
    end

    local cfg = holdAnimationConfig()
    if cameraFacing == 'back' and cfg.HidePropInBackMode == true then
        SetEntityVisible(cameraHoldProp, false, false)
        return
    end

    if cameraFacing == 'front' and cfg.ShowPropInSelfieMode ~= false then
        SetEntityVisible(cameraHoldProp, true, false)
        return
    end

    SetEntityVisible(cameraHoldProp, false, false)
end

local function finishRequest(requestId, payload)
    local pending = pendingRequests[requestId]
    if not pending then
        return
    end

    pendingRequests[requestId] = nil
    payload = payload or { ok = false, error = 'unknown' }
    restorePlayerVisibility()
    RestoreCameraPropAfterCapture()

    if pending.cb then
        pending.cb(payload)
    end

    if pending.mode == 'camera' then
        if payload.ok == true then
            sendCameraStatus({ ok = true, photo = payload.photo })
            cameraNotify('Foto salva na galeria.', 'success')
            MZPhone.Camera.StopCameraMode('saved', {
                restorePhone = true,
                openApp = cameraResultMode and cameraResultReturnApp or 'gallery'
            })
        else
            isCapturing = false
            sendCameraHud(true, cameraHudPayload('error', {
                error = payload.error or 'save_failed'
            }))
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
    if cameraCam then
        MZPhone.Camera.DestroyPhoneCamera()
    end

    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)

    cameraCam = CreateCam('DEFAULT_SCRIPTED_CAMERA', true)
    SetCamFov(cameraCam, cameraFov)

    if cameraFacing == 'front' then
        local selfie = selfieCameraConfig()
        local heading = GetEntityHeading(ped) + selfieOrbitYaw
        local rad = math.rad(heading)
        local distance = tonumber(selfie.Distance) or 1.15
        local sideOffset = tonumber(selfie.SideOffset) or 0.0
        local height = tonumber(selfie.Height) or 0.72
        local lookAtHeight = tonumber(selfie.LookAtHeight) or 0.62
        local forward = vector3(-math.sin(rad), math.cos(rad), 0.0)
        local right = vector3(forward.y, -forward.x, 0.0)
        local camX = coords.x + (forward.x * distance) + (right.x * sideOffset)
        local camY = coords.y + (forward.y * distance) + (right.y * sideOffset)
        local camZ = coords.z + height + (selfieOrbitPitch * 0.01)

        SetCamCoord(cameraCam, camX, camY, camZ)
        PointCamAtCoord(cameraCam, coords.x, coords.y, coords.z + lookAtHeight)
    else
        setBackCameraTransform()
    end

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

local function updateSelfieCamera()
    if not cameraCam then
        return
    end

    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)

    if cameraFacing ~= 'front' then
        local lookX = GetControlNormal(0, 1)
        local lookY = GetControlNormal(0, 2)

        if math.abs(lookX) < 0.001 then
            lookX = GetDisabledControlNormal(0, 1)
        end

        if math.abs(lookY) < 0.001 then
            lookY = GetDisabledControlNormal(0, 2)
        end

        cameraRotZ = cameraRotZ - (lookX * 7.5)
        cameraRotX = clamp(cameraRotX - (lookY * 7.5), -75.0, 75.0)

        setBackCameraTransform()
        return
    end

    local selfie = selfieCameraConfig()
    local orbit = type(selfie.Orbit) == 'table' and selfie.Orbit or {}

    if orbit.Enabled == true then
        local lookX = GetControlNormal(0, 1)
        local lookY = GetControlNormal(0, 2)

        if math.abs(lookX) < 0.001 then
            lookX = GetDisabledControlNormal(0, 1)
        end

        if math.abs(lookY) < 0.001 then
            lookY = GetDisabledControlNormal(0, 2)
        end

        local sensitivity = tonumber(orbit.Sensitivity) or 2.0
        selfieOrbitYaw = clamp(selfieOrbitYaw + (lookX * sensitivity), -(tonumber(orbit.MaxYaw) or 35.0), tonumber(orbit.MaxYaw) or 35.0)
        selfieOrbitPitch = clamp(selfieOrbitPitch + (lookY * sensitivity), -(tonumber(orbit.MaxPitch) or 18.0), tonumber(orbit.MaxPitch) or 18.0)
    end

    local heading = GetEntityHeading(ped) + selfieOrbitYaw
    local rad = math.rad(heading)
    local distance = tonumber(selfie.Distance) or 1.15
    local sideOffset = tonumber(selfie.SideOffset) or 0.0
    local height = tonumber(selfie.Height) or 0.72
    local lookAtHeight = tonumber(selfie.LookAtHeight) or 0.62
    local forward = vector3(-math.sin(rad), math.cos(rad), 0.0)
    local right = vector3(forward.y, -forward.x, 0.0)
    local camX = coords.x + (forward.x * distance) + (right.x * sideOffset)
    local camY = coords.y + (forward.y * distance) + (right.y * sideOffset)
    local camZ = coords.z + height + (selfieOrbitPitch * 0.01)

    SetCamCoord(cameraCam, camX, camY, camZ)
    SetCamFov(cameraCam, cameraFov)
    PointCamAtCoord(cameraCam, coords.x, coords.y, coords.z + lookAtHeight)
end

local function applyCameraFov()
    if cameraCam then
        SetCamFov(cameraCam, cameraFov)
    end
end

local function setupCameraFov()
    local limits = cameraFovLimits()

    previousGameplayFov = GetGameplayCamFov()
    cameraFov = clamp(limits.default, limits.min, limits.max)
end

local function restoreCameraFov()
    previousGameplayFov = nil
    cameraFov = nil
end

local function toggleCameraFacing()
    local switchCfg = switchCameraConfig()
    if switchCfg.Enabled ~= true or switchCfg.AllowSelfie == false then
        return
    end

    if cameraFacing == 'back' then
        cameraFacing = 'front'
        RestoreLocalPlayerAfterCamera('camera_selfie')
        selfieOrbitYaw = 0.0
        selfieOrbitPitch = 0.0
        local limits = cameraFovLimits()
        cameraFov = clamp(limits.default, limits.min, limits.max)
        MZPhone.Camera.CreatePhoneCamera()
        ApplyCameraPropVisibility()
    else
        cameraFacing = 'back'
        local limits = cameraFovLimits()
        cameraFov = clamp(limits.default, limits.min, limits.max)
        MZPhone.Camera.CreatePhoneCamera()
        HideLocalPlayerForCamera('camera_back')
        ApplyCameraPropVisibility()
    end

    sendCameraHud(true, cameraHudPayload('ready'))
end

local function updateCameraZoom(direction)
    local zoom = zoomConfig()
    if zoom.Enabled ~= true then
        return
    end

    local currentFov = cameraFov or GetGameplayCamFov()
    local limits = cameraFovLimits()
    local nextFov = clamp(currentFov + (direction * limits.step), limits.min, limits.max)

    cameraFov = nextFov
    applyCameraFov()
    sendCameraHud(true, cameraHudPayload('ready'))
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
        sendCameraHud(true, cameraHudPayload('error', {
            error = captureError and captureError.error or 'save_failed'
        }))
        sendCameraStatus(captureError or { ok = false, error = 'save_failed' })
        return
    end

    local cfg = cameraConfig()
    local upload = uploadConfig()
    local uploadUrl = upload.uploadUrl
    local requestId = ('%s:%s'):format(GetGameTimer(), math.random(100000, 999999))

    isCapturing = true
    lastCaptureAt = GetGameTimer()
    sendCameraHud(true, cameraHudPayload('capturing'))
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
        HideCameraPropForCapture()

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
                    RestoreCameraPropAfterCapture()

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
            RestoreCameraPropAfterCapture()
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
    RestoreLocalPlayerAfterCamera('camera_stop')
    RestoreCameraPropAfterCapture()
    StopCameraHoldAnim()
    MZPhone.Camera.DestroyPhoneCamera()
    restoreCameraFov()
    restoreCameraView()
    FreezeEntityPosition(PlayerPedId(), false)
    releasePhoneFocus(reason or 'camera_stop')

    if wasActive and reason ~= 'saved' and reason ~= 'resource_stop' then
        sendCameraStatus({ ok = false, error = reason or 'camera_cancelled' })
    end

    if options.restorePhone ~= false and reason ~= 'resource_stop' then
        reopenPhone(options.openApp or restoreApp)
    end

    cameraResultMode = false
    cameraResultReturnApp = 'home'
end

function MZPhone.Camera.HandleCameraControls()
    CreateThread(function()
        while cameraMode do
            updateSelfieCamera()

            DisableControlAction(0, 24, true)
            DisableControlAction(0, 25, true)
            DisableControlAction(0, 37, true)
            DisableControlAction(0, 44, true)
            DisableControlAction(0, 140, true)
            DisableControlAction(0, 141, true)
            DisableControlAction(0, 142, true)
            DisableControlAction(0, 199, true)
            DisableControlAction(0, 200, true)
            DisableControlAction(0, 241, true)
            DisableControlAction(0, 242, true)

            if not isCapturing then
                if IsDisabledControlJustPressed(0, 24) or IsControlJustPressed(0, 191) then
                    MZPhone.Camera.CapturePhoto({}, function() end)
                elseif IsDisabledControlJustPressed(0, 199)
                    or IsDisabledControlJustPressed(0, 200)
                    or IsControlJustPressed(0, 177)
                    or IsControlJustPressed(0, 322) then
                    MZPhone.Camera.StopCameraMode('camera_cancelled', {
                        restorePhone = cameraResultMode,
                        openApp = cameraResultReturnApp
                    })
                elseif IsDisabledControlJustPressed(0, 241) then
                    updateCameraZoom(-1)
                elseif IsDisabledControlJustPressed(0, 242) then
                    updateCameraZoom(1)
                elseif IsControlJustPressed(0, tonumber(switchCameraConfig().Key) or 38) then
                    toggleCameraFacing()
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
    restoreApp = tostring(data.restoreApp or 'home')
    cameraResultMode = data.forResult == true
    cameraResultReturnApp = tostring(data.restoreApp or 'home')
    cameraFacing = 'back'
    selfieOrbitYaw = 0.0
    selfieOrbitPitch = 0.0

    if cfg.HidePhoneWhileActive ~= false and previousPhoneOpen then
        MZPhone.SetOpen(false)
    end

    releasePhoneFocus('camera_start')
    forceFirstPersonCamera()
    local gameplayRot = GetGameplayCamRot(2)
    cameraRotX = gameplayRot.x
    cameraRotZ = gameplayRot.z
    setupCameraFov()
    MZPhone.Camera.CreatePhoneCamera()
    StartCameraHoldAnim()
    HideLocalPlayerForCamera('camera_start')
    ApplyCameraPropVisibility()

    cameraMode = true
    isCapturing = false

    sendCameraHud(true, cameraHudPayload('ready'))

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
