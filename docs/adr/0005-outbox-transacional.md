# 0005 — Outbox transacional para eventos de domínio

- **Status:** Aceito
- **Data:** 2026-08-05
- **Decisores:** Equipe do portal-app

## Contexto

Publicar uma matéria emite `ArticlePublished`, consumido por vários interessados
(auditoria agora; busca, ISR, push, analytics depois). Se o evento for despachado
FORA da transação que salva o agregado, surge o clássico "salvou mas não
indexou": ou a publicação persiste e o evento se perde (consumidores nunca
reagem), ou o evento sai e a transação reverte (consumidores reagem a algo que
não aconteceu).

## Alternativas consideradas

- **Publicar direto no bus após salvar.** Duas operações não-atômicas: qualquer
  falha entre elas corrompe o estado observável. Descartado.
- **Two-phase commit / broker transacional.** Complexidade operacional alta para
  um monólito modular; acopla a um broker específico. Descartado.
- **Outbox transacional (escolhido).** Os eventos são gravados numa tabela
  `outbox_event` na MESMA transação do agregado; um relay os despacha depois.

## Decisão

`PrismaArticleRepository.save` grava o agregado **e** os eventos (`pullEvents()`)
numa única transação: ou tudo entra, ou nada entra. Um **relay** (`dispatchOutbox`)
lê os pendentes (`processedAt IS NULL`), entrega cada um pelo `EventBus` e marca
como processado — o que dá **idempotência** (um segundo despacho não reentrega).
Quem dirige o relay é a composição (ver [0007](./0007-eventos-e-agendamento-atras-de-portas.md)).

Comprovado por testes de integração: evento na mesma transação, rollback não
deixa evento órfão, e despacho repetido não reentrega.

## Consequências

- **Mais fácil:** consistência entre agregado e eventos; adicionar consumidores
  sem tocar o código de publicação; reprocessar despacho com segurança.
- **Mais difícil / a monitorar:** há uma tabela de outbox a limpar/monitorar; o
  despacho é *eventual* (há uma janela entre gravar e entregar); o relay precisa
  ser dirigido por alguém (loop, node-cron ou Inngest).
