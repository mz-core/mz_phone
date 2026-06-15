# Analise da Referencia celular

Esta analise usa `celular` como referencia local, sem assumir que ele deve ser copiado para o `mz_phone`.

## Estrutura observada

Arquivos principais:

- `celular/resource/smartphone/fxmanifest.lua`
- `celular/resource/smartphone/client.lua`
- `celular/resource/smartphone/server.js`
- `celular/resource/smartphone/index.html`
- `celular/resource/smartphone/config.json`
- `celular/web/smartphone/apps.js`
- `celular/web/smartphone/styles.css`
- `celular/web/smartphone/storage/upload.v2.php`

Assets relevantes:

- `celular/web/smartphone/apps`: icones de apps e marcas.
- `celular/web/smartphone/stock`: sons, imagens padrao, mapas e assets variados.
- `celular/web/smartphone/stock/wallpapers`: wallpapers ja alinhados ao tema de smartphone.
- `celular/web/smartphone/fonts`: SF Pro, Sofia Pro e Font Awesome.

## Pontos fortes

- Grande biblioteca de icones de apps.
- Wallpapers prontos para telefone.
- Sons de toque, discagem, notificacao e foto.
- Repertorio de UX para galeria, camera, mensagens, WhatsApp-like, bancos e apps sociais.
- Apps com identidade visual mais rica que um prototipo basico.
- Fluxo de galeria com callback para selecionar imagem.

## Pontos fracos para reaproveitamento direto

- Runtime muito monolitico em `apps.js`.
- `index.html` baixa `apps.js` e `styles.css` de host remoto.
- `client.lua` expoe fluxo generico de `eval`/backend request muito diferente do `mz_phone`.
- `server.js` e grande, acoplado a varios sistemas e drivers.
- `config.json` contem URLs, tokens/webhooks e hosts externos que nao devem ser herdados.
- Upload de video usa PHP em `storage/upload.v2.php`, fora do padrao `mz_phone_server`.
- O fluxo de camera/galeria depende de objetos globais e router internos do app antigo.

## Comparacao com mz_phone

`mz_phone` atual:

- E modular por app em `web/apps/*.js`.
- Usa `AppRegistry`, `PhoneAPI`, `AppContract` e `PhoneMedia`.
- Tem servidor Lua separado por service/repository/security.
- Tem `mz_phone_server` externo para assets/upload.
- Tem SQL proprio e migracoes leves em repository.

`celular`:

- E empacotado/monolitico.
- Usa bundle unico minificado.
- Usa servidor JS proprio com muito dominio interno.
- Usa URLs remotas hardcoded.
- Tem assets valiosos, mas runtime incompatibile com o padrao atual.

Conclusao: `celular` deve ser fonte de inspiracao e assets, nao fonte de verdade.

## O que pode ser adaptado com seguranca

Prioridade 1:

- Wallpapers de `stock/wallpapers`.
- Sons `ring.mp3`, `dial.mp3`, `notification.mp3`, `photo.ogg`, `calling.ogg`.
- Icones de apps em `apps`.
- Fontes, se houver decisao de padrao visual e licenca interna aprovada.

Prioridade 2:

- Layout visual da grade de apps.
- Ideia de pastas/galeria.
- UX de anexos em mensagens.
- Ideias de configuracao de wallpaper, tema e sons.

Prioridade 3:

- Apps novos como banco, classificados, noticias ou delivery, mas reimplementados no padrao `mz_phone`.

## O que nao deve ser copiado

- `apps.js` como runtime.
- `styles.css` inteiro sem triagem.
- `client.lua` com `safeEval`.
- `server.js` como backend do `mz_phone`.
- `config.json` com URLs ou webhooks reais.
- `upload.v2.php`.
- Fluxos de camera/galeria sem passar por `PhoneMedia`.

## Referencias uteis encontradas

Catalogo de apps no `apps.js`:

- settings
- contacts
- sms
- gallery
- whatsapp
- tor
- instagram
- twitter
- bank
- paypal
- olx
- tinder
- yellowpages
- weazel
- casino
- calculator
- notes
- minesweeper
- truco

Fluxos interessantes:

- Galeria carrega uma lista e usa callback para selecionar imagem quando aberta por outro app.
- Mensagens permitem anexo por camera, galeria, imagem manual e localizacao.
- Camera salva no backend da galeria apos upload.

Essas ideias ja combinam com o desenho do `PhoneMedia`, mas precisam ser implementadas no padrao do `mz_phone`.

## Plano de reaproveitamento

1. Catalogar assets desejados e copiar somente os aprovados para `mz_phone_server` ou `mz_phone/web`.
2. Atualizar configs de assets sem alterar contrato runtime.
3. Adaptar CSS pontual por app, nunca importar stylesheet inteiro.
4. Recriar comportamentos app por app usando `registerApp`.
5. Validar cada app isoladamente.

## Risco principal

O maior risco e misturar a arquitetura antiga com a nova. O `celular` resolve muita coisa dentro de um bundle unico; o `mz_phone` ja tem fronteiras mais claras. Manter essas fronteiras e mais importante do que copiar funcionalidades rapidamente.
