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
