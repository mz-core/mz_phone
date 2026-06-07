PhoneAnimation = {}

local phoneProp = nil
local animationThread = nil

local PHONE_PROP_MODEL = GetHashKey('prop_npc_phone_02')
local PHONE_BONE = 28422

local currentAnim = {
    lib = nil,
    anim = nil
}

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

local function getAnimationData()
    local ped = PlayerPedId()

    if IsPedInAnyVehicle(ped, false) then
        return "anim@cellphone@in_car@ps", "cellphone_text_read_base"
    end

    return "cellphone@", "cellphone_text_read_base"
end

local function ensureAnimationLoop()
    if animationThread then
        return
    end

    animationThread = CreateThread(function()
        while currentAnim.lib and currentAnim.anim do
            local ped = PlayerPedId()

            if not IsEntityPlayingAnim(ped, currentAnim.lib, currentAnim.anim, 3) then
                if loadAnimDict(currentAnim.lib) then
                    TaskPlayAnim(
                        ped,
                        currentAnim.lib,
                        currentAnim.anim,
                        3.0,
                        3.0,
                        -1,
                        49,
                        0.0,
                        false,
                        false,
                        false
                    )
                end
            end

            Wait(500)
        end

        animationThread = nil
    end)
end

function PhoneAnimation.CreateProp()
    if DoesEntityExist(phoneProp) then
        return
    end

    if not loadModel(PHONE_PROP_MODEL) then
        return
    end

    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)

    phoneProp = CreateObject(PHONE_PROP_MODEL, coords.x, coords.y, coords.z, true, true, false)

    if DoesEntityExist(phoneProp) then
        AttachEntityToEntity(
            phoneProp,
            ped,
            GetPedBoneIndex(ped, PHONE_BONE),
            0.01, 0.015, 0.0,
            -10.0, 0.0, 5.0,
            true, true, false, true, 1, true
        )
    end

    SetModelAsNoLongerNeeded(PHONE_PROP_MODEL)
end

function PhoneAnimation.DeleteProp()
    if DoesEntityExist(phoneProp) then
        DeleteEntity(phoneProp)
    end

    phoneProp = nil
end

function PhoneAnimation.Play()
    local lib, anim = getAnimationData()

    if not loadAnimDict(lib) then
        return
    end

    local ped = PlayerPedId()

    TaskPlayAnim(
        ped,
        lib,
        anim,
        3.0,
        3.0,
        -1,
        49,
        0.0,
        false,
        false,
        false
    )

    currentAnim.lib = lib
    currentAnim.anim = anim

    ensureAnimationLoop()
end

function PhoneAnimation.Stop()
    local ped = PlayerPedId()

    if currentAnim.lib and currentAnim.anim then
        StopAnimTask(ped, currentAnim.lib, currentAnim.anim, 1.0)
    end

    ClearPedSecondaryTask(ped)

    currentAnim.lib = nil
    currentAnim.anim = nil
end

function PhoneAnimation.Open()
    PhoneAnimation.CreateProp()
    PhoneAnimation.Play()
end

function PhoneAnimation.Close()
    PhoneAnimation.Stop()
    PhoneAnimation.DeleteProp()
end

function PhoneAnimation.Cleanup()
    PhoneAnimation.Close()
end
