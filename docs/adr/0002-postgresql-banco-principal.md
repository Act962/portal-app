# 0002 — PostgreSQL como banco principal

- **Status:** Aceito
- **Data:** 2026-08-03
- **Decisores:** Equipe do portal-app

## Contexto

O scaffold Better-T-Stack veio com MongoDB. O domínio do portal é
essencialmente **relacional**: matérias pertencem a editorias e autores, têm
tags, passam por um workflow de estados e se relacionam entre si. Além disso, o
projeto precisa de **transações** (o outbox transacional do ADR 0005 grava
agregado e evento atomicamente) e de **busca full-text** já no MVP (ADR 0006).

## Alternativas consideradas

- **MongoDB (do scaffold).** Bom para documentos sem esquema rígido, mas o nosso
  domínio é relacional e transacional. Modelar relações e garantir atomicidade
  no Mongo seria remar contra a ferramenta o projeto inteiro.
- **PostgreSQL (escolhido).** Relacional, transacional, com integridade
  referencial (FKs, `on delete cascade`), full-text search nativo e um
  ecossistema maduro com o Prisma.

## Decisão

Migrar para **PostgreSQL 17** com Prisma, ainda na Fase 0. O esquema de
autenticação (Better-Auth) sai do mapeamento de Mongo (`@map("_id")`) para
ids `String` puros em Postgres. A busca do MVP usa full-text do próprio Postgres,
atrás de uma porta que permite trocar por Meilisearch depois (ADR 0006). A
mesma imagem `postgres:17` roda no dev (Docker), no CI (Testcontainers) e em
produção.

## Consequências

- **Mais fácil:** transações para o outbox, integridade referencial, cascatas,
  full-text sem serviço extra no MVP; paridade dev/CI/produção que elimina a
  classe de bug "funciona na minha máquina".
- **Mais difícil / a monitorar:** houve o custo único de migrar o esquema de
  auth (feito na Fase 0, sem dados reais); o esquema passa a exigir **migrações
  versionadas** (`prisma migrate`) como caminho oficial, em vez de `db push`.
