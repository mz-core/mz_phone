# Padrão oficial para apps do `mz_phone`

Este documento é o contrato de arquitetura para criar, revisar e manter novos apps do telefone.
Ele descreve o padrão alvo compatível com o runtime atual e separa claramente o papel do
`mz_phone` do papel do `mz_phone_server`.

> Escopo: "app" neste documento é uma aplicação exibida dentro da NUI do telefone. Não é um
> resource FiveM independente nem um processo executado pelo `mz_phone_server`.

## 1. Decisões de arquitetura

1. O frontend de todo app é empacotado no resource `mz_phone`.
2. O cliente não é confiável. Autorização, identidade, saldo, posse e regras de negócio são
   sempre validados no servidor.
3. `PhoneAPI` é a única porta de saída da NUI para callbacks do resource.
4. `Service` contém regra de negócio; `Repository` contém somente persistência SQL.
5. Um domínio já pertencente a outro resource continua naquele resource. O telefone atua como
   adaptador e chama apenas exports/eventos server-side estáveis.
6. `mz_phone_server` serve arquivos públicos e recebe mídia. Ele não executa regra de negócio,
   não acessa o banco do personagem e não hospeda JavaScript remoto do app.
7. O formato normalizado no JavaScript usa `camelCase`. Banco e Lua podem usar `snake_case`,
   mas a conversão deve ocorrer uma vez no `AppContract` ou na borda da API.
8. Todo app precisa cobrir loading, vazio, erro, sucesso, tema claro e tema escuro.

## 2. Arquitetura e fluxo

```text
web/apps/<id>.js
        |
        v
web/api.js (PhoneAPI)
        |
        v
client/nui.lua (RegisterNUICallback)
        |
        v
server/callbacks.lua (evento mz_phone:server:*)
        |
        v
server/service.lua (identidade, autorização, validação, regra)
        |
        +--> server/repository.lua --> oxmysql
        |
        +--> export server-side de outro resource
        |
        v
evento mz_phone:client:* --> SendNUIMessage
        |
        v
web/api.js (listener) --> estado normalizado --> render
```

O POST feito por `PhoneAPI` normalmente confirma apenas que o callback NUI foi aceito. Ele não
confirma que a operação de domínio terminou. O resultado real volta de forma assíncrona por
evento. Quando a tela precisa aguardar um resultado individual, use `requestId`, timeout e um
mapa de promises, como o fluxo do app Banco.

## 3. Tipos de app

Antes de implementar, classifique o app:

| Tipo | Exemplo | Persistência/regra |
|---|---|---|
| Somente local | tela informativa ou calculadora | estado transiente na NUI |
| Domínio do telefone | notas, contatos | `Service` + `Repository` + tabelas `mz_phone_*` |
| Integração | banco, garagem, organização | domínio no resource dono; telefone usa adaptador server-side |
| Mídia | câmera, galeria, avatar | metadados no banco; arquivo público no `mz_phone_server` |

Não copie regra de um resource externo para `mz_phone`. Por exemplo, o telefone pode pedir uma
transferência ao `mz_bank`, mas não calcula saldo nem altera conta diretamente.

## 4. Estrutura mínima

```text
mz_phone/
|-- web/
|   |-- apps/<id>.js
|   |-- css/apps/<id>.css
|   |-- app_contract.js             # se houver payload de domínio
|   |-- api.js                      # se houver comunicação NUI
|   `-- index.html                  # inclusão explícita de CSS e JS
|-- client/nui.lua                  # callback NUI e ponte de retorno
|-- server/callbacks.lua            # entrada de rede protegida
|-- server/service.lua              # validação e regra do telefone
|-- server/repository.lua           # SQL, quando o telefone é dono dos dados
|-- shared/config.lua               # flags e limites operacionais
`-- sql/mz_phone.sql                # schema canônico
```

Os wildcards do `fxmanifest.lua` já empacotam `web/apps/*.js` e `web/css/apps/*.css`, mas o
`index.html` ainda precisa carregar cada arquivo explicitamente e na ordem correta.

### Ordem de carregamento da NUI

1. `apps/utils.js`
2. `apps/registry.js`
3. `app_contract.js`
4. `api.js`
5. componentes compartilhados
6. arquivos dos apps
7. `app.js`

## 5. Identidade e catálogo do app

Use um `id` imutável, em minúsculas, sem espaço e preferencialmente em inglês: `example`,
`garage`, `bank`. O mesmo identificador deve aparecer em nomes de estado, classes, eventos e
configurações.

```js
registerApp({
  id: "example",
  name: "Exemplo",
  icon: "circle",
  order: 90,

  onOpen(ctx) {
    ctx.patchState({
      exampleView: "list",
      exampleLoading: true,
      exampleError: "",
      exampleDraft: null,
    });

    window.ExampleApp.refresh();
  },

  onClose(ctx) {
    ctx.patchState({
      exampleModal: null,
      exampleDraft: null,
    });
  },

  render(ctx) {
    const state = ctx.getState();

    return `
      <div class="app-page example-page">
        <div class="app-header app-header--standard">
          <div class="app-header-left"></div>
          <div class="app-header-center">
            <div class="app-title">Exemplo</div>
          </div>
          <div class="app-header-right"></div>
        </div>
        <div class="app-content example-content">
          ${renderExampleBody(state)}
        </div>
      </div>
    `;
  },
});
```

O `AppRegistry` do JavaScript é hoje a fonte efetiva da home. O arquivo `shared/apps.lua` e a
tabela `mz_phone_apps` ainda não são consumidos pela NUI. Portanto:

- carregar ou remover o JS no `index.html` é o que instala ou desinstala visualmente um app;
- não assumir que `enabled = false` em `shared/apps.lua` esconderá um app carregado;
- enquanto não houver unificação do catálogo, manter `shared/apps.lua` apenas se algum código
  Lua futuro realmente consumir esse metadado;
- não criar uma terceira lista de apps.

## 6. Contexto e ciclo de vida

O contexto entregue por `createAppContext` expõe:

- `getState()` e `patchState(partial)`;
- `setState(nextState)`;
- `saveState()` para settings já autorizados pelo servidor;
- `renderCurrentApp()`;
- `openApp(id)`, `closeApp()` e `goHome()`;
- `contract` e `utils`.

Regras:

- `render` deve ser determinístico: recebe estado e retorna HTML, sem iniciar requests;
- `onOpen` inicializa estado transiente e solicita dados;
- `onClose` limpa modal, draft, timer e sessão específica do app;
- abrir novamente o mesmo app não chama `onOpen`; ações de refresh precisam ser explícitas;
- listeners de `PhoneAPI` devem ser ligados apenas uma vez durante a vida da NUI;
- timers e listeners próprios do DOM devem ser removidos ao fechar;
- handlers usados por `onclick` ficam em `window.<Nome>App`, com nomes prefixados e sem alterar
  DOM de outro app.

O padrão atual usa renderização integral por `innerHTML`. Depois de mudar estado, chame
`renderCurrentApp()` somente quando o app atual depender da alteração. Não guarde referência a
elementos entre renders.

## 7. Estado e contrato de dados

### Estado transiente

Toda chave deve ser prefixada pelo app:

```js
exampleItems: [],
exampleSelectedId: null,
exampleView: "list",
exampleLoading: false,
exampleSaving: false,
exampleError: "",
exampleDraft: { title: "" },
```

Inclua defaults em `DEFAULT_PHONE_STATE`. Não coloque estado de um app na raiz de
`AppContract`; `AppContract` normaliza dados, não é um store paralelo.

### Dados persistentes

Dados recebidos do servidor passam por uma função de normalização única:

```js
function normalizeExampleItem(item) {
  if (!item || typeof item !== "object") return null;

  return {
    id: item.id ?? null,
    title: String(item.title ?? "").trim(),
    createdAt: item.createdAt ?? item.created_at ?? "",
  };
}

window.AppContract.example = {
  get(state) {
    return (Array.isArray(state.exampleItems) ? state.exampleItems : [])
      .map(normalizeExampleItem)
      .filter(Boolean);
  },

  set(state, items = []) {
    return {
      ...state,
      exampleItems: (Array.isArray(items) ? items : [])
        .map(normalizeExampleItem)
        .filter(Boolean),
      exampleLoading: false,
    };
  },
};
```

Não persista todo o `phoneState`. O método server-side `Service.Save` aceita somente settings
permitidos. Dados do domínio usam operações próprias e tabelas próprias.

## 8. API, eventos e respostas

### Convenção de nomes

| Camada | Nome recomendado |
|---|---|
| `PhoneAPI` | `getExampleItems`, `createExampleItem` |
| callback NUI | `getExampleItems`, `createExampleItem` |
| entrada server | `mz_phone:server:getExampleItems` |
| retorno client | `mz_phone:client:receiveExampleItems` |
| action NUI | `receiveExampleItems` |
| listener JS | `onReceiveExampleItems` |
| service | `Service.GetExampleItems` |
| repository | `Repository.GetExampleItems` |

### Envelope padrão para novos retornos

```js
{
  ok: true,
  error: null,
  requestId: "opcional",
  data: {
    items: []
  }
}
```

Em erro:

```js
{
  ok: false,
  error: "example_not_found",
  requestId: "opcional",
  data: null
}
```

Use códigos de erro estáveis, em `snake_case`, e converta para texto amigável no app. Não envie
stack trace, SQL, `citizenid`, license, token ou detalhes internos ao NUI.

### Exemplo de saída da NUI

```js
// web/api.js
async getExampleItems() {
  return await post("getExampleItems", {});
},

async createExampleItem(payload) {
  return await post("createExampleItem", payload || {});
},
```

```lua
-- client/nui.lua
RegisterNUICallback('getExampleItems', function(_, cb)
    TriggerServerEvent('mz_phone:server:getExampleItems')
    ok(cb) -- aceito; o resultado chega em receiveExampleItems
end)
```

```lua
-- server/callbacks.lua
RegisterNetEvent('mz_phone:server:getExampleItems', function()
    local src = source
    runSafe('getExampleItems', src, function()
        Service.GetExampleItems(src)
    end)
end)
```

```lua
-- retorno Lua -> NUI
TriggerClientEvent('mz_phone:client:receiveExampleItems', source, {
    ok = true,
    data = { items = items }
})
```

O client converte esse evento com `SendNUIMessage`, e `api.js` emite o listener local. Mutations
devem retornar o registro canônico ou disparar uma lista atualizada; não faça atualização
otimista para dinheiro, propriedade, inventário ou qualquer operação irreversível.

## 9. Padrão server-side

### Service

Toda entrada de rede segue esta ordem:

1. aplicar rate limit específico;
2. resolver a identidade a partir de `source`;
3. validar tipo, enum, tamanho, formato e faixa;
4. verificar permissão/posse no servidor;
5. executar regra de negócio;
6. persistir ou chamar o resource dono;
7. devolver payload mínimo e normalizado.

Nunca aceite do cliente `citizenid`, dono, saldo, cargo autorizado, preço final ou URL privada
como verdade. O `source` do evento é a raiz de identidade.

### Repository

- somente SQL e mapeamento de linha;
- queries sempre parametrizadas;
- update/delete sempre incluem `owner_citizenid` ou outra condição de posse;
- `id` recebido do cliente é convertido e validado antes da query;
- listas possuem limite e paginação quando puderem crescer;
- schema canônico fica em `sql/mz_phone.sql` e migração compatível em `Repository.Prepare()`;
- índices cobrem proprietário, ordenação e chaves únicas do domínio.

### Integração com outro resource

- chamada somente server-side;
- verificar se o resource está iniciado;
- usar export documentado e tratar indisponibilidade sem quebrar o telefone;
- o resource dono repete autorização e validação;
- exports privilegiados validam `GetInvokingResource()` com allowlist;
- não enviar identificadores internos ao frontend se uma chave pública de domínio resolver.

## 10. Interface e CSS

Cada app possui `web/css/apps/<id>.css`. Classes internas começam com `<id>-`.

Reutilize:

- `.app-page` e `.app-content`;
- `.app-header--standard` com colunas `40px / 1fr / 40px`;
- `.app-back` e `.app-header-icon-btn`;
- `.app-surface-card`;
- `.app-section-heading-standard`;
- `.app-inline-notice`;
- `.app-state-view`;
- `.app-bottom-tabs` e `.app-bottom-tab`, quando houver pelo menos três áreas primárias.

Regras visuais e de acessibilidade:

- fundo e texto vêm de tokens de `tokens.css`;
- a cor do app é acento, não substitui todo o tema;
- texto auxiliar não fica abaixo de `11px`;
- ação principal tem pelo menos `44px` de altura;
- botão somente com ícone tem `aria-label`;
- conteúdo não cria uma segunda rolagem vertical;
- apps comuns não cobrem status bar, notch ou home indicator;
- fullscreen fica restrito a câmera e visualização de mídia;
- HTML vindo de estado ou servidor passa por `Utils.escapeHtml`/`escapeHtmlAttr`;
- nada de `alert`, `confirm`, `prompt` ou `fetch` direto no arquivo do app.

Use `PhoneDialog` para confirmação e `PhoneUI.notify` para feedback. Erros enquanto um app está
aberto usam, quando aplicável, `preventPreview: true`, `keepPhoneOpen: true` e `scope: "in-app"`.

## 11. Mídia e `mz_phone_server`

O serviço externo pode hospedar:

```text
/audio/...                    áudio público
/core/...                     wallpapers/avatar padrão
/apps/<id>/assets/...         imagens e mídia estática do app
/uploads/phone/...            uploads públicos persistidos
/api/mz-phone/upload          endpoint de upload
```

Não use `/apps` como loader remoto de JavaScript ou CSS. Código executável do telefone deve ser
versionado e empacotado no `mz_phone`, para que deploy, revisão e rollback tenham a mesma versão.

Para dados de mídia, o banco guarda URL e metadados; o arquivo binário fica no storage. Apps
consumidores recebem um ID persistido da galeria quando a operação exige prova de posse. Não
aceite uma URL livre enviada pela NUI para publicar conteúdo em outro domínio.

Produção:

- HTTPS obrigatório;
- porta Node acessível somente pelo reverse proxy;
- `UPLOAD_TOKEN` forte e fora do Git;
- limites de tamanho, MIME, assinatura e quantidade;
- política de retenção/backup dos uploads;
- `PUBLIC_BASE_URL` da própria cidade;
- nenhuma URL, VPS, webhook ou token do desenvolvedor no código distribuído.

O token estático atual reduz uploads anônimos, mas não identifica um personagem. Para apps com
mídia sensível, o padrão alvo é emitir pelo FXServer uma autorização curta e vinculada à
operação, validada pelo `mz_phone_server`. Até isso existir, trate o endpoint atual como storage
público com proteção básica, não como uma fronteira forte de autorização.

## 12. Observabilidade e falhas

- logs server-side usam ação e `source`, mascarando identificadores;
- cada erro retornável possui código estável;
- chamadas externas têm timeout e fallback explícito;
- estado de loading sempre termina em sucesso ou erro;
- duplo clique em mutation é bloqueado com `<id>Busy`;
- operações financeiras ou irreversíveis usam `requestId`/`correlationId` e idempotência;
- o app continua fechável mesmo quando uma integração está indisponível.

## 13. Checklist de implementação

### Planejamento

- [ ] Classificar o app: local, domínio do telefone, integração ou mídia.
- [ ] Definir dono da regra e dos dados.
- [ ] Definir payloads, códigos de erro, limites e permissões.
- [ ] Definir comportamento sem resource externo ou sem `mz_phone_server`.

### Frontend

- [ ] Criar `web/apps/<id>.js` e `web/css/apps/<id>.css`.
- [ ] Incluir CSS e JS no `web/index.html`.
- [ ] Registrar metadados únicos no `AppRegistry`.
- [ ] Adicionar estado prefixado em `DEFAULT_PHONE_STATE`.
- [ ] Adicionar normalização no `AppContract` quando houver payload persistente.
- [ ] Adicionar métodos/listeners no `PhoneAPI`, sem `fetch` no app.
- [ ] Limpar modal, draft, timer e sessão em `onClose`.
- [ ] Cobrir loading, vazio, erro, sucesso e ação desabilitada.
- [ ] Validar tema claro/escuro, foco, toque e escape de HTML.

### Ponte e servidor

- [ ] Criar callback em `client/nui.lua`.
- [ ] Criar ponte `RegisterNetEvent`/`SendNUIMessage` para a resposta.
- [ ] Criar entrada em `server/callbacks.lua` usando `runSafe`.
- [ ] Aplicar rate limit explícito em `shared/config.lua`.
- [ ] Resolver identidade e validar tudo em `Service`.
- [ ] Garantir ownership e queries parametrizadas em `Repository`.
- [ ] Atualizar schema e migração, quando necessário.
- [ ] Proteger integrações server-side e tratar resource indisponível.

### Entrega

- [ ] `node --check` em todos os JS alterados.
- [ ] validação sintática dos Lua, quando `luac` estiver disponível.
- [ ] testar abrir, fechar, Home, Escape, voltar e reabrir.
- [ ] testar requests repetidos, payload inválido e falta de permissão.
- [ ] testar com dois personagens para detectar vazamento de ownership.
- [ ] testar integração indisponível e timeout.
- [ ] testar em resolução do telefone, tema claro e tema escuro.
- [ ] documentar dependência, configuração, SQL e roteiro manual.

## 14. Referências internas

- `web/apps/notes.js`: CRUD simples pertencente ao telefone.
- `web/apps/bank.js` e `server/bank.lua`: integração com domínio externo e request correlacionado.
- `web/apps/gallery.js`: mídia persistida e picker.
- `docs/PADRAO_MEDIA_CAMERA_GALERIA.md`: contrato especializado de mídia.
- `docs/ANALISE_ARQUITETURA_MZ_PHONE.md`: diagnóstico do estado atual e prioridades.
- `../mz_phone_server/README.md`: operação do serviço externo.

Não use `realestate.js` como base para um app novo: o recurso está desativado no produto atual e
mantém código legado que ainda precisa ser removido ou isolado.
