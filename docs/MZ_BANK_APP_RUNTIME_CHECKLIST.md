# MZ Bank no mz_phone — checklist runtime

Data de criação: 2026-07-15  
Ambiente esperado: FiveM staging  
Estado geral: **APROVADO — 12 de 12 testes informados como aprovados pelo usuário**

Estados permitidos: `NÃO EXECUTADO`, `APROVADO`, `FALHOU`, `BLOQUEADO`, `NÃO APLICÁVEL`.

Este checklist valida somente a remoção do simulador e o fail-closed. Ele não aprova saldo,
extrato, transferência, cartões ou a Fase 6.

## RT-BANK-PROD-01 — abertura

- Pré-condição: `mz_phone` reiniciado com os arquivos atuais.
- Passos: abrir o telefone; tocar em MZ Bank.
- Esperado: app abre no shell normal e mostra somente serviço indisponível.
- Evidência: captura da NUI e console F8/server.
- Resultado real: aprovado conforme resultado fornecido pelo usuário após execução manual no FiveM.
- Status: **APROVADO**
- Executado por/data: usuário / 2026-07-15

## RT-BANK-PROD-02 — ausência de dados fictícios

- Pré-condição: app aberto.
- Passos: inspecionar toda a tela; tocar em retry.
- Esperado: nenhum nome, saldo, rota, extrato, cartão, destinatário ou referência fictícia.
- Evidência: captura antes/depois do retry.
- Resultado real: aprovado; o app apresentou **serviço indisponível**, sem dados fictícios, conforme informado pelo usuário.
- Status: **APROVADO**
- Executado por/data: usuário / 2026-07-15

## RT-BANK-PROD-03 — retry fail-closed

- Pré-condição: app aberto.
- Passos: tocar repetidamente em “Tentar novamente”.
- Esperado: permanece indisponível; nenhum callback bancário, dado ou erro de NUI.
- Evidência: F8 e console server.
- Resultado real: aprovado conforme resultado fornecido pelo usuário após execução manual no FiveM.
- Status: **APROVADO**
- Executado por/data: usuário / 2026-07-15

## RT-BANK-PROD-04 — fechar e reabrir

- Pré-condição: app aberto.
- Passos: voltar à home; reabrir; fechar o telefone; reabrir o telefone e o app.
- Esperado: foco correto, nenhum estado anterior, mesma indisponibilidade simples.
- Evidência: vídeo curto e consoles.
- Resultado real: aprovado conforme resultado fornecido pelo usuário após execução manual no FiveM.
- Status: **APROVADO**
- Executado por/data: usuário / 2026-07-15

## RT-BANK-PROD-05 — home indicator e Escape

- Pré-condição: app aberto.
- Passos: usar home indicator; reabrir; usar Escape conforme padrão do telefone.
- Esperado: navegação/fechamento iguais aos demais apps, sem travar foco.
- Evidência: vídeo curto.
- Resultado real: aprovado conforme resultado fornecido pelo usuário após execução manual no FiveM.
- Status: **APROVADO**
- Executado por/data: usuário / 2026-07-15

## RT-BANK-PROD-06 — tema escuro

- Pré-condição: tema escuro selecionado.
- Passos: abrir app e acionar retry.
- Esperado: texto, ícone e botão legíveis; sem overflow.
- Evidência: captura 320x680 da NUI.
- Resultado real: aprovado conforme resultado fornecido pelo usuário após execução manual no FiveM.
- Status: **APROVADO**
- Executado por/data: usuário / 2026-07-15

## RT-BANK-PROD-07 — tema claro

- Pré-condição: tema claro selecionado.
- Passos: abrir app e acionar retry.
- Esperado: fundo/tokens claros respeitados; contraste e foco legíveis.
- Evidência: captura 320x680 da NUI.
- Resultado real: aprovado conforme resultado fornecido pelo usuário após execução manual no FiveM.
- Status: **APROVADO**
- Executado por/data: usuário / 2026-07-15

## RT-BANK-PROD-08 — restart mz_phone

- Pré-condição: telefone aberto ou fechado.
- Passos: `restart mz_phone`; reabrir telefone e banco.
- Esperado: recuperação limpa; nenhum dado fictício; nenhum erro JS.
- Evidência: consoles e captura.
- Resultado real: aprovado conforme resultado fornecido pelo usuário após execução manual no FiveM.
- Status: **APROVADO**
- Executado por/data: usuário / 2026-07-15

## RT-BANK-PROD-09 — restart mz_bank

- Pré-condição: app aberto.
- Passos: `restart mz_bank`; tocar retry antes, durante e depois.
- Esperado: app permanece fail-closed; nenhum fallback ou dado falso.
- Evidência: consoles.
- Resultado real: aprovado conforme resultado fornecido pelo usuário após execução manual no FiveM.
- Status: **APROVADO**
- Executado por/data: usuário / 2026-07-15

## RT-BANK-PROD-10 — outros apps

- Pré-condição: `mz_phone` iniciado.
- Passos: abrir/fechar Contatos, Mensagens, Chamadas, Câmera, Galeria e Ajustes.
- Esperado: nenhuma regressão de registro, header, foco ou navegação.
- Evidência: vídeo curto e F8.
- Resultado real: aprovado conforme resultado fornecido pelo usuário após execução manual no FiveM.
- Status: **APROVADO**
- Executado por/data: usuário / 2026-07-15

## RT-BANK-PROD-11 — ausência de tráfego bancário

- Pré-condição: logging de client/server disponível.
- Passos: abrir app e usar retry/spam controlado.
- Esperado: zero callbacks NUI, eventos ou exports bancários; zero alteração de saldo/ledger.
- Evidência: consoles e conferência de saldo antes/depois.
- Resultado real: aprovado. O usuário observou que ainda não acessa funcionalidades bancárias reais pelo app; a NUI física do banco está funcionando corretamente.
- Status: **APROVADO**
- Executado por/data: usuário / 2026-07-15

## RT-BANK-PROD-12 — ATM e agência

- Pré-condição: `mz_bank` ready.
- Passos: abrir ATM e agência; consultar overview/extrato físico; fechar.
- Esperado: fluxos físicos preservados, inclusive animação e slot.
- Evidência: vídeo e consoles.
- Resultado real: aprovado conforme resultado fornecido pelo usuário; ATM, agência e NUI física permaneceram funcionando.
- Status: **APROVADO**
- Executado por/data: usuário / 2026-07-15

## Funcionalidades não aplicáveis neste estado

Saldo real, rota pública, paginação real, payload adulterado bancário, rate limit bancário phone,
transferência e cartão são **NÃO APLICÁVEIS** porque nenhuma superfície phone foi criada. Eles devem
receber um checklist novo quando os contratos e gates existirem; não podem ser aprovados por este.

## Resultado consolidado

- Testes executados: **12**
- Aprovados: **12**
- Falhas: **0**
- Bloqueados: **0**
- Fonte dos resultados: declaração do usuário após execução manual no FiveM.
- Evidências adicionais anexadas: nenhuma.

```text
Runtime do fail-closed: APROVADO
Integração bancária real: BLOQUEADA
Fase 6: [ ] NÃO INICIADA
```
