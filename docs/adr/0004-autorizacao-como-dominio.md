# 0004 — Autorização como domínio, não como middleware

- **Status:** Aceito
- **Data:** 2026-08-04
- **Decisores:** Equipe do portal-app

## Contexto

Toda operação editorial depende de "quem pode fazer o quê": um redator cria
rascunho mas não publica; um editor publica só nas suas editorias; um admin faz
tudo. Essa regra (a matriz de `features.md` §3.4) precisa valer no caso de uso,
no endpoint e, como segunda barreira, na UI. Se ela viver espalhada por
*middlewares* e *controllers*, cada rota nova é uma chance de esquecer uma
verificação — e a regra fica impossível de testar sem subir HTTP e banco.

## Alternativas consideradas

- **Autorização como middleware/guard do framework.** Familiar, mas acopla a
  regra ao transporte (tRPC/HTTP), espalha a decisão por vários pontos e exige
  um teste de integração para cada verificação. A regra de negócio fica refém da
  camada de entrega.
- **Autorização como domínio (escolhido).** Uma função pura
  `can(staff, ação, recurso)` no contexto de identidade, sem I/O.

## Decisão

A autorização é **domínio puro**: `can(staff: StaffMember, action, resource?)`
decide em milissegundos, sem HTTP e sem banco. A mesma função protege o caso de
uso, o `staffProcedure`/`requirePermission` do tRPC e a UI. O recurso é descrito
por um `ResourceRef` mínimo (`{ authorId?, sectionId? }`) **declarado pelo
próprio contexto de identidade** — assim `identity` nunca importa `editorial`
para decidir uma permissão (regra `contextos-isolados` do `dependency-cruiser`).

O **Better-Auth resolve autenticação** e é um adapter de infraestrutura; a
autorização vive fora dele.

## Consequências

- **Mais fácil:** a matriz vira um **teste unitário parametrizado** (sem HTTP,
  sem banco); a regra tem uma fonte única; rota nova sem proteção é pega no
  `can()` ausente, não numa auditoria manual.
- **Mais difícil / a monitorar:** exige disciplina para sempre passar pela
  `can()` em vez de reintroduzir checagens ad-hoc na borda — a UI pode esconder
  ações, mas a verdade é sempre revalidada no servidor. O `ResourceRef` precisa
  crescer com cuidado para não virar um vazamento de outros contextos para
  dentro de identidade.
