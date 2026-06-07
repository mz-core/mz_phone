MZPhoneServer = MZPhoneServer or {}
MZPhoneServer.Security = {}

local buckets = {}

local function now()
    return os.time()
end

local function debugEnabled()
    return type(Config.Debug) == 'table' and Config.Debug.Enabled == true
end

local function serverPrintEnabled()
    return debugEnabled() and Config.Debug.PrintServer ~= false
end

local function maskValue(value)
    value = tostring(value or '')
    if value == '' then
        return ''
    end

    if #value <= 8 then
        return value
    end

    return value:sub(1, 4) .. '...' .. value:sub(-4)
end

function MZPhoneServer.Security.Log(action, source, message, force)
    if force ~= true and not serverPrintEnabled() then
        return
    end

    print(('[mz_phone][%s][src:%s] %s'):format(tostring(action), tostring(source), tostring(message or '')))
end

function MZPhoneServer.Security.Mask(value)
    return maskValue(value)
end

function MZPhoneServer.Security.NormalizeSource(source)
    local normalized = tonumber(source)
    if not normalized or normalized <= 0 then
        return nil, 'invalid_source'
    end

    return normalized, nil
end

function MZPhoneServer.Security.LogSource(label, source, force)
    MZPhoneServer.Security.Log(
        label,
        source,
        ('source=%s type=%s'):format(tostring(source), type(source)),
        force == true
    )
end

function MZPhoneServer.Security.DebugEnabled()
    return debugEnabled()
end

function MZPhoneServer.Security.RateLimit(source, key)
    source = tonumber(source)
    if not source or source <= 0 then
        return false
    end

    local rules = Config.Security.RateLimits or {}
    local rule = rules[key] or { limit = 10, window = 10 }
    local id = ('%s:%s'):format(source, key)
    local stamp = now()

    local bucket = buckets[id]
    if not bucket or stamp >= bucket.resetAt then
        buckets[id] = {
            count = 1,
            resetAt = stamp + (tonumber(rule.window) or 10)
        }
        return true
    end

    bucket.count = bucket.count + 1
    if bucket.count > (tonumber(rule.limit) or 10) then
        return false
    end

    return true
end

function MZPhoneServer.Security.SanitizeText(value, maxLength)
    value = tostring(value or '')
    value = value:gsub('[%z\1-\31\127]', '')
    value = value:gsub('^%s+', ''):gsub('%s+$', '')

    maxLength = tonumber(maxLength) or Config.Security.TextMaxLength or 500
    if #value > maxLength then
        value = value:sub(1, maxLength)
    end

    return value
end

function MZPhoneServer.Security.NormalizePhone(value)
    value = tostring(value or '')
    value = value:gsub('%s+', '')
    value = value:gsub('[^%d%+%-]', '')

    local maxLength = Config.Security.PhoneMaxLength or 32
    if #value > maxLength then
        value = value:sub(1, maxLength)
    end

    return value
end

function MZPhoneServer.Security.RequireIdentity(source, options)
    MZPhoneServer.Security.LogSource('service/RequireIdentity', source, true)

    source = MZPhoneServer.Security.NormalizeSource(source)
    if not source then
        return nil, 'invalid_source'
    end

    local identity, identityErr = MZPhoneServer.Framework.GetIdentity(source, options)
    if not identity or tostring(identity.citizenid or '') == '' then
        MZPhoneServer.Security.Log(
            'identity',
            source,
            ('unavailable reason=%s'):format(tostring(identityErr or 'unknown')),
            true
        )
        return nil, 'identity_unavailable'
    end

    return identity
end
