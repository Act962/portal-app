# Spec — Fase 1: Identidade & Acesso

> **Status:** ✅ **Concluída (04/08/2026)** — 5 etapas entregues, CI verde.
> Adiado com motivo: **A24 (convite por token)** e o **E2E de admin I12**
> (isolamento por teste). A autorização de gestão está coberta por testes
> unitários.
> **Referências:** `../roadmap.md` (Fase 1) · `../architecture.md` §2.3 e §4 ·
> `../features.md` §3.4 (A20–A27) · `../adr/0004-autorizacao-como-dominio.md` ·
> `00-fundacao.md` (fundação que esta fase passa a exercitar).

---

## 1. Objetivo

Ter usuários de redação com **papéis** e a **autorização como domínio puro e
testável**: uma função `can(staff, ação, recurso)` que decide em milissegundos,
sem HTTP e sem banco. É o coração da fase — toda operação editorial futura
depende de "quem pode fazer o quê", e queremos essa regra num lugar só,
verificada por teste, não espalhada por controllers e telas.

Ao fim da fase: o admin faz login, o papel restringe o painel, e a **matriz de
permissões** de `features.md` §3.4 é lei coberta por teste unitário
parametrizado. É também a fase que faz nascer o **primeiro bounded context**
(`packages/contexts/identity`), ativando as regras latentes do
`dependency-cruiser`, e que tira o **T09** (login E2E) do `fixme`.

Critério de sucesso em uma frase: **um redator autenticado recebe `FORBIDDEN` ao
tentar publicar — provado no caso de uso e no E2E — e a regra que o barra é uma
função de domínio testada sem banco.**

---

## 2. Estado atual

| | Situação |
|---|---|
| Autenticação | **Existe** — Better-Auth (e-mail/senha), tabelas `user`/`session`/`account`/`verification` em Postgres |
| Autorização / papéis | **Nada** — todo usuário logado é igual |
| Painel `(app)` e login | **Existem** (scaffold), sem proteção por papel |
| Bounded contexts | **Nenhum** — `packages/contexts/*` não existe; as regras de camada do `dependency-cruiser` estão latentes |
| `shared-kernel` | **Existe** — `Entity`, `ValueObject`, `AggregateRoot`, `Result`, portas `Clock`/`IdGenerator` |
| T09 (login E2E) | **`fixme`** — sai nesta fase |
| Cobertura | Limiares escritos mas **desligados** — o `fail-under` do domínio liga aqui |

**Consequência:** esta é a primeira fase com domínio de verdade. Ela estreia a
estrutura `packages/contexts/identity` com as camadas `domain`/`application`/
`infrastructure`, e é o primeiro teste real das regras de arquitetura da Fase 0.

---

## 3. Escopo — `A20` a `A27` de `features.md`

Cinco etapas, na ordem de execução. Cada uma é mergeável sozinha.

| # | Etapa | Entrega | Status |
|---|---|---|---|
| 1 | Domínio de identidade & autorização | `StaffMember`, `Role`, `AuthorProfile`, `can()` + matriz testada | ✅ Concluída |
| 2 | Persistência | schema Prisma, `StaffMemberRepository` (porta + adapter Prisma + fake), testes de contrato | ✅ Concluída |
| 3 | Sessão → `StaffMember` e guardas | contexto tRPC resolve o staff; procedures por papel; rotas do painel protegidas; **T09 sai do `fixme`** | ✅ Concluída |
| 4 | Gestão de usuários (admin) | papel, editorias, desativação, perfil de autor, matriz visível, lista | ✅ Concluída¹ |
| 5 | Fecho | ADR 0004, `dependency-cruiser` ativado no contexto + `apps/web`, `fail-under` de cobertura | ✅ Concluída |

> ¹ **Adiado na Etapa 4**, com motivo: **A24 (convite por token / primeiro
> acesso)** — o fluxo atual (auto-cadastro provisiona o staff; o 1º é ADMIN, os
> demais REDATOR promovidos por um admin) já entrega a gestão; o convite precisa
> de provisionamento de usuário + ciclo de token, que vira um passo focado. E o
> **E2E do admin (I12)** — o bootstrap "1º usuário = ADMIN" torna um teste de
> admin em DB compartilhado dependente de ordem/retries; fica para quando a
> infra de E2E tiver isolamento por teste. A autorização de gestão está coberta
> por **testes unitários** (admin-pode / redator-`Forbidden` / efeitos).

### Fora de escopo

- Nenhum agregado editorial (`Article`), taxonomia ou mídia — vêm nas Fases 2–3.
- OAuth/SSO, 2FA, recuperação de senha por e-mail em produção (SMTP real) — o
  convite/primeiro acesso usa token; e-mail real fica para quando houver
  provedor definido.
- Página **pública** de autor — o `AuthorProfile` é modelado e editável aqui,
  mas a tela pública que o consome é da Fase 4.

---

## 4. Modelo de domínio — `packages/contexts/identity`

```
packages/contexts/identity/
├── src/
│   ├── domain/
│   │   ├── staff-member.ts        agregado raiz
│   │   ├── role.ts                VO: ADMIN | EDITOR | REDATOR
│   │   ├── author-profile.ts      VO: bio, foto, cargo, redes
│   │   ├── action.ts              ações autorizáveis (union)
│   │   ├── authorization.ts       can(staff, ação, recurso) — função pura
│   │   ├── errors.ts              Forbidden, StaffInactive, ...
│   │   └── ports/
│   │       └── staff-repository.ts
│   ├── application/               casos de uso (dependem só de domain + shared-kernel)
│   ├── infrastructure/            adapter Prisma da porta
│   └── index.ts                   interface publicada do contexto
├── package.json
└── tsconfig.json
```

- **`StaffMember`** (agregado raiz): `id` (o **mesmo** id do `user` do
  Better-Auth), `email`, `role`, `status` (`ATIVO | INATIVO`), `sectionIds`
  (editorias vinculadas — relevante para o `EDITOR`), `authorProfile`. Emite
  eventos (`StaffInvited`, `RoleChanged`, `StaffDeactivated`).
- **`Role`** (VO): `ADMIN | EDITOR | REDATOR`.
- **`AuthorProfile`** (VO): `bio`, `photoUrl`, `title` (cargo), `socials`.
  Invariante do E-E-A-T fica para a Fase 4; aqui é opcional e editável.
- **`Action`** (union de string): `article:create`, `article:edit-own`,
  `article:edit-any`, `article:submit`, `article:approve`, `article:publish`,
  `article:unpublish`, `taxonomy:manage`, `user:manage`, `settings:manage`,
  `audit:view`.

---

## 5. Matriz de permissões (MVP) — de `features.md` §3.4

| Ação | Redator | Editor | Admin |
|---|:--:|:--:|:--:|
| Criar rascunho | ✅ | ✅ | ✅ |
| Editar rascunho próprio | ✅ | ✅ | ✅ |
| Editar matéria de outro | ❌ | ✅¹ | ✅ |
| Submeter para revisão | ✅ | ✅ | ✅ |
| Aprovar / devolver | ❌ | ✅¹ | ✅ |
| Publicar / agendar | ❌ | ✅¹ | ✅ |
| Despublicar / arquivar | ❌ | ✅¹ | ✅ |
| Gerenciar editorias e tags | ❌ | ❌ | ✅ |
| Gerenciar usuários e papéis | ❌ | ❌ | ✅ |
| Configurações do site | ❌ | ❌ | ✅ |
| Ver auditoria | ❌ | ❌ | ✅ |

¹ Restrito às editorias às quais o editor está vinculado (`sectionIds`).

---

## 6. Autorização como domínio (o coração)

A assinatura:

```ts
function can(staff: StaffMember, action: Action, resource?: ResourceRef): boolean
```

- **`ResourceRef`** é uma interface mínima que o domínio de identidade **declara**
  e o Editorial (Fase 3) alimenta — não uma dependência do agregado `Article`:
  `{ authorId?: string; sectionId?: string }`. É o que evita o `identity`
  importar o `editorial` (regra `contextos-isolados`).
- As ações "próprio" (`article:edit-own`) checam `resource.authorId === staff.id`.
- As ações do `EDITOR` restritas por editoria checam
  `staff.sectionIds.includes(resource.sectionId)`.
- **Staff inativo nunca pode nada** — `status === INATIVO` curto-circuita para
  `false`, mesmo Admin.

Por que domínio puro e não middleware: a regra fica testável em milissegundos,
num só lugar, e a mesma função protege o caso de uso, o router tRPC e (como
segunda barreira) a UI. `Better-Auth` resolve **autenticação** e é um adapter de
infraestrutura; a **autorização** vive fora dele. Isso vira o **ADR 0004**.

---

## 7. Casos de uso — `application/`

Cada um recebe o **ator** (`StaffMember`) e verifica `can(...)` antes de agir;
devolve `Result<T, Forbidden | ...>` (nunca lança para erro de regra).

- `ConvidarUsuario(admin, { email, role, sectionIds? })`
- `DefinirSenhaNoPrimeiroAcesso({ token, senha })` — delega a senha ao Better-Auth
- `AlterarPapel(admin, { staffId, role })`
- `VincularEditorias(admin, { staffId, sectionIds })`
- `DesativarUsuario(admin, { staffId })` — revoga acesso, mantém autoria
- `EditarPerfilDeAutor(staff, profile)` — o próprio, ou Admin sobre qualquer
- `ListarUsuarios(admin)`

Todos com **fakes in-memory** das portas nos testes de aplicação (§13).

---

## 8. Contratos de API — router `identity` (tRPC)

- `identity.me` — o `StaffMember` do ator (papel, editorias, perfil)
- `identity.users.list` — Admin
- `identity.users.invite` — Admin
- `identity.users.setRole` / `setSections` / `deactivate` — Admin
- `identity.profile.update` — o próprio staff (ou Admin)
- `identity.permissions.matrix` — leitura, para a tela A27

Nasce uma guarda: `staffProcedure` (exige sessão + `StaffMember` **ativo**) e um
helper `authorize(action, resource?)` que roda `can(...)` e lança
`FORBIDDEN` do tRPC quando nega. O `protectedProcedure` atual continua para o que
só exige sessão.

---

## 9. Persistência — Etapa 2

- **Prisma:** modelo `StaffMember` (`@@map("staff_member")`), `id` igual ao do
  `user` (FK 1:1 para `user`), `role`, `status`, `authorProfile` (colunas ou
  tabela `author_profile`), e o vínculo com editorias como **lista de ids**
  (coluna `sectionIds String[]` no MVP — ver Decisão D3).
- **Porta `StaffMemberRepository`** com adapter Prisma em `infrastructure/` e
  um **fake in-memory** no pacote (parte do contrato da porta).
- **Testes de contrato:** uma suíte única roda contra o fake **e** contra o
  adapter Prisma (Testcontainers) — é o que legitima usar o fake nos testes de
  aplicação. Migração versionada como sempre.

---

## 10. Telas — painel `(app)`, protegidas por papel

- **Lista de usuários** (Admin) — papel, editorias, status
- **Convidar usuário** (Admin) — e-mail + papel + editorias
- **Editar usuário** — papel, editorias, desativar
- **Perfil de autor** — o próprio staff edita bio/foto/cargo/redes
- **Matriz de permissões** (A27) — tabela read-only do §5, alimentada por
  `identity.permissions.matrix`
- **Proteção de rota:** o layout de `(app)` resolve o `StaffMember` e redireciona
  quem não tem papel para a ação; a UI esconde o que `can(...)` nega, mas a
  verdade é sempre revalidada no servidor.

---

## 11. Integração com Better-Auth — Etapa 3

- No `context.ts` do tRPC, além da sessão, resolve-se o `StaffMember` pelo id do
  usuário e expõe-se `ctx.staff` + um `ctx.can(action, resource?)`.
- `staffProcedure` exige `ctx.staff?.status === ATIVO`.
- Proteção de rota no `(app)/layout.tsx` (RSC) via `auth.api.getSession` +
  carregamento do staff.
- **T09 sai do `fixme`:** com papéis e proteção reais, o fluxo cadastro → sessão
  → dashboard passa a ser exercitável de ponta a ponta. (O primeiro usuário é
  semeado como Admin — ver Decisão D2.)

---

## 12. Arquitetura & CI — Etapa 5

- **`dependency-cruiser` ativado no contexto:** com `packages/contexts/identity`
  existindo, as regras latentes passam a valer — `domain/` sem I/O nem npm,
  `application/` sem `infrastructure/`, `contextos-isolados`. Inclui-se
  `apps/web` no scan, com a resolução do alias `@/` configurada.
- **ADR 0004** — "Autorização como domínio, não como middleware".
- **Cobertura:** liga-se o `fail-under` do domínio (**≥ 95%**) no
  `vitest.config.ts` — nesta fase há domínio de verdade para medir.

---

## 13. Casos de teste

| # | Caso | Tipo | Etapa |
|---|---|---|---|
| I01 | Matriz §5 célula a célula (parametrizado) | Unit | 1 |
| I02 | Redator recebe `Forbidden` ao publicar | Unit | 1 |
| I03 | Editor só age nas editorias vinculadas | Unit | 1 |
| I04 | Staff inativo não pode nada (nem Admin desativado) | Unit | 1 |
| I05 | `article:edit-own` só no próprio recurso | Unit | 1 |
| I06 | `AuthorProfile` valida/normaliza campos | Unit | 1 |
| I07 | `StaffMemberRepository`: contrato fake == Prisma | Integração | 2 |
| I08 | Desativar mantém a autoria (id preservado) | Integração | 2 |
| I09 | `staffProcedure` nega sessão sem staff ativo | Integração | 3 |
| I10 | Redator autenticado → `FORBIDDEN` ao publicar (rota) | E2E | 3 |
| I11 | T09: cria conta, sai e entra (sai do `fixme`) | E2E | 3 |
| I12 | Admin acessa gestão de usuários; Redator é barrado | E2E | 4 |

---

## 14. Critérios de aceite (do roadmap)

- [ ] Matriz de permissões §5 coberta por **teste unitário parametrizado**, sem
      HTTP e sem banco
- [ ] Redator autenticado recebe `FORBIDDEN` ao tentar publicar — no caso de uso
      **e** no E2E
- [ ] Usuário desativado perde acesso mas mantém a autoria histórica
- [ ] Cobertura do domínio de identidade **≥ 95%** (com `fail-under` ligado)
- [ ] `dependency-cruiser` verde com o contexto real + `apps/web` no scan
- [ ] T09 fora do `fixme` e verde no CI
- [ ] ADR 0004 escrito

---

## 15. Decisões a confirmar

Preciso do seu aval nestes pontos antes de implementar a Etapa 1:

- **D1 — `StaffMember` em tabela própria (1:1 com `user`)** _(recomendado)_ vs.
  estender o modelo `User` do Better-Auth com colunas de papel. Recomendo tabela
  própria: mantém o contexto `identity` dono do seu esquema e o domínio limpo,
  sem acoplar ao formato do Better-Auth.
- **D2 — Convite / primeiro acesso (A24).** Proponho para o MVP: o Admin cria o
  `StaffMember` (e-mail + papel) e gera um **token de convite**; o usuário define
  a senha via Better-Auth nesse fluxo. Sem SMTP real agora — o link/token é
  exibido para o Admin (ou logado), e a integração de e-mail entra quando houver
  provedor. **O primeiro usuário do sistema é semeado como `ADMIN`** (seed), para
  destravar o painel. Confirmar se serve.
- **D3 — Vínculo editor↔editoria antes do contexto Taxonomy (Fase 2).** Proponho
  guardar `sectionIds: string[]` no `StaffMember` agora, sem depender do Taxonomy;
  quando o Taxonomy nascer, valida-se a existência das editorias. Alternativa:
  adiar o "editor por editoria" (A23) para depois do Taxonomy.
- **D4 — Ligar o `fail-under` de cobertura do domínio (95%) já nesta fase**, como
  a spec da Fase 0 previu. Confirmar.

---

## 16. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Autorização vazar para middleware/UI e divergir do domínio | Alto | `can()` é a única fonte; router e UI a chamam; teste parametrizado cobre a matriz |
| `identity` acabar importando `editorial` para checar recurso | Médio | `ResourceRef` mínimo declarado no `identity`; `contextos-isolados` no CI barra o resto |
| Convite/senha sem e-mail real virar meia-boca | Médio | Escopo do MVP explícito (token exibido); e-mail entra com provedor, sem retrabalho de domínio |
| `StaffMember` e `User` do Better-Auth dessincronizarem | Médio | 1:1 por id, FK com o `user`; criação de staff sempre junto do usuário |

---

## 17. ADR previsto

- **0004 — Autorização como domínio, não como middleware** (escrito na Etapa 5,
  formaliza a decisão do §6).
