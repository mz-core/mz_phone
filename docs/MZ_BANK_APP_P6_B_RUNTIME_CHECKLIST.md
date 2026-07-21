# MZ Bank no mz_phone — runtime do P6-B

Data: 2026-07-19  
Ambiente: FiveM staging  
Estado: **APROVADO**

## Preparação

- dois jogadores online, A e B;
- ambos com conta pública ativa;
- anotar saldo bancário inicial de A e B;
- obter de B a agência, número da conta e dígito mostrados no app;
- usar valor pequeno, por exemplo `10`.

## P6B-RT-01 — transferência e comprovante

1. No jogador A, abrir `MZ Bank > Transferir`.
2. Informar a rota pública completa de B e o valor `10`.
3. Avançar e conferir nome parcial e conta mascarada.
4. Confirmar uma única vez.
5. Conferir tela de sucesso e `correlationId` no comprovante.
6. Voltar ao overview e conferir saldo/extrato de A.
7. Conferir saldo/extrato de B.

Resultado esperado:

- A diminui exatamente `10 + taxa`;
- B aumenta exatamente `10`;
- extratos têm uma saída e uma entrada correspondentes;
- comprovante apresenta o mesmo `correlationId` oficial;
- nenhum erro Lua/JS ou identificador interno aparece.

Resultado real: **APROVADO** — o usuário confirmou manualmente no FiveM que a transferência com
os dois jogadores online foi concluída corretamente. A negação anterior do destinatário offline
também permaneceu conforme a política. Não foram fornecidos logs, capturas ou evidências SQL
adicionais.  
Status: **APROVADO**  
Executado por/data: **usuário / 2026-07-19**

## P6B-RT-02 — repetição e negações

1. Iniciar nova transferência pequena e tocar rapidamente duas vezes em confirmar.
2. Confirmar que somente uma movimentação ocorreu.
3. Tentar a própria conta e confirmar negação.
4. Tentar conta/dígito inválido e confirmar resposta mínima.
5. Parar `mz_bank` e confirmar que o app falha fechado sem fechar o telefone.

Resultado esperado:

- duplo clique não duplica saldo, ledger ou comprovante;
- autotransferência e rota inválida são negadas;
- nenhum `citizenid`, token ou server ID é exibido;
- indisponibilidade não usa dados fictícios.

Resultado real: **APROVADO** — o usuário declarou o P6-B aprovado e confirmou especificamente que
o duplo clique não duplicou a transferência. A negação de destinatário offline e o comportamento
fail-closed do app sem o `mz_bank` já haviam sido confirmados manualmente. Não foram fornecidos
artefatos individuais adicionais para cada vetor negativo.  
Status: **APROVADO**  
Executado por/data: **usuário / 2026-07-19**

Evidências textuais preservadas: “foi assim mesmo” para a negação offline e “P6-B aprovado,
transferência online e duplo clique passaram” para a conclusão do lote.

## Decisão final

```text
P6-B: [R] Aprovado em runtime
Casos aprovados: 2/2
Falhas: 0
Bloqueados: 0
Fase 6: [~] Em implementação
```
