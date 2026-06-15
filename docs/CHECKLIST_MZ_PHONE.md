# Checklist MZ Phone

Este checklist e o guia de continuidade do `mz_phone`. Ele foi criado a partir da leitura do estado atual do workspace, sem uso de historico Git e sem alterar runtime.

## Regras de trabalho

- [ ] Nao tocar em `mz_core` durante fases do telefone.
- [ ] Nao reescrever `mz_phone` inteiro.
- [ ] Nao copiar codigo runtime do `celular`; usar somente como referencia visual/UX.
- [ ] Manter camera, galeria, `mz_phone_server`, RealEstate, mensagens, chamadas e notas operando.
- [ ] Cada fase deve ter escopo fechado, lista de arquivos afetados e validacao manual definida antes de editar runtime.
- [ ] Marcar item como concluido somente depois de implementado e validado.

## Inventario atual

- [x] `mz_phone` e um resource FiveM com NUI modular em `web/apps/*.js`.
- [x] Apps registrados por `registerApp` e renderizados via `AppRegistry`.
- [x] Estado central fica em `web/app.js`, com `DEFAULT_PHONE_STATE`, `PhoneApp`, `PhoneMedia` e listeners.
- [x] Contratos de normalizacao ficam em `web/app_contract.js`.
- [x] API NUI fica em `web/api.js` e chama `RegisterNUICallback` em `client/nui.lua`.
- [x] Servidor Lua usa `server/callbacks.lua`, `server/service.lua` e `server/repository.lua`.
- [x] `mz_phone_server` e um servico Node/Express externo para assets e upload.
- [x] `celular` e uma referencia separada, monolitica e asset-heavy.

## Padrao de apps

- [ ] Todos os apps devem seguir o contrato documentado em `PADRAO_APPS.md`.
- [ ] Novos apps devem ser adicionados em `web/apps/<id>.js`, `web/css/apps/<id>.css`, `web/index.html`, `fxmanifest.lua` e `shared/apps.lua`.
- [ ] Estado persistente deve passar por `AppContract` quando houver normalizacao.
- [ ] Estado transiente de tela deve ficar no `PhoneApp`/`DEFAULT_PHONE_STATE`, com nomes prefixados pelo app.
- [ ] Apps nao devem chamar diretamente eventos Lua; devem usar `PhoneAPI`.
- [ ] Apps nao devem montar fetch manual para `https://resource/endpoint` fora de `PhoneAPI`.
- [x] Confirmacoes visuais devem usar `PhoneDialog.confirm`, nao `window.confirm/alert/prompt`.

## Media, camera e galeria

- [x] O fluxo de picker deve sempre passar por `PhoneMedia.openGalleryForResult` ou `PhoneMedia.openCameraForResult`.
- [x] `GalleryApp.onOpen` deve carregar a mesma galeria usada pelo app Galeria normal.
- [x] `GalleryApp.selectPhoto` deve buscar em `AppContract.gallery.get(state)`.
- [x] A API deve aceitar payloads de galeria como array direto, `photos`, `items`, `gallery`, `data.*` ou `result.*` quando aplicavel.
- [x] O resultado de media deve conter `id`, `galleryPhotoId`, `url`, `imageUrl`, `thumbnailUrl`, `source` e `type`.
- [x] Para RealEstate, o ID retornado deve ser o `photo.id` real da tabela `mz_phone_gallery`.
- [ ] Nao anexar automaticamente foto de camera em novas alteracoes ate a fase dedicada.

## RealEstate

- [ ] Manter integracao com exports do `mz_realestate`; nao mover regras para `mz_phone`.
- [x] Manter validacao de propriedade da foto no servidor antes de anexar.
- [x] Separar correcoes de fluxo de media de melhorias visuais.
- [ ] Evitar aumentar `web/apps/realestate.js` sem plano de divisao ou helpers internos.
- [ ] Definir teste manual para listar, criar, editar, anexar foto, definir capa e remover foto.

## `mz_phone_server`

- [ ] Usar apenas como servidor externo de assets/upload, nunca como resource FiveM.
- [ ] Manter token forte em `.env`, nunca em repositorio.
- [ ] Validar `/health` e `/api/mz-phone/upload` quando mexer em camera/upload.
- [ ] Manter `uploads/` fora do repositorio.
- [ ] Conferir `PUBLIC_BASE_URL` quando fotos salvam mas URL nao abre.

## Referencia `celular`

- [ ] Usar assets, icones, sons, fontes e ideias de UX somente depois de conferir caminho, licenca interna e compatibilidade.
- [ ] Nao copiar `apps.js`, `server.js`, `client.lua`, `index.html` ou upload PHP como base runtime.
- [ ] Priorizar migracoes pequenas: wallpapers, icones, sons, depois componentes visuais.

## Validacao por fase

- [x] Rodar validacao estatica somente quando houver edicao runtime.
- [ ] Testar abrir/fechar telefone.
- [ ] Testar Galeria standalone.
- [ ] Testar Galeria picker a partir de RealEstate.
- [ ] Testar Camera standalone.
- [ ] Testar Mensagens com texto e media.
- [ ] Testar Chamadas recebidas, aceitas, recusadas e encerradas.
- [ ] Testar Notas e Contatos.

## Ordem recomendada

1. Estabilizar contrato Media/Camera/Galeria.
2. Blindar RealEstate em cima desse contrato.
3. Padronizar apps existentes sem mudar comportamento.
4. Avaliar migracao visual controlada da referencia `celular`.
5. Planejar novos apps ou recursos depois que o core estiver estavel.

## Notas da Fase 1

- Galeria normal e picker usam a mesma fonte de dados: `PhoneAPI.getGallery`, `receiveGallery`, `phoneState.gallery` e `AppContract.gallery.get(state)`.
- `AppContract.gallery.get` nao cria mais ID local quando o servidor nao manda ID real.
- `PhoneMedia` aceita `returnTo`, preserva `context` e normaliza resultado com `galleryPhotoId`.
- `GalleryApp.selectPhoto` bloqueia selecao quando nao ha ID real da galeria.
- `RealEstateApp.applyMediaResult` consome `galleryPhotoId`; `imageUrl` fica somente para preview.
- Backend de anexacao nao foi alterado porque ja valida `source -> citizenid -> owner_citizenid`.
- Validacao estatica executada: `luac -p mz_phone/server/*.lua mz_phone/client/*.lua` e `node --check` em `mz_phone/web/**/*.js`.
- Testes manuais no FiveM/NUI ainda pendentes.

### Correcao dos botoes RealEstate

- `Adicionar da Galeria` e `Tirar nova foto` continuam usando `PhoneMedia`.
- Os handlers agora resolvem `listingCode` por `realEstateSelectedListing`, `realEstateForm` ou `realEstateEditingListingCode`.
- Quando nao ha anuncio valido, o app mostra notify in-app em vez de retornar silenciosamente.
- `applyMediaResult` usa o mesmo resolvedor como fallback para nao perder o anuncio ao voltar da Galeria/Camera.
- Validacao estatica executada apos a correcao; teste manual in-game ainda pendente.

### Correcao do retorno Media para RealEstate

- `PhoneMedia.complete` e `PhoneMedia.cancel` agora restauram `returnState`, limpam o picker e reafirmam `isOpen: true` antes de voltar ao app consumidor.
- O retorno para `realestate` inclui `mediaContext`, `mediaRequest` e `mediaResult` em `appParams` para manter contexto de consumo.
- `RealEstateApp.applyMediaResult` separa erro de anuncio invalido de foto sem `galleryPhotoId`.
- Quando a Camera salva a foto mas o retorno nao traz ID real, o RealEstate nao tenta anexar URL; orienta o jogador a usar `Adicionar da Galeria`.
- Validacao estatica executada apos a correcao: `luac -p mz_phone/server/*.lua mz_phone/client/*.lua` e `node --check` em `mz_phone/web/**/*.js`.

### Auditoria ponta a ponta RealEstate Photos

- Frontend auditado: `PhoneMedia`, Galeria picker, Camera picker, `RealEstateApp.applyMediaResult`, `PhoneAPI.attachRealEstateGalleryPhoto` e `AppContract.gallery`.
- `mz_phone` server auditado: NUI callback, evento `attachRealEstateGalleryPhoto`, validacao `source -> citizenid`, busca em `mz_phone_gallery` e export para `mz_realestate`.
- `mz_realestate` auditado: export `AttachPhotoToListingFromPhone`, permissao `canManageListingPhotos`, validacao de URL, limite de fotos e persistencia em `mz_realestate_listing_photos`.
- Nao foi encontrada divergencia estatica de payload: `listingCode`, `galleryPhotoId`, `imageUrl/image_url` e retorno `ok/action/result` estao compativeis no codigo atual.
- Foi adicionada instrumentacao desligada por padrao para diagnostico in-game: `Config.Debug.RealEstatePhotos` no `mz_phone` e `MZRealEstateConfig.DebugPhonePhotos` no `mz_realestate`.
- [ ] Teste manual in-game pendente com logs de `galleryPhotoId`, posse da foto, permissao do anuncio, validacao de URL e insert da foto.

### Consolidacao do app Imoveis

- [x] Lista publica usa normalizacao defensiva de anuncio/foto no `AppContract.realestate`.
- [x] Detalhe do anuncio abre com loading, erro amigavel e placeholders quando nao ha foto/campo opcional.
- [x] Detalhe com foto nao depende de um unico alias (`imageUrl`, `image_url`, `thumbnailUrl`, `coverImage`, `cover_url`).
- [x] Meus anuncios usa `listingCode` normalizado e recebe fotos do painel do `mz_realestate` para capa.
- [x] Editar anuncio usa fallback robusto de `listingCode` ao salvar.
- [x] Remover anuncio usa status seguro `archived`, sem hard delete.
- [x] Remover anuncio e remover foto usam `PhoneDialog.confirm` global dentro do celular.
- [x] Erros conhecidos de foto/status foram mapeados para mensagens de dominio.
- [ ] Anexar foto testado in-game.

### PhoneDialog global

- [x] `PhoneDialog.confirm` renderiza dentro do shell do celular, acima do app atual.
- [x] Suporta `title`, `message`, `confirmText`, `cancelText` e tons `default`, `danger`, `warning`, `success`.
- [x] Home/Escape fecham apenas o dialog quando ele esta aberto.
- [x] `window.confirm`, `window.alert` e `window.prompt` ficam proibidos para apps novos.
