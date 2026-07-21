# MZ Bank no mz_phone — runtime do P6-E

Data: 2026-07-20  
Ambiente: MySQL/FiveM staging  
Estado: **APROVADO**

## P6E-RT-01 — notificação persistente e sem duplicidade

Pré-condições:

- dois jogadores online, ambos com celular e conta pública ativa;
- `mz_core`, `mz_economy`, `mz_bank` e `mz_phone` iniciados normalmente;
- P6-B aprovado;
- usar valor pequeno.

Passos:

1. Executar `restart mz_phone` e depois `restart mz_bank`; confirmar ausência de erro SQL.
2. No aplicativo bancário, transferir um valor pequeno para o segundo jogador e pressionar a
   confirmação duas vezes rapidamente.
3. Confirmar no remetente exatamente um aviso `Transferência enviada` com `-R$valor`.
4. Confirmar no destinatário exatamente um aviso `Transferência recebida` com `+R$valor`.
5. Copiar o `correlationId` exibido no comprovante e executar a query abaixo.
6. Confirmar duas linhas: uma `out`, uma `in`, sem terceira linha para a mesma referência.
7. Confirmar que o saldo movimentou uma única vez e que o extrato/comprovante usam a mesma
   referência oficial.

```sql
SELECT app_id, title, message,
       JSON_UNQUOTE(JSON_EXTRACT(data, '$.direction')) AS direction,
       JSON_UNQUOTE(JSON_EXTRACT(data, '$.correlationId')) AS correlation_id,
       COUNT(*) AS total
FROM mz_phone_notifications
WHERE JSON_UNQUOTE(JSON_EXTRACT(data, '$.correlationId')) = '<CORRELATION_ID_DO_COMPROVANTE>'
GROUP BY app_id, title, message, direction, correlation_id
ORDER BY direction;
```

Resultado esperado:

- resources iniciam sem erro e a evolução do schema é idempotente;
- exatamente dois registros, um por personagem/direção;
- cada jogador vê somente um preview;
- duplo clique/replay não duplica débito, crédito ou notificação;
- valor e `correlationId` correspondem ao comprovante e ao extrato;
- payload visual não expõe `citizenid`, source, rota, saldo ou cartão;
- nenhuma lógica financeira é executada pelo `mz_phone`.

Resultado real: **APROVADO** — após receber o roteiro consolidado, o usuário respondeu
“confirmado”. Isso registra que os avisos de envio e recebimento apareceram uma única vez, a
transferência não foi duplicada e nenhum erro de console foi informado. A query SQL, logs e
capturas não foram anexados e não são inventados neste documento.  
Status: **APROVADO**  
Executado por/data: **usuário / 2026-07-20**  
Observações/evidências: **confirmação textual fornecida pelo usuário após execução manual no
FiveM staging**.

## Decisão atual

```text
P6-E: [R] Aprovado em runtime
Casos aprovados: 1/1
Falhas: 0
Bloqueados: 0
Fase 6: [R] Aprovada em runtime
```
