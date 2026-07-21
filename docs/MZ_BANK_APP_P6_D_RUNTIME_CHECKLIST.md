# MZ Bank no mz_phone — runtime do P6-D

Data: 2026-07-19  
Ambiente: MySQL/FiveM staging  
Estado: **APROVADO**

## P6D-RT-01 — ciclo completo do favorito

Pré-condições:

- dois jogadores online com contas públicas ativas;
- recursos iniciados na ordem normal;
- usar valor pequeno;
- P6-B já aprovado.

Passos:

1. Executar `refresh` e `restart mz_phone`; confirmar ausência de erro SQL.
2. Fazer uma transferência pequena para o segundo jogador.
3. No comprovante, tocar em `Salvar nos favoritos`.
4. Voltar ao overview e confirmar favorito com nome parcial e conta mascarada.
5. Fechar/reabrir o telefone e depois reiniciar `mz_phone`; confirmar que o favorito permanece.
6. Selecionar o favorito, informar outro valor pequeno e concluir a transferência.
7. Confirmar que a tela ainda apresenta o destinatário antes do débito e que somente uma
   movimentação ocorreu.
8. Remover o favorito e confirmar que ele desaparece depois de fechar/reabrir o aplicativo.

Resultado esperado:

- tabela é criada idempotentemente e o resource inicia sem erro;
- favorito persiste no reopen/restart;
- conta aparece mascarada e nenhum ID interno é exibido;
- uso do favorito passa pela confirmação normal e movimenta saldo uma única vez;
- remover afeta somente o favorito do personagem;
- saldos e extrato refletem apenas as duas transferências reais;
- nenhuma transferência offline ou saldo paralelo é criado.

Resultado real: **APROVADO** — após executar o fluxo solicitado no MySQL/FiveM staging, o usuário
confirmou “certinho”. Isso registra que o favorito foi salvo, permaneceu após reabrir/reiniciar,
foi usado em nova transferência e foi removido corretamente. Não foram fornecidos logs, capturas
ou queries adicionais.  
Status: **APROVADO**  
Executado por/data: **usuário / 2026-07-19**

Consulta opcional:

```sql
SHOW CREATE TABLE mz_phone_bank_favorites;

SELECT label, branch,
       CONCAT('****', RIGHT(account_number, 4), '-', check_digit) AS account_masked,
       account_type, created_at, updated_at
FROM mz_phone_bank_favorites
WHERE owner_citizenid = '<CITIZENID_DO_TESTE>';
```

Não copiar nem enviar `owner_citizenid` para a NUI.

## Decisão final

```text
P6-D: [R] Aprovado em runtime
Casos aprovados: 1/1
Falhas: 0
Bloqueados: 0
Fase 6: [~] Em implementação
```
