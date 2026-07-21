# MZ Bank no mz_phone — estado de produção

Data: 2026-07-15  
Estado: **simulador removido; integração real bloqueada pelos gates arquiteturais**

O shell demonstrativo anterior foi retirado do fluxo de produção. O `mz_phone` não carrega
mais `web/apps/bank_service.js` e não contém nome, saldo, conta, extrato, cartão, destinatário
ou comprovante fictícios no app bancário.

Enquanto não existir uma API oficial do `mz_bank` com sessão/capability própria para o canal
`phone`, o app abre em fail-closed e mostra somente:

```text
Serviço bancário indisponível
Não foi possível conectar ao banco agora. Tente novamente mais tarde.
```

Não foram criados callbacks NUI, eventos, exports ou acesso financeiro improvisado. Os exports
atuais do `mz_bank` exigem sessão física de ATM/agência e não podem ser reutilizados pelo telefone.

Documentação atual:

- `MZ_BANK_APP_PRODUCTION_AUDIT.md` — diagnóstico, contratos e decisões;
- `MZ_BANK_APP_SECURITY_REVIEW.md` — revisão de segurança;
- `MZ_BANK_APP_STATIC_REVIEW.md` — validações estáticas;
- `MZ_BANK_APP_RUNTIME_CHECKLIST.md` — testes manuais pendentes.

Estados do roadmap preservados:

```text
Fase 2: [~] Em implementação
P2-A: [R] Aprovado em runtime
P2-B: [R] Aprovado em runtime
P2-C: [R] Aprovado em runtime
P2-D: [R] Aprovado em runtime
P2-E: [R] Aprovado em runtime; sem consumidor phone
P2-F: [R] Aprovado em runtime; transferência interna sem consumidor phone
Fase 6: [ ] Não iniciada
```

A interface real de saldo, rota, extrato, transferência e cartões só deve ser reintroduzida
quando as capabilities correspondentes forem fornecidas pelo servidor e aprovadas nos gates.
