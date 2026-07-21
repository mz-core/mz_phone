# MZ Bank no mz_phone — revisão estática

Data: 2026-07-15  
Estado: **APROVADO ESTATICAMENTE para remoção do mock e fail-closed**

## 1. Sintaxe

| Validação | Resultado |
|---|---|
| todos os `web/apps/*.js` com `node --check` | APROVADO |
| `web/app.js` com `node --check` | APROVADO |
| `web/api.js` com `node --check` | APROVADO |
| todos os Lua do `mz_phone` com `luac -p` | APROVADO |
| chaves de `web/css/apps/bank.css` | APROVADO — 15 aberturas / 15 fechamentos |

## 2. Remoção do simulador

| Verificação | Resultado |
|---|---|
| `web/apps/bank_service.js` inexistente | APROVADO |
| `index.html` não carrega provider demonstrativo | APROVADO |
| produção sem nomes/valores/contas/cartões/referências mock | APROVADO |
| produção sem banner/laboratório/simulação | APROVADO |
| ausência de fallback mock | APROVADO |

## 3. Isolamento

Busca no novo `bank.js` confirmou ausência de:

```text
PhoneAPI
fetch(
mz_core
mz_economy
citizenid
serverId / server_id
ownerId
targetId
localStorage
sessionStorage
```

Resultado: **APROVADO**. A ausência de `PhoneAPI` é intencional enquanto não houver contrato real.

## 4. Harness de ciclo de vida

O registro e os handlers reais do app foram carregados em ambiente JavaScript isolado.

```text
registration: ok
failClosed: ok
retry: ok
capabilitiesHidden: ok
cleanup: ok
```

O retry não cria dados nem capabilities. O fechamento remove o handler global e limpa estado.

## 5. Contratos bancários

- nenhum export inexistente foi usado;
- nenhum export físico foi reutilizado;
- nenhum callback/evento foi inventado;
- `mz_bank`, `mz_core` e `mz_economy` não foram alterados;
- nenhuma migration ou tabela foi criada.

## 6. Limitações

- validação estática não comprova apresentação na resolução real da NUI;
- nenhum dado real foi testado, pois o contrato não existe;
- nenhum teste financeiro foi executado;
- Fase 6 permanece não iniciada.

## 7. Decisão

```text
Remoção do mock: APROVADA ESTATICAMENTE
Fail-closed: APROVADO ESTATICAMENTE
Integração real: NÃO IMPLEMENTADA
Runtime FiveM: NÃO EXECUTADO
```
