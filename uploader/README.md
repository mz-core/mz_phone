# mz_phone uploader

Uploader/adaptador para fotos da Camera do `mz_phone`.

Ele recebe o arquivo enviado pelo `screenshot-basic`, valida o upload e retorna uma URL final para a Galeria. O banco do `mz_phone` deve salvar somente essa URL/caminho final e metadata.

## Adapters

### local

Modo recomendado para producao.

- Salva o arquivo na VPS em `uploads/phone/YYYY/MM/arquivo.jpg`.
- Retorna uma URL local estavel.
- A Galeria usa `url/localUrl` como imagem principal.

Resposta:

```json
{
  "success": true,
  "adapter": "local",
  "url": "https://seudominio.com/uploads/phone/YYYY/MM/arquivo.jpg",
  "localUrl": "https://seudominio.com/uploads/phone/YYYY/MM/arquivo.jpg"
}
```

### discord

Modo util para teste, log ou servidores pequenos.

- Envia o arquivo para Discord webhook com `files[0]`.
- Usa `wait=true` para receber a mensagem criada.
- A Galeria usa a URL do Discord como principal somente neste adapter.

Resposta:

```json
{
  "success": true,
  "adapter": "discord",
  "url": "https://cdn.discordapp.com/attachments/...",
  "discordUrl": "https://cdn.discordapp.com/attachments/...",
  "discordMessageId": "...",
  "discordChannelId": "..."
}
```

### local_discord

Modo hibrido recomendado quando voce quer backup/log no Discord.

- Salva local na VPS.
- Envia uma copia para Discord.
- Retorna a URL local como principal.
- Salva a URL do Discord apenas como metadata auxiliar.
- Se o Discord falhar, o upload local continua valendo e a resposta traz `warning`.

Resposta:

```json
{
  "success": true,
  "adapter": "local_discord",
  "url": "https://seudominio.com/uploads/phone/YYYY/MM/arquivo.jpg",
  "localUrl": "https://seudominio.com/uploads/phone/YYYY/MM/arquivo.jpg",
  "discordUrl": "https://cdn.discordapp.com/attachments/...",
  "discordMessageId": "...",
  "discordChannelId": "..."
}
```

## Instalacao

```txt
cd mz_phone/uploader
npm install
cp .env.example .env
nano .env
npm start
```

Com PM2:

```txt
cd mz_phone/uploader
npm install
cp .env.example .env
nano .env
pm2 start server.js --name mz-phone-uploader
pm2 save
```

## .env

```env
PORT=3025
UPLOAD_TOKEN=troque_este_token
PUBLIC_BASE_URL=https://seudominio.com
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=5

UPLOAD_ADAPTER=local
DISCORD_WEBHOOK_URL=
DISCORD_USE_AS_PRIMARY=false

RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=60
```

`DISCORD_USE_AS_PRIMARY` fica documentado para compatibilidade, mas o adapter `local_discord` sempre retorna a URL local como principal.

## Config do mz_phone

No `mz_phone/shared/config.lua`, prefira usar:

```lua
Config.Phone.Camera.Upload = {
    Adapter = 'local',
    UploadUrl = 'https://seudominio.com/api/mz-phone/upload?token=troque_este_token',
    FieldName = 'file'
}
```

Compatibilidade antiga mantida:

```lua
Config.Phone.Camera.UploadUrl = 'https://seudominio.com/api/mz-phone/upload?token=troque_este_token'
Config.Phone.Camera.FieldName = 'file'
```

O `client/camera.lua` usa `Config.Phone.Camera.Upload.UploadUrl` primeiro. Se estiver vazio, usa `Config.Phone.Camera.UploadUrl`.

Para Discord webhook direto sem uploader local, configure:

```lua
Config.Phone.Camera.UploadUrl = 'https://discord.com/api/webhooks/ID/TOKEN?wait=true'
Config.Phone.Camera.FieldName = 'files[0]'
```

Esse modo e apenas para teste. O uploader proprio protege webhook, valida arquivo, padroniza resposta e pode retornar URL local estavel.

## Endpoints

Health:

```txt
GET /health
```

Upload:

```txt
POST /api/mz-phone/upload?token=TOKEN
```

Tambem aceita token por header:

```txt
x-upload-token: TOKEN
```

## Curl

Health:

```txt
curl https://seudominio.com/health
```

Upload com query token:

```txt
curl -X POST "https://seudominio.com/api/mz-phone/upload?token=troque_este_token" \
  -F "file=@./foto.jpg"
```

Upload com header:

```txt
curl -X POST "https://seudominio.com/api/mz-phone/upload" \
  -H "x-upload-token: troque_este_token" \
  -F "file=@./foto.jpg"
```

## Nginx

Exemplo:

```nginx
location /api/mz-phone/upload {
    proxy_pass http://127.0.0.1:3025/api/mz-phone/upload;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

location /health {
    proxy_pass http://127.0.0.1:3025/health;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

location /uploads/phone/ {
    alias /CAMINHO/ABSOLUTO/mz_phone/uploader/uploads/phone/;
    access_log off;
    expires 30d;
}
```

## Seguranca

- Upload sem token e negado.
- Token errado e negado.
- MIME aceitos: `image/jpeg`, `image/png`, `image/webp`.
- Extensoes aceitas: `.jpg`, `.jpeg`, `.png`, `.webp`.
- Assinatura real do arquivo e validada.
- Nome original nao e usado.
- Path traversal nao e aceito.
- Tamanho e limitado por `MAX_FILE_SIZE_MB`.
- Rate limit simples por IP.
- `.env`, `uploads/` e `node_modules/` ficam no `.gitignore` do uploader.

## Testes manuais

### Teste 1 - local

1. Configure `.env` com `UPLOAD_ADAPTER=local`.
2. Suba o uploader.
3. Teste `/health`.
4. Faca curl com uma imagem.
5. Confirme que retornou `url/localUrl`.
6. Coloque essa URL do endpoint em `Config.Phone.Camera.Upload.UploadUrl`.
7. Tire foto no jogo.
8. Confirme que a foto aparece na Galeria.

### Teste 2 - discord

1. Configure `.env` com `UPLOAD_ADAPTER=discord`.
2. Configure `DISCORD_WEBHOOK_URL`.
3. Faca upload manual com curl.
4. Confirme que apareceu no Discord.
5. Confirme que retornou `discordUrl`.
6. Tire foto no jogo.
7. Confirme que a Galeria usou a URL do Discord.

### Teste 3 - local_discord

1. Configure `UPLOAD_ADAPTER=local_discord`.
2. Configure `DISCORD_WEBHOOK_URL`.
3. Tire foto.
4. Confirme que salvou local.
5. Confirme que a copia apareceu no Discord.
6. Confirme que a Galeria usa URL local como principal.
7. Confirme que a metadata contem `discordUrl`.

### Teste 4 - Discord falhando em local_discord

1. Configure `UPLOAD_ADAPTER=local_discord`.
2. Coloque webhook invalido.
3. Tire foto.
4. Se local salvou, a Galeria deve funcionar.
5. A resposta deve conter `warning: discord_upload_failed`.

### Teste 5 - seguranca

1. Upload sem token deve negar.
2. Upload com token errado deve negar.
3. Arquivo `.php`, `.exe`, `.txt` deve negar.
4. Arquivo maior que `MAX_FILE_SIZE_MB` deve negar.

### Teste 6 - parser camera.lua

O parser aceita:

- `url`
- `localUrl`
- `discordUrl`
- `data.url`
- `data.localUrl`
- `data.discordUrl`
- primeiro `attachments[].url`
- primeiro `files[].url`

## Validacao

No `mz_phone`:

```txt
luac -p mz_phone/server/*.lua
luac -p mz_phone/client/*.lua
node --check mz_phone/web/**/*.js
```

No uploader:

```txt
node --check mz_phone/uploader/server.js
npm test
```

## Limitacao importante

Discord webhook/CDN pode gerar links com parametros assinados ou temporarios. Por isso, nao use Discord como storage principal de producao quando precisar de uma Galeria permanente. Para producao, use `local` ou `local_discord` com Nginx servindo `/uploads/phone/`.
