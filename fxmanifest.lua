fx_version 'cerulean'
game 'gta5'

lua54 'yes'

name 'mz_phone'
author 'Mazus'
description 'MZ Phone integrado ao mz_core'
version '1.0.0'

ui_page 'web/index.html'

files {
    'web/index.html',
    'web/*.js',
    'web/apps/*.js',
    'web/components/*.js',
    'web/sounds/*',
    'web/css/*.css',
    'web/css/apps/*.css'
}

shared_scripts {
    'shared/config.lua',
    'shared/apps.lua'
}

client_scripts {
    'client/framework.lua',
    'client/animation.lua',
    'client/notifications.lua',
    'client/phone.lua',
    'client/calls.lua',
    'client/camera.lua',
    'client/nui.lua',
    'client/main.lua'
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/framework.lua',
    'server/security.lua',
    'server/repository.lua',
    'server/service.lua',
    'server/calls.lua',
    'server/callbacks.lua',
    'server/main.lua'
}

dependencies {
    'oxmysql',
    'mz_core'
}
