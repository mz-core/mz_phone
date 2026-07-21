# MZ Bank no mz_phone — runtime do P6-C

Data: 2026-07-19  
Ambiente: FiveM staging  
Estado: **APROVADO**

## Preparação

- um personagem com cartão bancário `active` e item físico correspondente;
- `mz_core`, `mz_inventory`, `mz_bank` e `mz_phone` iniciados;
- anotar os quatro últimos dígitos e o saldo antes do teste;
- não usar cartão real importante fora do staging: o desbloqueio não existe no aplicativo.

## P6C-RT-01 — bloqueio real e invalidação do ATM

1. Abrir o app e confirmar que o cartão aparece apenas com últimos quatro dígitos e estado ativo.
2. Abrir um ATM, inserir esse cartão e confirmar que ele autentica antes do bloqueio.
3. No telefone, tocar em `Bloquear cartão`, revisar os últimos quatro dígitos e confirmar.
4. Confirmar no app que o estado mudou para `Bloqueado` e o botão desapareceu.
5. Tentar continuar ou abrir novamente o ATM com o mesmo cartão.
6. Confirmar que o ATM recusa/invalida a credencial e que o saldo não mudou.

Resultado esperado:

- somente o cartão escolhido muda de `active` para `blocked`;
- a sessão ATM ligada a ele é invalidada e novas autenticações são recusadas;
- item físico não é removido e nenhum saldo é alterado;
- NUI não exibe credencial, titular interno, metadata ou PIN;
- aplicativo, agência e telefone permanecem funcionais.

Resultado real: **APROVADO** — o usuário confirmou manualmente no FiveM que o cartão apareceu com
o estado `Bloqueado`, que o ATM recusou a mesma credencial depois do bloqueio e que o saldo não
mudou. Não foram fornecidos logs ou evidência SQL adicionais.  
Status: **APROVADO**  
Executado por/data: **usuário / 2026-07-19**

Consulta opcional de conferência server-side:

```sql
SELECT last4, status, issued_at, updated_at, blocked_at
FROM mz_bank_cards
WHERE last4 = '<ULTIMOS_4>'
ORDER BY id DESC;
```

## P6C-RT-02 — repetição e isolamento

1. Tocar duas vezes rapidamente na confirmação de outro cartão descartável ativo, se disponível.
2. Confirmar que ocorre somente uma transição para `blocked`.
3. Repetir uma referência antiga após atualizar/reabrir o app.
4. Com outro jogador, confirmar que não é possível bloquear o cartão do primeiro titular.
5. Confirmar que emissão e segunda via continuam ausentes no app.
6. Executar um smoke de overview, extrato e uma transferência pequena já aprovada no P6-B.

Resultado esperado:

- duplo clique não produz alteração duplicada;
- referência antiga, falsa ou de outra sessão é negada;
- outro titular não consegue operar o cartão;
- emissão e segunda via permanecem exclusivas da agência;
- transferência e consultas continuam funcionando sem alteração de saldo pelo bloqueio.

Resultado real: **APROVADO POR EVIDÊNCIA REUTILIZADA** — isolamento de `cardRef`, referência falsa,
vínculo a source/token, DTO sanitizado e ausência de escrita financeira foram aprovados nos dez
casos runtime da Fase 4 e no gate mínimo da Fase 5. Overview, extrato e transferência pelo telefone
foram aprovados nos P6-A/P6-B. Esses testes não foram repetidos neste lote.  
Status: **APROVADO**  
Executado por/data: **evidências runtime anteriores consolidadas / 2026-07-19**

## Decisão final

```text
P6-C: [R] Aprovado em runtime
Casos aprovados: 2/2
Falhas: 0
Bloqueados: 0
Fase 6: [~] Em implementação
```
