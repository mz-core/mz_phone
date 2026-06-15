# Padrao Media, Camera e Galeria

Este documento define o contrato de midia do `mz_phone`, especialmente para Camera, Galeria e pickers usados por outros apps.

## Objetivo

Ter um unico caminho confiavel para:

- Abrir Galeria como app normal.
- Abrir Galeria como picker para outro app.
- Abrir Camera como app normal.
- Abrir Camera como origem de foto para outro app.
- Retornar uma foto normalizada para quem pediu.

## Fonte de verdade

A fonte de verdade da galeria e a tabela `mz_phone_gallery`, exposta pelo servidor Lua:

```txt
Repository.GetGalleryPhotos
Service.GetGallery
TriggerClientEvent('mz_phone:client:receiveGallery', photos)
SendNUIMessage({ action = 'receiveGallery', photos = data })
PhoneAPI.onReceiveGallery
phoneState.gallery
AppContract.gallery.get(state)
```

O app Galeria standalone e o modo picker devem renderizar a mesma lista: `AppContract.gallery.get(state)`.

## Formato de foto

Formato normalizado esperado pelo frontend:

```js
{
  id: 123,
  image_url: "https://...",
  thumbnail_url: "",
  caption: "",
  source: "camera",
  favorite: false,
  created_at: "2026-06-14 12:00:00",
  metadata: {}
}
```

Alias aceitos no `AppContract.gallery`:

- `id`, `photoId`, `photo_id`
- `image_url`, `imageUrl`, `url`
- `thumbnail_url`, `thumbnailUrl`
- `created_at`, `createdAt`

## Payloads aceitos

O frontend deve aceitar:

- array direto
- `{ photos: [...] }`
- `{ items: [...] }`
- `{ gallery: [...] }`
- `{ data: { photos: [...] } }`
- `{ data: { items: [...] } }`
- `{ result: { photos: [...] } }`
- `{ result: { items: [...] } }`

O retorno atual do client Lua usa `photos`, e o RealEstate tambem pode emitir `receiveRealEstateAction` com `result.photos`.

## PhoneMedia

`PhoneMedia` em `web/app.js` e o dispatcher oficial de picker.

Contrato de abertura:

```js
window.PhoneMedia.openGalleryForResult({
  returnTo: "realestate",
  type: "image",
  purpose: "realestate_listing_photo",
  returnApp: "realestate",
  context: {
    listingCode: "ABC123",
    mode: "attach_listing_photo",
  },
  returnState: {
    realEstateView: "form",
  },
});
```

Campos:

- `kind`: definido internamente como `gallery` ou `camera`.
- `purpose`: identifica a acao esperada pelo app de destino.
- `returnTo`: app que recebera `applyMediaResult`.
- `returnApp`: alias legado aceito para compatibilidade.
- `type`: tipo de midia, por enquanto `image`.
- `context`: dados de dominio, como `listingCode`.
- `returnState`: estado a restaurar antes de despachar o resultado.

## Resultado de midia

`completeMediaRequest(photo, source)` normaliza para:

```js
{
  id: 123,
  galleryPhotoId: 123,
  url: "https://...",
  imageUrl: "https://...",
  thumbnailUrl: "",
  caption: "",
  type: "image",
  source: "gallery",
  createdAt: "2026-06-14 12:00:00"
}
```

Para RealEstate, `id` precisa ser o ID real da `mz_phone_gallery`, pois `attachRealEstateGalleryPhoto` valida posse no servidor antes de chamar o `mz_realestate`.

`galleryPhotoId` deve ser igual ao ID real da galeria. `imageUrl` e `thumbnailUrl` sao preview e nao devem ser usados para anexar em outro resource.

## Galeria standalone

Ao abrir `gallery` normalmente:

1. `GalleryApp.onOpen` limpa selecao.
2. Define `galleryPicker` como false, exceto se o estado ou params indicarem picker.
3. Chama `PhoneAPI.getGallery()`.
4. Renderiza `AppContract.gallery.get(state)`.
5. Clique em foto abre viewer.

## Galeria picker

Ao abrir via `PhoneMedia.openGalleryForResult`:

1. `beginMediaRequest("gallery", options)` salva request ativa.
2. Estado recebe `galleryPicker: true`.
3. `openApp("gallery", { picker: true })` abre o app.
4. `GalleryApp.onOpen` tambem chama `PhoneAPI.getGallery()`.
5. `GalleryApp.selectPhoto(photoId)` busca em `AppContract.gallery.get(state)`.
6. Se a foto nao tem ID real, a selecao e bloqueada com aviso in-app.
7. `PhoneMedia.complete(photo, "gallery")` restaura o app de origem.
8. `dispatchMediaResult` chama `<ReturnTo>.applyMediaResult(result, context, request)` quando o consumidor usa o contrato novo.
9. Consumidores legados ainda podem receber o `request` completo.

## Camera standalone

Ao abrir `camera` normalmente:

1. `CameraApp.onOpen` limpa estado de camera.
2. `CameraApp.openCameraMode()` chama `PhoneAPI.openCameraMode`.
3. Client Lua inicia o modo camera.
4. Ao salvar, `Service.SaveCameraPhoto` registra em `mz_phone_gallery`.
5. Servidor envia `receiveGallery` e `cameraPhotoSaved`.
6. Se nao ha request ativa, o fluxo volta para Galeria.

## Camera como picker

Ao abrir via `PhoneMedia.openCameraForResult`:

1. `beginMediaRequest("camera", options)` salva request ativa.
2. `openApp("camera", { mediaRequest: true })` abre o app.
3. `CameraApp.openCameraMode` envia `forResult`, `purpose` e `restoreApp`.
4. Ao salvar foto, `cameraPhotoSaved` chama `PhoneMedia.complete(data.photo, "camera")`.
5. O app de destino recebe o mesmo formato normalizado de media.

Se a Camera salvar a foto, mas o payload de retorno nao trouxer `id`/`galleryPhotoId` real, o consumidor nao deve tentar anexar usando URL. Para RealEstate, a acao correta e manter o app aberto e orientar o usuario a selecionar a foto por `Adicionar da Galeria`, onde o ID real vem da lista persistida.

## RealEstate

O RealEstate deve anexar foto assim:

```txt
RealEstateApp.openGalleryPicker
PhoneMedia.openGalleryForResult
GalleryApp.selectPhoto
PhoneMedia.complete
RealEstateApp.applyMediaResult
PhoneAPI.attachRealEstateGalleryPhoto(listingCode, galleryPhotoId)
Service.AttachGalleryPhotoToRealEstateListing
Repository.GetGalleryPhotoById
validacao owner_citizenid
export mz_realestate:AttachPhotoToListingFromPhone
```

Regras:

- O frontend nao deve confiar apenas em URL para anexar.
- O servidor deve continuar validando `owner_citizenid`.
- `galleryPhotoId` deve existir e ser numerico/positivo no consumidor RealEstate.
- `photo_not_owned` e `photo_not_found` sao erros esperados e devem aparecer como mensagem de dominio.
- `RealEstateApp.applyMediaResult(result, context, request)` deve usar `context.listingCode` e `result.galleryPhotoId || result.id`.
- `PhoneMedia.complete` deve preservar o telefone aberto e voltar para o app consumidor com `returnState` e contexto antes de disparar `applyMediaResult`.
- RealEstate photos: o phone envia `galleryPhotoId`; o server do `mz_phone` resolve `image_url` pela `mz_phone_gallery`; o `mz_realestate` grava `image_url` em `mz_realestate_listing_photos`.
- Preview de fotos de anuncio deve passar por normalizacao defensiva e aceitar `imageUrl`, `image_url`, `thumbnailUrl`, `thumbnail_url`, `coverImage`, `coverUrl`, `cover_image` e `cover_url`.

## Falhas comuns

- Picker abre com `galleryPicker: true`, mas `state.gallery` esta vazio porque `getGallery` nao foi chamado.
- Payload de galeria vem aninhado em `data` ou `result` e nao e normalizado.
- Foto tem URL, mas nao tem `id`; RealEstate nao consegue anexar com seguranca.
- App de retorno nao implementa `applyMediaResult`.
- `returnState` restaura uma tela antiga e apaga estado necessario para anexar.
- Retorno de picker/camera nao reafirma `isOpen`, fazendo o telefone parecer fechado mesmo com o app de destino restaurado.
- `mz_realestate` pode negar por permissao, anuncio arquivado, limite de fotos, URL maior que `Photos.maxImageUrlLength` ou scheme nao permitido.

## Debug controlado

Para diagnosticar anexo de foto no anuncio sem expor URL completa:

```lua
-- mz_phone/shared/config.lua
Config.Debug.RealEstatePhotos = true

-- mz_realestate/shared/config.lua
MZRealEstateConfig.DebugPhonePhotos = true
```

Logs esperados:

- `[mz_phone][realestate:photo]`: source, citizenid mascarado, `listingCode`, `galleryPhotoId`, posse da foto e resultado do export.
- `[mz_realestate][phone_photo]`: `listingCode`, validacao de URL por scheme/tamanho, permissao `canManage`, limite e insert da foto.

Desligar as flags depois do teste manual.

## Validacao manual minima

- Abrir Galeria standalone e ver fotos.
- Atualizar Galeria e confirmar que a lista nao some.
- Abrir RealEstate, editar anuncio e clicar em "Adicionar da Galeria".
- Confirmar que as mesmas fotos aparecem no picker.
- Selecionar foto e confirmar que `attachRealEstateGalleryPhoto` recebe `galleryPhotoId`.
- Confirmar que a foto aparece no anuncio.
- Cancelar picker e confirmar retorno ao formulario.
