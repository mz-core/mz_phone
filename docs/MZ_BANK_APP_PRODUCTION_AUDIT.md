# MZ Bank no mz_phone — auditoria para produção

Data: 2026-07-15  
Escopo: remoção do simulador e decisão sobre integração real  
Resultado: **produção fail-closed; backend phone ainda não autorizado**

## 1. Diagnóstico real

O app anterior era integralmente demonstrativo:

- `bank_service.js` declarava provider local e mantinha todos os dados em memória;
- nome, saldo, rota, extrato, cartão, destinatário e recibo eram fixos;
- transferência e bloqueio de cartão não alcançavam servidor;
- não existiam métodos bancários em `PhoneAPI`;
- não existiam callbacks NUI, eventos client/server ou service bancário no `mz_phone`;
- não existia contrato server-to-server autenticado entre `mz_phone` e `mz_bank`.

Esse simulador foi removido do carregamento de produção e o arquivo foi excluído. Não existe
fallback local quando `mz_bank` está indisponível.

## 2. Estado do roadmap

| Fase/lote | Estado real | Impacto no aplicativo |
|---|---|---|
| Fase 0 | `[S]` | base física validada estaticamente |
| Fase 1 | `[R]` | base física aprovada em runtime |
| P2-A | `[R]` | schema de identidade pública aprovado em runtime |
| P2-B | `[R]` | repository interno read-only aprovado em runtime; ainda sem consumidor público |
| P2-C | `[R]` | criação e DTO próprio aprovados no overview físico autenticado |
| P2-D | `[R]` | backfill controlado aprovado em 8/8 gates; runner e apply desligados |
| P2-E | `[R]` | resolução privada interna aprovada em runtime; sem callback ou consumidor phone |
| P2-F | `[R]` | transferência interna por token aprovada em runtime; sem callback/consumer phone |
| P2-G a P2-H | não implementados | sem cutover da NUI ou integração phone |
| Fase 3 | não aprovada | auditoria/outbox completa ainda não é gate aprovado para novo canal |
| Fase 4 | parcial | API compartilhada sem autenticação/capability completa de canal |
| Fase 5 | parcial | ciclo de cartão necessário ao MVP ainda não aprovado |
| Fase 6 | `[ ]` | sessão bancária de telefone não existe |

O próprio roadmap determina que a Fase 6 depende das Fases 2, 3 e 4 aprovadas e do ciclo de
cartão necessário ao MVP. Esses gates não foram satisfeitos.

## 3. Matriz de contratos reais

| Necessidade | Estado | Evidência e decisão |
|---|---|---|
| localizar conta do titular | disponível somente internamente | `MZBankRepository.getPublicAccountByOwner(citizenid)`; não é export/DTO e recebe identidade interna |
| validar rota pública | disponível somente internamente | `MZBankAccountIdentity.ValidateRoute` e repository por rota |
| criar conta própria | disponível somente no overview físico / P2-C | `MZBankAccountService.EnsurePersonalAccount` usa exclusivamente a identidade resolvida no servidor; feature permanece desligada por padrão |
| DTO público da conta própria | disponível somente no overview físico / P2-C | DTO seguro existe, mas não há contrato, sessão ou consumidor autorizado para `phone` |
| saldo oficial | disponível no bridge físico | `MZBankBridge.GetMoney` chama `mz_core`, mas overview exige token físico |
| overview | bloqueado para phone | export `GetAccountOverview` chama serviço que exige sessão ATM/agência autenticada |
| extrato | bloqueado para phone | `GetStatement` exige sessão física; bridge consulta `mz_economy`; não há paginação por cursor/offset |
| sessão/capability phone | ausente / Fase 6 | `CHANNEL_PERMISSIONS` contém somente `atm` e `branch` |
| validar chamador `mz_phone` | ausente / Fase 4/6 | exports atuais não formam uma API phone versionada/autorizada |
| resolver destinatário por rota | interno / P2-E `[R]` | serviço privado aprovado, sem callback ou consumidor phone |
| preview/intent curto | interno / P2-E `[R]` | `resolutionToken` aprovado somente server-side; não está publicado para NUI/phone |
| transferência por conta pública | interno / P2-F `[R]` | contrato server-side aprovado; transferência atual ainda resolve server ID até o P2-G |
| confirmação idempotente phone | bloqueada | idempotência física existe, mas não há sessão, intent ou contrato phone |
| cartões no phone | bloqueado / Fase 5/6 | `GetCards` e `BlockCard` exigem sessão de agência |
| comprovante correlacionado phone | bloqueado / Fase 3/4/6 | não há DTO/API phone nem gate de auditoria aprovado |

## 4. Decisões arquiteturais

1. Não reutilizar token de ATM/agência no telefone.
2. Não criar `channel = phone` client-controlled.
3. Não adicionar callbacks NUI sem consumidor bancário autorizado.
4. Não chamar `mz_core` ou `mz_economy` a partir do `mz_phone`.
5. Não consultar tabelas do `mz_bank` a partir do `mz_phone`.
6. Não usar exports físicos atuais como se fossem uma API phone.
7. Não expor repository interno ou identidade interna em DTO.
8. Não habilitar transferência ou cartões enquanto capabilities server-side não existirem.
9. Manter o ícone registrado, mas abrir uma tela limpa de indisponibilidade.
10. Falhar fechado sem dados substitutos quando o backend não estiver pronto.

## 5. Comportamento de produção entregue

- app continua registrado como `MZ Bank`;
- usa o shell, header, temas e state view compartilhados do `mz_phone`;
- abre sem dados bancários;
- apresenta apenas indisponibilidade e retry local seguro;
- não mostra tabs ou ações sem capability real;
- fechar o app limpa erro, overview e capabilities;
- reabrir não recupera dados, drafts ou tokens;
- nenhum mock é carregado pelo `index.html`.

## 6. DTOs alvo — não implementados

Os DTOs abaixo documentam o limite futuro. Eles não estão publicados nem conectados.

### Overview próprio

```text
{
  ok,
  displayName,
  balance,
  account: {
    branch,
    accountNumberMasked,
    checkDigit,
    accountType,
    accountTypeLabel,
    status,
    statusLabel
  },
  updatedAt,
  capabilities: {
    statement,
    transfer,
    cards
  }
}
```

Proibidos: `citizenid`, `source`, license, ID SQL, owner ID, saldo enviado pela NUI,
metadata interna e segredos de cartão.

### Extrato

```text
{
  ok,
  items: [{ type, description, amount, occurredAt, publicCounterparty }],
  nextCursor,
  hasMore
}
```

O cursor deve ser opaco e a consulta deve ser realizada pelo `mz_bank` sobre o contrato real do
`mz_economy`. Não foi implementado porque o contrato atual aceita apenas `limit`.

### Transferência

Nenhum DTO de transferência foi publicado. O P2-E já aprovou resolução privada, nome parcial e token
curto; o P2-F e os lotes consumidores ainda precisam implementar confirmação revalidada,
idempotency key e integração sem expor identificadores internos.

## 7. Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `web/index.html` | remove carregamento do provider demonstrativo |
| `web/apps/bank_service.js` | removido do projeto |
| `web/apps/bank.js` | substituído por app fail-closed sem dados/ações fictícias |
| `web/css/apps/bank.css` | reduzido ao ícone e estado profissional de indisponibilidade |
| `web/app.js` | remove estados mock, cartões, extrato, draft, preview e recibo demonstrativos |
| `docs/MZ_BANK_APP_UI_SHELL.md` | registra aposentadoria do shell demo |
| `docs/PADRAO_APPS.md` | padrão visual compartilhado preservado |
| `docs/MZ_BANK_APP_PRODUCTION_AUDIT.md` | esta auditoria |
| `docs/MZ_BANK_APP_SECURITY_REVIEW.md` | revisão de segurança |
| `docs/MZ_BANK_APP_STATIC_REVIEW.md` | evidências estáticas |
| `docs/MZ_BANK_APP_RUNTIME_CHECKLIST.md` | testes manuais pendentes |
| `mz_bank/BANK_ROADMAP.md` | nota documental na Fase 6, sem alterar seu estado |

Nenhum Lua, serviço financeiro, schema, tabela, migration, export ou callback foi adicionado.

## 8. Funcionalidades bloqueadas

| Funcionalidade | Motivo |
|---|---|
| saldo real | overview phone autenticado não existe |
| conta pública própria | P2-C existe somente no overview físico autenticado; feature desligada e sem integração `phone` |
| extrato real | sem sessão phone e sem paginação pública |
| transferência real | P2-F interno aprovado; API/sessão phone e cutover ainda ausentes |
| cartões | contrato atual pertence à sessão de agência; Fase 5 incompleta |
| comprovante | canal phone/auditoria/API correlacionada ainda não aprovados |

## 9. Próxima sequência segura

1. implementar P2-G/P2-H sem antecipar contratos;
2. concluir os gates das Fases 3 e 4;
3. aprovar o ciclo de cartão exigido pelo MVP;
5. desenhar sessão/capability do aparelho e API phone versionada;
6. somente então implementar a ponte NUI/client/server e reabrir capabilities reais.

## 10. Decisão

```text
Simulador em produção: REMOVIDO
Fallback mock: INEXISTENTE
Dados bancários reais no phone: BLOQUEADOS PELO ROADMAP
Operações reais no phone: NÃO IMPLEMENTADAS
Fase 6: [ ] NÃO INICIADA
Runtime: NÃO APROVADO
```
