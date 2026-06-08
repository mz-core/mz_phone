# mz_phone

Resource de celular integrado ao `mz_core`.

## Antes de iniciar

1. Importe `sql/mz_phone.sql` no banco.
2. Garanta que o item `cellphone` existe no `mz_core`.
3. Garanta que o player de teste possui `cellphone`.
4. Nao inicie `mz_phone_core` junto.
5. Inicie `mz_phone` depois do `mz_core`.

## Identidade e SQL

O `mz_phone` usa o `citizenid` da tabela `mz_players` como dono oficial de numeros, contatos, conversas, mensagens, settings e notificacoes. A `license` fica somente no server do `mz_core`, usada para resolver o player em `mz_players`.

O SQL atual usa colunas `citizenid` e `owner_citizenid`. Se o banco ja tiver sido criado com `character_id`, o `Repository.Prepare()` tenta renomear as colunas antigas automaticamente no start do resource.

## Ordem recomendada no server.cfg

```cfg
ensure oxmysql
ensure ox_lib
ensure mz_core
ensure mz_notify
ensure mz_phone
```

## Debug

Ative em `shared/config.lua`:

```lua
Config.Debug.Enabled = true
Config.Debug.NuiMessages = true -- opcional
```

Comandos de teste:

```txt
/celular
/mzphone_debug
```

O comando `/mzphone_debug` exige `Config.Debug.AllowCommand = true` e permissao `mz_phone.debug` via `mz_core`, ou `Config.Debug.Enabled = true`.

## Camera e selfie

A camera back do `mz_phone` continua scriptada. A selfie padrao usa `AnchorMode = 'native_reference'`, inspirado no celular de referencia, com `CreateMobilePhone`/`CellCamActivate` apenas no modo selfie.

Enquanto o modo camera fica ativo, o jogador fica parado por padrao. Isso evita o efeito de correr no lugar enquanto a animacao de celular esta ativa:

```lua
Config.Phone.Camera.Controls = {
    FreezePlayerWhileActive = true,
    DisableMovementControls = true,
    DisableCombatControls = true,
    AllowLookControls = true
}
```

O mouse, scroll de zoom, `E`, clique/ENTER para foto e ESC/BACKSPACE para cancelar continuam funcionando.

No modo back, o player nao fica invisivel globalmente por padrao. A camera fica na frente do ped e olha para frente usando:

```lua
Config.Phone.Camera.BackCamera.Offset = { x = 0.0, y = 0.55, z = 0.74 }
Config.Phone.Camera.BackCamera.LookOffset = { x = 0.0, y = 5.0, z = 0.74 }
Config.Phone.Camera.BackCamera.HidePlayerWhileActive = false
Config.Phone.Camera.BackCamera.HidePlayerOnlyForCapture = true
Config.Phone.Camera.BackCamera.UseLocalInvisible = true
```

Na selfie, o modo padrao usa a camera nativa frontal do GTA como referencia, igual ao celular em `celular/resource` + `celular/web`. A camera back continua scriptada no `mz_phone`; somente a selfie usa esse modo para evitar enquadramento torto, colado no rosto ou preso na orelha:

```lua
Config.Phone.Camera.SelfieCamera.UsePhonePropAsLens = true
Config.Phone.Camera.SelfieCamera.AnchorMode = 'native_reference' -- native_reference, framed ou exact
Config.Phone.Camera.SelfieCamera.PhoneLensOffset = { x = 0.0, y = 0.08, z = 0.04 }
Config.Phone.Camera.SelfieCamera.FallbackHandOffset = { x = 0.10, y = 0.18, z = 0.04 }
Config.Phone.Camera.SelfieCamera.MinDistanceFromLookAt = 1.05
Config.Phone.Camera.SelfieCamera.Distance = 1.45
Config.Phone.Camera.SelfieCamera.Fov = 65.0
Config.Phone.Camera.SelfieCamera.LookAt = {
    Bone = 31086,
    Offset = { x = 0.0, y = 0.0, z = -0.05 }
}
Config.Phone.Camera.SelfieCamera.Orbit.SideRange = 0.35
Config.Phone.Camera.SelfieCamera.Orbit.HeightRange = 0.22
```

O modo `native_reference` usa `CreateMobilePhone`, `CellCamActivate` e `CellFrontCamActivate` apenas na selfie. Se quiser voltar para a selfie 100% scriptada para calibrar offsets, troque `AnchorMode` para `framed`.

O perfil recomendado para selfie scriptada e `camera`. Evite `call` na selfie, porque ele leva o telefone para a orelha e deixa a camera de lado:

```lua
Config.Phone.Camera.HoldAnimation.SelfieProfile = 'camera'
Config.Phone.Camera.HoldAnimation.Flags = {
    Default = 49,
    InVehicle = 49,
    Selfie = 49
}
```

Para calibrar, ajuste `Distance` para afastar/aproximar a selfie, `HoldAnimation.Selfie.Offset/Rotation` para mover o prop na mao, e `PhoneLensOffset`/`FallbackHandOffset` para alinhar a referencia do celular. Se quiser mais movimento no mouse, aumente `Orbit.SideRange` e `Orbit.HeightRange`. Ative `Config.Debug.Enabled = true` para ver logs de `camera/selfie`, `camera/back`, `camera/anim` e `camera/prop`.

## Servico externo mz_phone_server

O `mz_phone_server` fica fora do FXServer. Ele nao entra no `server.cfg`.

Use ele em uma VPS propria da cidade para servir assets publicos e receber uploads da camera:

- `/audio/...`
- `/core/wallpapers/...`
- `/core/avatar-default.jpg`
- `/apps/...`
- `/uploads/phone/...`
- `/api/mz-phone/upload`

Cada cidade/dono deve hospedar o proprio `mz_phone_server`. Nao use VPS, token, webhook ou dominio do desenvolvedor do script.

Leia:

```txt
../mz_phone_server/README.md
```

Resumo:

```bash
cd mz_phone_server
npm install
cp .env.example .env
nano .env
npm start
```

Com PM2:

```bash
pm2 start server.js --name mz-phone-server
pm2 save
```

## Upload da camera

A camera scriptada do `mz_phone` abre mesmo sem upload configurado. Se o jogador tentar capturar sem VPS ou Discord configurado, ela mostra `Upload da camera nao configurado.` e nao chama o `screenshot-basic`.

A config recomendada fica em `shared/config.lua`:

```lua
Config.Phone.Camera.Upload = {
    Mode = 'auto', -- auto, disabled, vps, discord_direct, discord_proxy, vps_discord
    FieldName = 'file',
    Auto = {
        Prefer = 'vps',
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
}
```

Configs antigas com `Config.Phone.Camera.Upload.UploadUrl`, `Config.Phone.Camera.UploadUrl` e `Config.Phone.Camera.FieldName` ainda funcionam quando a config nova nao tiver `Mode`, mas a config nova e a recomendada.

### Modo automatico

```lua
Config.Phone.Camera.Upload.Mode = 'auto'
Config.Phone.Camera.Upload.VPS.Url = 'https://phone.seudominio.com/api/mz-phone/upload'
Config.Phone.Camera.Upload.VPS.Token = 'TOKEN'

-- fallback opcional para teste
Config.Phone.Camera.Upload.DiscordDirect.WebhookUrl = ''
```

No `auto`, se `VPS.Url` estiver preenchido, usa VPS. Se a VPS estiver vazia e `DiscordDirect.WebhookUrl` estiver preenchido com `Auto.AllowDiscordDirectFallback = true`, usa Discord direto. Se nada estiver configurado, a camera abre, mas a captura mostra erro amigavel.

Se `Auto.Prefer = 'discord_direct'`, tenta Discord direto primeiro, depois VPS.

### Usar so VPS

```lua
Config.Phone.Camera.Upload.Mode = 'vps'
Config.Phone.Camera.Upload.VPS.Url = 'https://phone.seudominio.com/api/mz-phone/upload'
Config.Phone.Camera.Upload.VPS.Token = 'TOKEN'
```

O token e adicionado automaticamente como `?token=TOKEN` se a URL ainda nao tiver token.

### Usar so Discord direto

```lua
Config.Phone.Camera.Upload.Mode = 'discord_direct'
Config.Phone.Camera.Upload.DiscordDirect.WebhookUrl = 'https://discord.com/api/webhooks/<ID>/<TOKEN>'
```

Esse modo adiciona `?wait=true` automaticamente quando a URL nao tiver `wait`.

Aviso: Discord direto e facil para teste, mas o webhook fica visivel para quem tiver acesso ao resource/client/shared config. Nao e recomendado para producao publica.

### Usar Discord com proxy seguro

No `mz_phone`:

```lua
Config.Phone.Camera.Upload.Mode = 'discord_proxy'
Config.Phone.Camera.Upload.DiscordProxy.Url = 'https://phone.seudominio.com/api/mz-phone/upload'
Config.Phone.Camera.Upload.DiscordProxy.Token = 'TOKEN'
```

No `.env` do `mz_phone_server`:

```env
UPLOAD_ADAPTER=discord
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/<ID>/<TOKEN>
```

Assim o webhook fica protegido no `.env` da VPS.

### Usar VPS + Discord

No `mz_phone`:

```lua
Config.Phone.Camera.Upload.Mode = 'vps_discord'
Config.Phone.Camera.Upload.VPSDiscord.Url = 'https://phone.seudominio.com/api/mz-phone/upload'
Config.Phone.Camera.Upload.VPSDiscord.Token = 'TOKEN'
```

No `.env` do `mz_phone_server`:

```env
UPLOAD_ADAPTER=local_discord
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/<ID>/<TOKEN>
```

Nesse modo, a foto salva na VPS, uma copia vai para o Discord e a Galeria usa a URL local.

## Testar o servico externo

```bash
curl https://phone.seudominio.com/health

curl -X POST "https://phone.seudominio.com/api/mz-phone/upload?token=TOKEN" \
  -F "file=@teste.jpg"
```

Nunca commite token real ou webhook real. Para producao, prefira `vps`, `discord_proxy` ou `vps_discord`.
