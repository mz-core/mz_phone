# MZ Bank no mz_phone — revisão de segurança

Data: 2026-07-15  
Resultado: **fail-closed aprovado estaticamente; integração real não existe**

## 1. Limites preservados

- `mz_core` permanece a única fonte de identidade, saldo, persistência, cache, locks e movimentação.
- `mz_economy` permanece a única fonte de ledger/extrato.
- `mz_bank` permanece o único domínio autorizado para intermediar serviços financeiros.
- `mz_phone` não recebeu tabela financeira, repository bancário, saldo, ledger ou cache.
- nenhuma transferência offline foi criada.

## 2. Superfície removida

- provider mock e dados hardcoded removidos;
- nenhuma transferência ou alteração de cartão local;
- nenhum recibo ou referência local;
- nenhum laboratório de cenários;
- nenhum fallback silencioso;
- nenhuma capability definida pelo frontend.

## 3. Superfície não criada

- zero callbacks NUI bancários;
- zero eventos client/server bancários;
- zero exports phone no `mz_bank`;
- zero chamada direta ao `mz_core`/`mz_economy`;
- zero acesso a tabelas do `mz_bank` pelo telefone;
- zero identidade interna recebida da NUI;
- zero token, intent ou idempotency key persistido no frontend.

## 4. Motivo do bloqueio

Os exports atuais do `mz_bank` exigem sessão física e token associado a `atm` ou `branch`.
Transferência resolve server ID; cartões exigem agência. Reutilizá-los no telefone quebraria a
separação de canal e a validação aprovada na Fase 0.

A conta pública possui schema e repository interno read-only, mas `Config.PublicAccount.Enabled`
continua `false`. Não existe criação idempotente, DTO próprio, resolução privada, token de preview
ou transferência por rota.

## 5. Estado sensível

Ao fechar o app são limpos:

- erro de conexão;
- overview;
- capabilities.

Não há draft, destinatário, saldo, extrato, cartão, comprovante ou token no estado atual.

## 6. Riscos remanescentes

| Risco | Estado |
|---|---|
| jogador interpretar indisponibilidade como defeito | aceitável e explícito; não são inventados dados |
| app ficar permanentemente indisponível | esperado até gates e contratos serem concluídos |
| futuro desenvolvedor ligar export físico ao phone | bloqueado documentalmente; exige revisão própria |
| identidade preexistente no perfil geral do telefone | fora do app bancário; não é consumida pelo banco |
| runtime visual não testado nesta execução | pendente no checklist separado |

## 7. Decisão

O estado entregue é mais restritivo que o simulador e não amplia a superfície financeira. Ele não
é aprovação para integração real; apenas garante que produção não exibe nem executa dados falsos.
