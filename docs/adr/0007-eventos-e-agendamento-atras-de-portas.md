# 0007 — Despacho de eventos e agendamento atrás de portas (Inngest substituível)

- **Status:** Aceito
- **Data:** 2026-08-05
- **Decisores:** Equipe do portal-app

## Contexto

Os eventos do outbox ([0005](./0005-outbox-transacional.md)) precisam ser
entregues aos consumidores, e a publicação agendada precisa disparar no horário.
A `stack.md` (Decisão 6) cogitou o **Inngest** por dar retry com backoff, passos
duráveis e entrega no futuro (`step.sleepUntil`). Mas há um requisito explícito
do time: **o app não pode ficar preso ao Inngest** — deve ser possível trocá-lo
por um despacho síncrono ou por `node-cron` sem reescrever o núcleo.

## Alternativas consideradas

- **Chamar o Inngest direto do domínio/aplicação.** Simples, mas acopla o core
  domain a um SaaS; testar exige mocká-lo; trocar de ferramenta vira reescrita.
  Descartado.
- **Cron da Vercel varrendo tabela.** Limitado pela duração do cron serverless e
  sem durabilidade/retry por passo. Descartado.
- **Portas + adapters intercambiáveis (escolhido).** Despacho e agendamento ficam
  atrás de portas; o núcleo nunca conhece o adapter concreto.

## Decisão

Despacho e agendamento ficam atrás de portas do editorial:

- **`EventBus`** — despacha um evento do outbox. Adapters: **`SyncEventBus`**
  (in-process, o default de dev e do MVP) e, quando quisermos, um de Inngest. Um
  fake in-memory serve os testes.
- **Agendamento** — a matéria agendada guarda o horário no próprio agregado; um
  **poller** (`publishDueScheduled`, dirigido por `node-cron`/trigger) publica as
  vencidas. Um adapter de Inngest com `step.sleepUntil` cumpriria o mesmo papel.
- **`Scheduler`** (`packages/shared-kernel/src/ports/scheduler.ts`) — o registro
  de tarefas recorrentes que separa *o que roda* de *quem manda rodar*. Mora no
  shared-kernel, e não num contexto, porque agendar não é assunto de nenhum
  domínio em particular: é a mesma família de `Clock` e `IdGenerator`. As
  tarefas são declaradas em `packages/api/src/scheduler.ts`; o driver é escolha
  da infraestrutura.

O **Inngest é apenas um adapter**, instanciado (se for o caso) na raiz de
composição (`packages/api`). Trocá-lo por síncrono ou `node-cron` é trocar a
linha da composição — `domain/` e `application/` nunca o importam, e o
`dependency-cruiser` reforça isso. O outbox é o ponto de costura: os eventos são
persistidos independentemente de quem os despacha. Ver spec da Fase 3, §5.1.

## Consequências

- **Mais fácil:** rodar tudo offline no dev/CI sem SaaS; testar despacho e
  agendamento com fakes e `FixedClock`; adotar (ou abandonar) o Inngest sem tocar
  o núcleo.
- **Mais difícil / a monitorar:** o default síncrono não tem retry/durabilidade
  do Inngest — se quisermos essas garantias em produção, é preciso plugar o
  adapter correspondente; manter a paridade entre adapters (mesma semântica de
  entrega) é responsabilidade nossa.

## Estado da implementação (2026-08-07)

Esta ADR ficou meses descrevendo mais do que existia. O que vale hoje:

| Peça | Estado |
|---|---|
| Porta `EventBus` | ✅ `packages/contexts/editorial/src/domain/ports/event-bus.ts` |
| Adapter `SyncEventBus` (o default do MVP) | ✅ ligado em `packages/api/src/editorial.ts`, com o consumidor de auditoria |
| Outbox + relay idempotente | ✅ `dispatchOutbox`, com teste de reentrega |
| Porta `Scheduler` + `TaskRegistry` | ✅ `packages/shared-kernel/src/ports/scheduler.ts` |
| Driver HTTP (`/api/cron/[task]`) | ✅ autenticado por `CRON_SECRET`, dirigido hoje pelo cron da Vercel |
| Adapter Inngest do `Scheduler` | ✅ `packages/api/src/inngest.ts` + rota `/api/inngest` |
| Adapter Inngest do `EventBus` | ❌ não escrito — o despacho de eventos segue síncrono |
| `packages/jobs` | ❌ nunca existiu; as tarefas moram na raiz de composição |

**O Inngest foi adotado como agendador** (2026-08-07), pela facilidade de
operação e pelo retry com backoff. E a adoção custou exatamente o que a ADR
prometia: um arquivo de 3 linhas úteis percorrendo `scheduler.tasks()`, mais a
rota que o serve. Nenhum contexto, caso de uso ou agregado mudou — abandoná-lo é
apagar os dois arquivos e deixar o cron da Vercel dirigindo `/api/cron/[task]`,
que continua funcionando.

**O que ainda NÃO ganhamos com isso:** retry no despacho de EVENTOS. O
`EventBus` continua síncrono — um consumidor que falhe perde a rodada, e nada
tenta de novo sozinho (o evento não some: a linha do outbox fica sem
`processedAt`). O retry que o Inngest agora dá vale para a execução da TAREFA,
não para o fan-out. Plugar o `EventBus` durável é o passo seguinte, e agora é
barato: o cliente e a rota já existem.
