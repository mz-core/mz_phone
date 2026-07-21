# Padrao de Apps do mz_phone

Este documento define o padrao atual recomendado para criar e manter apps no `mz_phone`.

## Arquitetura atual

O NUI do telefone e carregado por `web/index.html`. A ordem central e:

1. `apps/utils.js`
2. `apps/registry.js`
3. `app_contract.js`
4. `api.js`
5. componentes compartilhados
6. apps em `web/apps/*.js`
7. `app.js`

Cada app registra a si mesmo com `registerApp`. O `AppRegistry` valida `id`, `name`, `icon`, `order` e `render`.

## Contrato minimo de um app

```js
registerApp({
  id: "example",
  name: "Example",
  icon: "circle",
  order: 90,

  onOpen(ctx) {
    ctx.patchState({
      exampleView: "list",
      exampleLoading: false,
      exampleError: "",
    });
  },

  onClose(ctx) {
    ctx.patchState({
      exampleModal: null,
    });
  },

  render(ctx) {
    const state = ctx.getState();
    return `
      <div class="app-page example-page">
        <div class="app-header app-header--standard">
          <div class="app-header-left"></div>
          <div class="app-header-center">
            <div class="app-title">Example</div>
          </div>
          <div class="app-header-right"></div>
        </div>
        <div class="app-content example-content"></div>
      </div>
    `;
  },
});

window.ExampleApp = {
  refresh() {
    window.PhoneAPI?.getExample?.();
  },
};
```

## Contexto entregue ao app

`createAppContext` em `web/app.js` entrega:

- `getState()`
- `patchState(partial)`
- `setState(nextState)`
- `saveState()`
- `renderCurrentApp()`
- `openApp(id)`
- `closeApp()`
- `goHome()`
- `contract`
- `utils`

Use esse contexto dentro de `onOpen`, `onClose` e `render`. Dentro de handlers globais expostos em `window.<AppName>App`, use `window.PhoneApp`, `window.PhoneAPI`, `window.PhoneUI` e `window.AppContract`.

## Estado

Regras:

- Estado transiente deve ser prefixado pelo app, por exemplo `notesView`, `messagesSearch`, `realEstateLoading`.
- Dados persistentes devem ter normalizacao em `AppContract` quando a estrutura vier do servidor ou puder variar.
- Nao criar stores paralelos globais se o dado precisa sobreviver a renderizacao.
- Depois de `patchState`, chamar `PhoneApp.renderCurrentApp()` quando a tela atual precisar refletir a mudanca imediatamente.

## API

Apps devem chamar apenas `PhoneAPI`. A cadeia correta e:

```txt
app JS -> PhoneAPI -> RegisterNUICallback client/nui.lua -> server event -> service/repository -> receive event -> PhoneAPI listener -> state/render
```

Nao criar fetch direto nos apps para endpoints NUI. Isso evita divergencia de payload e facilita logs/rate limit.

## Dialogos globais

Apps nao devem usar popups nativos do navegador:

- `window.confirm`
- `window.alert`
- `window.prompt`

Use o servico global do telefone:

```js
const ok = await window.PhoneDialog.confirm({
  title: "Remover anuncio?",
  message: "Este anuncio sera arquivado e nao aparecera mais na lista publica.",
  confirmText: "Remover",
  cancelText: "Cancelar",
  tone: "danger",
  app: "realestate",
});

if (ok) {
  // executar acao
}
```

Tambem e aceito callback quando o app preferir manter o handler curto:

```js
window.PhoneDialog.confirm({
  title: "Remover foto?",
  message: "Esta foto sera removida do anuncio.",
  confirmText: "Remover",
  cancelText: "Cancelar",
  tone: "danger",
  onConfirm: () => window.RealEstateApp.removePhotoNow(listingCode, photoId),
});
```

O dialog renderiza dentro do shell do celular, nao fecha o app, nao ativa preview/peek e o botao Home/Escape fecha apenas o dialog quando ele esta aberto. Tons suportados: `default`, `danger`, `warning` e `success`.

## Eventos recebidos

`api.js` escuta `window.message` e emite callbacks locais. O padrao recomendado e:

- Normalizar lista no ponto de entrada quando possivel.
- Atualizar `phoneState` em `app.js`.
- Renderizar somente se o app atual depender daquele dado.
- Tratar erro de dominio com mensagem especifica, nao com erro generico.
- Fluxos de midia entre apps devem retornar IDs persistidos do dominio (`galleryPhotoId`, por exemplo), nunca aceitar URL livre digitada/enviada pela NUI para gravar dados publicos.
- Notificacoes de erro dentro de app devem usar `{ preventPreview: true, keepPhoneOpen: true, scope: "in-app" }`.

## CSS

Cada app deve ter arquivo proprio em `web/css/apps/<id>.css`.

Regras:

- Usar classes prefixadas pelo app.
- Reutilizar `.app-page`, `.app-header--standard`, `.app-content`, `.app-back`, `.app-header-icon-btn`.
- Nao depender de seletor global fragil para layout interno.
- Manter estados de loading, vazio, erro e sucesso.

## Padrao visual oficial

O visual deve parecer parte do telefone antes de parecer parte de uma marca especifica.
O app pode ter uma cor de destaque, uma hero card ou uma capa propria, mas deve preservar
o shell, a geometria e os comportamentos compartilhados.

### Estrutura

- A raiz usa `.app-page` sem margem negativa e sem aumentar artificialmente a altura.
- O fundo normal vem de `var(--screen-bg)` e deve funcionar nos temas claro e escuro.
- O cabecalho usa `.app-header--standard`, com tres colunas de `40px / 1fr / 40px`.
- A area rolavel usa `.app-content`; nao criar uma segunda rolagem para a mesma tela.
- Apps comuns nao desenham por cima da status bar, notch ou home indicator.
- Fullscreen e reservado para camera, visualizador de midia e fluxos equivalentes.

### Tipografia e toque

- Titulo de tela: `20px` pelo componente compartilhado.
- Titulo de linha/card: entre `14px` e `16px`.
- Texto secundario: entre `12px` e `14px`.
- Texto auxiliar nunca deve ficar abaixo de `11px`, salvo marcador puramente decorativo.
- Controles principais devem ter ao menos `44px` de altura.
- Icon buttons devem ter area de toque entre `32px` e `40px`.

### Superficies e componentes

- Usar `.app-surface-card` para superficies neutras.
- Usar `.app-section-heading-standard` para titulo e subtitulo de uma secao.
- Usar `.app-inline-notice` para aviso curto que nao bloqueia a tela.
- Usar `.app-state-view` para loading, vazio, indisponivel, erro e sucesso.
- Cards usam os tokens `--app-card-bg`, `--app-card-border` e `--app-card-text`.
- A cor propria do app e um acento; nao deve substituir todos os tokens do telefone.

### Tabs inferiores

Tabs inferiores so devem existir quando o app possui tres ou mais areas primarias.
Quando usadas:

- aplicar `.app-bottom-tabs` no container;
- aplicar `.app-bottom-tab` em cada item;
- limitar a quatro ou cinco itens curtos;
- reservar `82px` no fim do `.app-content`;
- usar o mesmo fundo do shell e uma divisoria superior;
- nao criar uma barra flutuante sobre o conteudo.

O app Chamadas e a referencia de comportamento. Apps com navegacao simples devem preferir
cabecalho e botao Voltar.

### Tema e rolagem

- Todo app deve ser legivel com `data-theme="dark"` e `data-theme="light"`.
- Nao fixar fundo escuro na pagina inteira sem variante clara.
- O padrao atual oculta visualmente a scrollbar, preservando a rolagem.
- Se uma scrollbar visivel for realmente necessaria, ela deve ser uma decisao global do shell,
  nao uma excecao isolada de um app.

### Estados e mensagens

- Loading nao pode deslocar ou duplicar o shell.
- Vazio explica o que falta e oferece no maximo uma proxima acao.
- Erro informa o dominio e permite retry quando seguro.
- Acao desabilitada deve explicar por que esta indisponivel.
- Avisos de ambiente de teste devem ser claros, compactos e nao competir com o conteudo principal.

### Revisao visual obrigatoria

- [ ] Raiz sem margem negativa ou overflow acidental.
- [ ] Cabecalho alinhado ao restante dos apps.
- [ ] Textos auxiliares com pelo menos `11px`.
- [ ] Botoes principais com pelo menos `44px`.
- [ ] Tema claro e escuro conferidos.
- [ ] Conteudo nao fica escondido por tabs ou home indicator.
- [ ] Loading, vazio, erro e sucesso conferidos.
- [ ] Abrir, voltar, fechar e reabrir nao preserva modal ou draft indevido.
- [ ] Nao existem `alert`, `confirm`, `prompt` ou `fetch` direto no app.

## Adicao de novo app

Checklist:

- [ ] Criar `web/apps/<id>.js`.
- [ ] Criar `web/css/apps/<id>.css`.
- [ ] Incluir ambos em `web/index.html`.
- [ ] Incluir `web/apps/*.js` e CSS ja cobertos no `fxmanifest.lua` se o padrao wildcard continuar.
- [ ] Registrar no `shared/apps.lua` se o app deve aparecer/ser configuravel pelo lado Lua.
- [ ] Adicionar estado default em `DEFAULT_PHONE_STATE` se houver estado transiente.
- [ ] Adicionar contrato em `AppContract` se houver dados persistentes ou payloads variaveis.
- [ ] Adicionar metodos em `PhoneAPI` e callbacks Lua somente se o app falar com servidor.
- [ ] Documentar validacao manual.

## Antipadroes a evitar

- App chamando `fetch("https://mz_phone/...")` diretamente.
- App alterando DOM fora do seu container sem necessidade.
- Duplicar normalizacao de payload em cada app.
- Guardar dado persistente so em variavel local.
- Acoplar app novo a detalhe interno de outro app sem usar contrato.
- Misturar fluxo standalone e fluxo picker sem `PhoneMedia`.
