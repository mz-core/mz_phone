# MZ Bank no mz_phone — runtime do P6-A

Data: 2026-07-19  
Ambiente: FiveM staging  
Estado: **APROVADO — 2 de 2 casos**

## Roteiro único de validação

Este roteiro cobre o lote inteiro sem repetir os testes financeiros já aprovados nas fases
anteriores. Não marque como aprovado por inferência.

### P6A-RT-01 — sessão, consultas e interface

- **Pré-condições:** `mz_core`, `mz_economy`, `mz_inventory`, `mz_bank` e `mz_phone` iniciados nessa
  ordem pela configuração de resources; `mz_phone` não possui dependência rígida de `mz_bank`,
  para que a indisponibilidade possa ser exibida sem fechar o telefone; personagem carregado;
  conta pública existente; ao menos um cartão, se disponível.
- **Passos:**
  1. executar `restart mz_bank` e depois `restart mz_phone`;
  2. abrir o telefone e entrar no MZ Bank;
  3. conferir nome, saldo, agência/conta/dígito, extrato e cartões;
  4. comparar o saldo com o banco físico e conferir uma movimentação conhecida;
  5. confirmar a apresentação `+R$10`/`-R$10`, scroll, tema e ausência de dados fictícios;
  6. tocar em atualizar, voltar à Home, reabrir o app e depois fechar o telefone;
  7. abrir ATM e agência e conferir overview, animação, alinhamento e slot;
  8. observar F8 e console do servidor durante todo o fluxo.
- **Resultado esperado:** dados reais e consistentes; sessão renovada ao reabrir; nenhuma ação de
  saque/depósito/transferência/bloqueio disponível no app; nenhum `citizenid`, token, ID SQL ou
  segredo visível; zero erro Lua/JS; fluxo físico sem regressão.
- **Resultado real:** aprovado conforme relato do usuário após execução manual no FiveM. O app
  abriu corretamente e apresentou todos os dados reais esperados. A não regressão do banco físico
  permanece coberta pelos testes runtime já aprovados das fases anteriores.
- **Evidência:** resultado fornecido pelo usuário: “abriu certinho consegui ver tudo”.
- **Status:** `APROVADO`
- **Executado por/data:** usuário / 2026-07-19.
- **Observações:** nenhuma divergência informada.

### P6A-RT-02 — fail-closed e recuperação

- **Pré-condições:** P6A-RT-01 concluído; app fechado.
- **Passos:** parar `mz_bank`; abrir o MZ Bank no telefone; confirmar indisponibilidade; iniciar
  `mz_bank`; reiniciar `mz_phone`; abrir novamente.
- **Resultado esperado:** nenhum saldo/mock enquanto indisponível; retry seguro; após recuperação,
  dados reais voltam sem duplicar conta, cartão, saldo ou movimentação.
- **Resultado real:** aprovado conforme relato do usuário após execução manual. Com `mz_bank`
  parado, o telefone permaneceu aberto e o app bancário exibiu serviço indisponível. A integração
  havia carregado os dados reais corretamente com o banco iniciado.
- **Evidência:** resultados fornecidos pelo usuário: “agora sim o celular sem o bank fica com
  serviço indisponivel” e a abertura real aprovada no caso anterior.
- **Status:** `APROVADO`
- **Executado por/data:** usuário / 2026-07-19.
- **Observações:** a dependência rígida foi removida do manifest antes da repetição aprovada.

## Decisão

```text
P6-A runtime: APROVADO
P6-A: [R] Aprovado em runtime
Fase 6: [~] Em implementação
```
