# Plano RealEstate App

Este plano cobre a continuidade do app Imoveis/RealEstate dentro do `mz_phone`.

## Arquitetura Imoveis

- O `mz_realestate` guarda o imovel/propriedade real e suas regras administrativas.
- O `mz_phone` cria e edita apenas anuncios/listings publicos para propriedades existentes.
- Criar anuncio pelo celular exige `propertyCode`, pois `mz_realestate_listings.property_code` e obrigatorio.
- A lista de imoveis anunciaveis vem do export `ListPhoneAdvertisableProperties`.
- A permissao de corretor/imobiliaria vem de `GetPhoneBrokerAccess`.
- A regra de disponibilidade da propriedade fica em `CanPropertyBeAdvertised`.
- O status inicial do anuncio criado pelo celular segue `MZRealEstateConfig.Listing.defaultStatus` (`pending` no config atual).
- Foto e adicionada somente depois que o anuncio existe e possui `listingCode`.
- Foto de anuncio exige URL publica `http/https`; `nui://`, caminho local e base64 nao devem ser usados em anuncio publico persistente.
- O app Imoveis anexa foto apenas por `galleryPhotoId`; o frontend nao envia `imageUrl`, `photos`, `coverImage` ou URL livre em create/update/attach.
- Anuncio manual/desvinculado de propriedade e fase futura, porque exige mudanca de banco/regra.

## Estado atual observado

O app `web/apps/realestate.js` concentra:

- Listagem publica de anuncios.
- Detalhe publico.
- Area do corretor.
- Criacao e edicao de anuncio.
- Gerenciamento de fotos.
- Picker de galeria antigo/local e fluxo novo por `PhoneMedia`.
- Chamadas, mensagens e GPS a partir do anuncio.

O servidor Lua integra com `mz_realestate` por exports em `server/service.lua`. O `mz_phone` nao deve assumir regra de negocio de propriedade; ele deve apenas normalizar payloads e chamar os exports.

## Contratos externos atuais

Exports esperados de `mz_realestate`:

- `ListPublicListings`
- `GetActiveListings`
- `GetListingByCode`
- `GetPhoneBrokerAccess`
- `ListPhoneAdvertisableProperties`
- `ListMyListings`
- `GetMyListingFromPhone`
- `CreateListingFromPhone`
- `UpdateListingFromPhone`
- `SetListingStatusFromPhone`
- `ListListingPhotosFromPhone`
- `AttachPhotoToListingFromPhone`
- `SetListingPrimaryPhotoFromPhone`
- `RemoveListingPhotoFromPhone`

O `mz_phone` deve continuar tratando `realestate_unavailable`, `broker_required`, `listing_not_found`, `photo_not_owned`, `invalid_photo` e `rate_limited`.

## Riscos atuais

- `realestate.js` esta grande e mistura UI, estado, validacao, midia e acoes de servidor.
- Existem dois conceitos de picker: modal interno `realEstatePhotoPickerOpen` e picker via `PhoneMedia`.
- O fluxo de foto depende de `photo.id`, nao apenas de `imageUrl`.
- O app depende de estado restaurado corretamente apos sair para Galeria/Camera.
- Erros em media podem parecer erro de RealEstate, embora a origem seja contrato de Galeria.

## Fase 1: estabilizar midia

Objetivo: garantir que RealEstate use o contrato de `PhoneMedia` de forma previsivel.

Arquivos provaveis:

- `web/app.js`
- `web/api.js`
- `web/app_contract.js`
- `web/apps/gallery.js`
- `web/apps/realestate.js`
- `client/nui.lua`
- `server/callbacks.lua`
- `server/service.lua`

Regras:

- Nao mexer no comportamento da camera standalone.
- Nao anexar automaticamente foto de camera ate a decisao explicita da fase.
- Garantir que Galeria picker e Galeria normal carreguem a mesma lista.
- Garantir que `applyMediaResult` receba `result.id`.
- Manter validacao server-side em `AttachGalleryPhotoToRealEstateListing`.

Aceite:

- Foto tirada pela camera aparece na Galeria standalone.
- A mesma foto aparece em "Adicionar da Galeria".
- Selecionar foto anexa ao anuncio usando `galleryPhotoId`.
- Cancelar picker retorna ao formulario sem perder dados.

## Fase 2: blindar acoes de fotos do anuncio

Objetivo: deixar foto do anuncio resiliente a refresh, capa e remocao.

Itens:

- Padronizar loading separado para lista, formulario e fotos.
- Garantir refresh apos anexar, definir capa e remover.
- Confirmar que `result.photos` atualiza `realEstateSelectedListing.photos`.
- Melhorar mensagens de erro de dominio.

Aceite:

- Anexar foto atualiza o card de fotos sem fechar indevidamente o app.
- Definir capa atualiza badge e cover.
- Remover foto atualiza lista.
- Erros de permissao/posse aparecem claros.

### Auditoria do fluxo de anexar foto

Conclusao da auditoria estatica:

- O fluxo documentado e o codigo atual convergem para anexar por `galleryPhotoId`.
- O frontend nao envia URL livre para anexar; chama `PhoneAPI.attachRealEstateGalleryPhoto(listingCode, galleryPhotoId)`.
- O `mz_phone` valida a posse em `mz_phone_gallery` antes de chamar o `mz_realestate`.
- O `mz_realestate` valida `canManageListingPhotos`, status do anuncio, limite de fotos, URL e grava em `mz_realestate_listing_photos`.
- Nao foi encontrada divergencia estatica de assinatura entre `mz_phone` e `mz_realestate`.

Diagnostico pendente:

- Rodar teste manual com `Config.Debug.RealEstatePhotos = true` e `MZRealEstateConfig.DebugPhonePhotos = true`.
- Confirmar nos logs se a falha real e `photo_not_owned`, `permission_denied`, `listing_not_found`, `photo_limit_reached`, `invalid_image_url`, `scheme_not_allowed` ou `photo_insert_failed`.
- Manter as flags desligadas fora do teste.

### Consolidacao minima aplicada

- Normalizacao defensiva de anuncio/foto no frontend para evitar detalhe vazio quando o payload vier com aliases diferentes.
- Normalizacao ampliada para `photos/images`, `price/value`, `phone/contact_phone`, `coords/location/position` e aliases de capa.
- `mz_phone` tambem aceita `code`/`id` como fallback de `listingCode` e preserva `coverImage`/`cover_url` quando vier do `mz_realestate`.
- `mz_realestate` envia `photos` tambem no painel de "Meus anuncios", permitindo capa nos cards gerenciaveis.
- Abas e formulario do telefone aceitam `sale`, `rent`, `visit` e `showcase`, respeitando os tipos habilitados no `mz_realestate`.
- O detalhe aberto pela lista publica usa o detalhe publico; o detalhe aberto por "Meus anuncios" usa o detalhe gerenciavel, para anuncios pausados/arquivados nao virarem tela vazia por filtro publico.
- O detalhe preserva um fallback do card clicado enquanto a API carrega ou se o retorno falhar, evitando tela vazia.
- Criar anuncio segue sem foto/URL; se faltar propriedade retorna `property_required`; apos sucesso o app abre o anuncio criado em modo edicao.
- Novo anuncio exige `propertyCode`; o botao Salvar nunca fica sem feedback: quando bloqueado por permissao, carregamento, lista vazia ou imovel nao selecionado, a tela mostra motivo e checklist.
- Selecionar Imovel base re-renderiza o formulario para habilitar visualmente o Salvar; o clique ainda valida antes de chamar `createRealEstateListing`.
- Anexo de foto continua aceitando apenas `galleryPhotoId` real. Foto sem URL publica retorna `upload_public_url_missing`.
- Foto de anuncio publico aceita somente URL `http/https`; `nui://`, `cfx-nui://`, base64 e caminhos locais nao devem ser persistidos em anuncio publico.
- Config compartilhada deve usar placeholder para upload; webhook/token real fica fora do repositorio.
- O botao visual "Remover" arquiva o anuncio via status `archived`, mantendo o padrao de soft delete/status.
- O botao publico de mensagem foi tratado como "Tenho interesse"; ele abre conversa com corretor/agencia e nao cria venda real.
- Pendencia: validar in-game anexar foto, definir capa e confirmar refresh visual apos o evento server.

## Fase 3: reduzir complexidade de `realestate.js`

Objetivo: diminuir risco sem reescrever.

Opcoes conservadoras:

- Extrair helpers puros dentro do mesmo arquivo primeiro.
- Separar renderizadores por secao somente se o `fxmanifest` e `index.html` forem atualizados com ordem clara.
- Manter `window.RealEstateApp` como API publica do app.
- Preservar nomes de estado existentes para evitar regressao.

Possiveis separacoes futuras:

- `realestate_helpers.js`
- `realestate_render.js`
- `realestate_actions.js`

Essa fase so deve ocorrer depois da fase 1 e 2 estarem validadas.

## Fase 4: polimento visual

Objetivo: melhorar UX usando referencia `celular` somente como inspiracao.

Itens:

- Melhorar cards de listagem e detalhe sem mudar contrato.
- Avaliar icone/app visual de Imoveis.
- Melhorar empty states, loading e botoes de acao.
- Revisar responsividade dentro da moldura do telefone.

Aceite:

- Listagem publica legivel.
- Area do corretor clara.
- Formulario nao perde dados entre navegacoes.
- Fotos do anuncio funcionam em mobile/NUI.

## Fase 5: funcionalidades futuras

Somente depois de estabilizar:

- Filtros por bairro/cidade/preco.
- Favoritos/salvos.
- Compartilhar anuncio por mensagem.
- Rota/GPS mais rica.
- Galeria dedicada por anuncio.
- Draft local de anuncio.

## Validacao manual completa

- Abrir app Imoveis.
- Alternar abas Todos, Venda e Aluguel.
- Abrir detalhe de anuncio.
- Chamar corretor.
- Enviar mensagem ao corretor.
- Marcar GPS.
- Abrir area do corretor.
- Criar anuncio.
- Editar anuncio.
- Adicionar foto da Galeria.
- Tirar foto pela Camera e confirmar que aparece na Galeria.
- Definir foto principal.
- Remover foto.
- Pausar, ativar e arquivar anuncio.

## Primeira fase recomendada

A primeira fase deve ser `Fase 1: estabilizar midia`, porque ela e a base para RealEstate, Settings, Contacts e Messages. Qualquer melhoria visual ou refatoracao antes disso aumenta o risco de regressao.
