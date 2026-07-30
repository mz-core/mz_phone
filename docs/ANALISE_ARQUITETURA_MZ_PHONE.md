# Análise de arquitetura: `mz_phone` e `mz_phone_server`

Data da análise: 2026-07-21.

## Resumo executivo

O `mz_phone` possui uma base funcional e reaproveitável: registro modular de apps, shell visual
compartilhado, estado central, ponte NUI/Lua, camada de serviço, repositório SQL, segurança básica
e um serviço externo de mídia. A separação conceitual é boa, mas a implementação cresceu de
forma desigual e hoje existem fontes duplicadas de configuração, contratos de resposta
inconsistentes e alguns acoplamentos globais.

O padrão oficial para novos apps está em `docs/PADRAO_APPS.md`. Este arquivo registra as
evidências encontradas e o backlog arquitetural; ele não autoriza uma refatoração automática.

## 1. Mapa dos dois projetos

### `mz_phone`

Resource FiveM responsável por:

- shell e apps da NUI;
- integração com controles/câmera do jogo;
- identidade do personagem por meio do `mz_core`;
- regras pertencentes ao telefone;
- persistência MySQL de números, contatos, notas, mensagens, chamadas, galeria, settings,
  notificações e favoritos bancários;
- adaptação server-side para domínios externos, como banco.

Arquivos centrais:

| Área | Arquivo | Papel atual |
|---|---|---|
| bootstrap | `fxmanifest.lua`, `web/index.html` | ordem e empacotamento |
| catálogo | `web/apps/registry.js` | valida e lista apps da home |
| shell/estado | `web/app.js` | store, lifecycle, render e listeners globais |
| contrato | `web/app_contract.js` | normalização de payloads |
| NUI API | `web/api.js` | POSTs NUI e event bus do browser |
| ponte client | `client/nui.lua` | callbacks e `SendNUIMessage` |
| entrada server | `server/callbacks.lua` | eventos de rede e contenção de exceções |
| domínio | `server/service.lua` | identidade, validação e regra |
| persistência | `server/repository.lua` | schema/migração e queries |
| segurança | `server/security.lua` | rate limit, sanitização e identidade |

### `mz_phone_server`

Processo Node/Express separado do FXServer, responsável por:

- servir `/audio`, `/core`, `/apps` e `/uploads`;
- validar e receber uma imagem por upload;
- salvar localmente, enviar ao Discord ou fazer ambos;
- devolver URL pública da mídia.

Ele não conhece `source`, `citizenid`, inventário, banco nem permissões de personagem. Portanto
não deve receber regras de negócio de novos apps.

## 2. Pontos fortes encontrados

- O `AppRegistry` exige `id`, `name`, `icon`, `order` e `render`, rejeitando duplicados.
- Os arquivos de app e CSS já são separados por domínio.
- O shell oferece componentes e tokens compartilhados, com tema claro/escuro.
- Apps não precisam montar a URL do resource: `PhoneAPI` centraliza os POSTs NUI.
- A cadeia server-side separa callbacks, serviço e repositório.
- `Security.RequireIdentity` resolve a identidade pelo `source`, sem confiar no frontend.
- Queries sensíveis observadas usam parâmetros e ownership por `owner_citizenid`.
- O upload verifica tamanho, MIME declarado e assinatura de JPEG/PNG/WebP.
- Nomes de upload usam UUID e criação exclusiva (`wx`).
- O adaptador `local_discord` mantém o upload local mesmo se o Discord falhar.

## 3. Divergências e riscos atuais

### 3.1 Catálogo duplicado e não conectado

A home usa somente `AppRegistry.getInstalledApps()`. `shared/apps.lua` não é lido pelo frontend,
e a tabela `mz_phone_apps` é criada/migrada, mas não possui fluxo de leitura/escrita de apps.

Consequências:

- `enabled` no Lua não controla a home;
- ordens do Lua e do JavaScript divergem;
- `notes` aparece na home sem entrada correspondente no catálogo Lua;
- `garage` existe no Lua, mas não possui app carregado;
- arquivos legados podem parecer ativos quando não estão no `index.html`.

Decisão para novos apps: o `AppRegistry` é a fonte efetiva até que um catálogo único seja
implementado. Prioridade recomendada: alta.

### 3.2 Contratos assíncronos inconsistentes

A maioria dos callbacks NUI responde `{ ok = true }` antes de a operação server-side terminar.
O resultado real chega em outro evento, muitas vezes como lista bruta. O Banco já possui
`requestId`, timeout e resposta correlacionada, mas os demais domínios variam entre `data`,
`photos`, `calls`, `notes` e listas diretas.

Risco: uma tela pode interpretar "callback aceito" como "operação concluída" ou ficar em loading
sem uma resposta de erro.

Decisão para novos apps: envelope `{ ok, error, requestId, data }`; `requestId` obrigatório quando
a ação precisa de resposta individual. Prioridade recomendada: alta.

### 3.3 Estado e listeners globais

`web/app.js` concentra shell, estado de todos os apps, mídia, chamadas e muitos listeners. Apps
também criam objetos globais e alguns registram listeners dentro de `onOpen` com flags globais.
Isso funciona, mas aumenta o risco de listener duplicado, closure antiga e conflito de nomes.

Decisão para novos apps: estado prefixado, listener ligado uma vez, handler global prefixado e
limpeza explícita de timers/modais. Refatorar o runtime para stores por app pode ser uma etapa
posterior. Prioridade recomendada: média.

### 3.4 Código legado de Imóveis

`realestate.js`, seu CSS, contratos, callbacks e grande parte do serviço permanecem no projeto,
mas não são carregados pelo `index.html` e o README informa que o app foi aposentado.

Risco: novos desenvolvedores podem copiar uma referência desativada e altamente acoplada.

Decisão: não usar como template. Remover em uma entrega própria depois de confirmar que não há
dependência de dados/migração. Prioridade recomendada: média.

### 3.5 URLs externas fixas

Há referências diretas a `fivem.mazinho.org/mz_phone_server` em CSS e JavaScript para wallpapers
e áudio, enquanto os READMEs dizem que cada cidade deve hospedar seu próprio serviço. A config
Lua atual não injeta uma `BaseUrl` de assets na NUI.

Riscos: dependência do domínio do desenvolvedor, quebra offline, deploy não reprodutível e
contradição operacional.

Decisão alvo: uma única `AssetsBaseUrl` configurável, enviada pelo servidor ao estado inicial,
com fallback para assets locais. Prioridade recomendada: alta.

### 3.6 Limites de segurança do serviço de upload

O `mz_phone_server` oferece boas validações de arquivo, mas usa um token estático e rate limit
em memória por IP. Como a captura ocorre no cliente e a configuração é compartilhada, o token
não deve ser tratado como segredo por personagem.

Outros pontos:

- `trust proxy` está sempre ativo; a porta Node deve ficar atrás do reverse proxy e bloqueada ao
  acesso direto;
- buckets por IP não possuem limpeza periódica;
- o limitador não é compartilhado entre múltiplas instâncias;
- não há política automática de retenção/remoção de uploads;
- `/health` expõe o caminho absoluto de assets;
- `DISCORD_USE_AS_PRIMARY` existe no exemplo de ambiente, mas não é usado em `server.js`.

Decisão alvo: autorização curta emitida pelo FXServer, rate limit persistente/compartilhado se
houver escala, retenção configurada e health público mínimo. Prioridade: alta para autorização;
média para os demais itens.

### 3.7 Tamanho das unidades centrais

Na data da análise, `web/app.js` e `server/service.lua` têm aproximadamente dois mil linhas cada.
O crescimento de novos domínios nesses arquivos aumentará custo de revisão e regressão.

Decisão alvo: quando um novo app tiver regra significativa, criar módulos por domínio e manter
os arquivos centrais como composição/roteamento. Isso exige ajustar a ordem no `fxmanifest.lua`
e `index.html`, mas não muda o contrato público. Prioridade recomendada: média.

## 4. Arquitetura alvo incremental

Sem reescrever o telefone, a evolução recomendada é:

1. Adotar imediatamente o padrão de nomes, payloads, segurança e checklist do documento oficial.
2. Centralizar a URL de assets e remover domínios fixos.
3. Criar um helper genérico de request correlacionado no `PhoneAPI`.
4. Unificar o catálogo de apps e eliminar `shared/apps.lua`/`mz_phone_apps` se não forem requisitos.
5. Extrair listeners e estado de domínios grandes de `app.js`.
6. Extrair serviços/repositórios por domínio sem mudar eventos públicos.
7. Evoluir autenticação do upload para tickets curtos emitidos pelo FXServer.
8. Remover código aposentado em mudança isolada e validada.

## 5. Critério para um novo app ser aprovado

Um novo app está pronto quando:

- possui dono claro para regra e persistência;
- não confia em identidade ou autorização enviada pela NUI;
- tem contrato de request/response documentado;
- não adiciona `fetch` direto nem URL de infraestrutura fixa;
- falha de forma segura quando dependências estão fora do ar;
- não vaza dados entre dois personagens;
- cobre estados visuais e lifecycle completo;
- passa validação sintática e roteiro manual;
- atualiza o padrão se introduzir uma capacidade arquitetural nova.

## 6. Documentos relacionados

- `docs/PADRAO_APPS.md`: padrão normativo e checklist.
- `docs/PADRAO_MEDIA_CAMERA_GALERIA.md`: contrato de mídia.
- `README.md`: instalação e operação do resource.
- `../mz_phone_server/README.md`: instalação, endpoints e operação do serviço externo.
