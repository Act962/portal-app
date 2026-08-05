# Spec — Fase 2: Taxonomia & Mídia

> **Status:** ✅ Aprovada (2026-08-05) — decisões D1–D5 confirmadas conforme recomendado. Em execução.
> **Referências:** `../roadmap.md` (Fase 2) · `../architecture.md` §2.2 e §2.4 ·
> `../features.md` §3.3 (A16–A19) e §3.5 (A28–A32) · `../stack.md` (Decisão 3 —
> R2) · `01-identidade-acesso.md` (padrões que esta fase reusa).

---

## 1. Objetivo

Ter **onde classificar** e **com o que ilustrar** a matéria. É pré-requisito
direto da Fase 3: o agregado `Article` só publica com editoria e capa. A fase
cria **dois bounded contexts** — `taxonomy` (editorias, tags) e `media`
(biblioteca de mídia) — seguindo o mesmo molde já provado no `identity`:
domínio puro, porta + adapter + fake, contrato fake↔real, autorização por
`can(...)`, tudo sob as regras do `dependency-cruiser`.

Critério de sucesso em uma frase: **uma imagem grande sobe direto para o
armazenamento (sem passar pelo servidor da app) e só vira `MediaAsset` se tiver
crédito e texto alternativo — regra do domínio, não da tela.**

---

## 2. Estado atual

| | Situação |
|---|---|
| Contextos | `identity` existe e é o molde; `taxonomy` e `media` **não existem** |
| Editorias/tags | Só como **fixtures** em `apps/web/src/data/` (o portal público lê de lá) |
| Mídia | Inexistente — o portal usa `MediaPlaceholder` |
| Armazenamento de arquivo | Nenhum; a Decisão 3 (`stack.md`) escolheu **Cloudflare R2** (S3-compatível) |
| Autorização | `can(staff, "taxonomy:manage", …)` já existe (matriz da Fase 1) — a ação `taxonomy:manage` é de ADMIN |
| CI / cobertura | Verde; `fail-under` do domínio (≥95%) ligado — vale para os novos contextos |

**Consequência:** a fase não toca o portal público (que segue nas fixtures até a
Fase 4); ela constrói o **back-office** (domínio + admin) de taxonomia e mídia.

---

## 3. Escopo — `A16`–`A19` e `A28`–`A32`

Seis etapas, na ordem de execução. Cada uma é mergeável sozinha.

| # | Etapa | Entrega |
|---|---|---|
| 1 | Domínio de taxonomia | `Section`, `Tag`, VO `Slug` + invariantes, testes |
| 2 | Persistência + API + admin de taxonomia | Prisma, repositórios (porta/adapter/fake + contrato), router, telas de editorias e tags |
| 3 | Domínio de mídia | `MediaAsset` + VOs (`Caption`, `Credit`, `AltText`, `Dimensions`, `FocalPoint`) + invariantes, testes |
| 4 | Armazenamento (`MediaStorage`) | Porta + adapter S3/R2 + fake; **contrato contra MinIO** (Testcontainers); MinIO no `docker-compose` |
| 5 | Persistência + API + upload/biblioteca de mídia | Prisma, repositório, router (URL pré-assinada + registro + busca), telas de upload e biblioteca |
| 6 | Fecho | ADR de mídia/armazenamento, cobertura dos novos domínios, `dependency-cruiser` verde nos dois contextos |

### Fora de escopo

- **Publicar/vincular** mídia e editoria a uma matéria — isso é a Fase 3
  (`Article`). Aqui os dois contextos existem e são geridos, mas o consumo é
  depois.
- **Substituir as fixtures** do portal por queries reais — Fase 4.
- **Servir AVIF/WebP por breakpoint (A32)** — é entrega/renderização, feita na
  Fase 4 com `next/image`. Aqui guardamos o original + dimensões + ponto focal
  (o que a renderização vai precisar).
- Vídeo/áudio/documento além do modelo — o MVP foca **imagem**; os outros tipos
  entram no agregado mas sem pipeline próprio agora.

---

## 4. Contexto Taxonomia — `packages/contexts/taxonomy`

```
domain/
├── section.ts            agregado: editoria
├── tag.ts                agregado: tag
├── slug.ts               VO: slug único, kebab-case
├── errors.ts             SlugTaken, SectionInUse, MaxDepthExceeded, ...
└── ports/
    ├── section-repository.ts
    ├── tag-repository.ts
    └── section-usage.ts   "esta editoria tem matéria publicada?" (Fase 3 implementa)
application/               casos de uso (CRUD, mesclar tag, reordenar)
infrastructure/            adapters Prisma
```

- **`Section`** (agregado): `id`, `name`, `slug`, `description`, `color`
  (hex), `order`, `status` (`ATIVA | INATIVA`), `parentId?`.
  - **Invariantes:** `slug` único (via porta) e em formato kebab; **hierarquia
    de no máximo 2 níveis** (uma seção com `parentId` não pode ser pai de outra);
    `name` obrigatório.
- **`Tag`** (agregado): `id`, `name`, `slug`.
- **VO `Slug`:** minúsculas, kebab-case, sem acento; validado no domínio.

### Desativar em vez de excluir (A17)

Editoria com matéria publicada **não** pode ser excluída — só desativada. Como o
`Article` só existe na Fase 3, o domínio faz a checagem por uma **porta
`SectionUsage`** (o mesmo padrão do `ResourceRef` do `identity`): nesta fase o
adapter responde "sem uso"; na Fase 3 o Editorial o implementa de verdade. A
exclusão dura fica atrás dessa porta; a desativação está sempre disponível.

### Mesclar tags (A19)

Renomear e **mesclar duplicadas**. A reatribuição das matérias de uma tag para
outra depende do Editorial (Fase 3); aqui a mesclagem opera sobre as tags e
registra a intenção via a mesma porta de uso, com a reatribuição efetiva ligada
quando `Article` existir. CRUD e exclusão de tag sem uso valem já.

### Ordenação (A18)

`Section.order` no domínio; a UI reordena por arrastar-e-soltar e persiste a
nova ordem via um caso de uso `reorderSections`.

---

## 5. Contexto Mídia — `packages/contexts/media`

```
domain/
├── media-asset.ts        agregado raiz
├── caption.ts            VO
├── credit.ts             VO (obrigatório)
├── alt-text.ts           VO
├── dimensions.ts         VO (width, height)
├── focal-point.ts        VO (x, y ∈ [0,1])
├── media-type.ts         IMAGE | VIDEO | AUDIO | DOCUMENT
├── errors.ts             MissingCredit, MissingAltText, ...
└── ports/
    ├── media-repository.ts
    └── media-storage.ts   getUploadUrl / publicUrl / delete
application/               requestUpload, registerAsset, listLibrary
infrastructure/            adapter S3/R2, adapter in-memory
```

- **`MediaAsset`** (agregado): `id`, `type`, `storageKey`, `filename`,
  `mimeType`, `dimensions?`, `caption`, `credit`, `altText?`, `focalPoint?`.
- **Invariantes de domínio (A29):**
  - **Todo asset tem `credit`** (crédito/fotógrafo — exigência jurídica).
  - **Imagem exige `altText` e `dimensions`** para poder ser vinculada a uma
    matéria publicada (a acessibilidade é invariante, não validação de tela).
  - `focalPoint` (se houver) tem `x`, `y` em `[0,1]`.
- Rejeição de metadado ausente é `Result<_, MissingCredit | MissingAltText>` —
  erro de domínio, não exceção.

### Upload direto, sem passar pelo servidor (A28)

1. Cliente pede `media.requestUpload({ filename, contentType })` → a API devolve
   uma **URL PUT pré-assinada** (via `MediaStorage.getUploadUrl`) e a `storageKey`.
2. Cliente faz `PUT` do arquivo **direto no R2/MinIO** (progresso por `XHR`).
3. Cliente envia os metadados → `media.register({ storageKey, type, dimensions,
   caption, credit, altText, focalPoint })` → o domínio valida e persiste o
   `MediaAsset`. O arquivo nunca passa pelo servidor da app.

### `MediaStorage` atrás de porta

`getUploadUrl(key, contentType)`, `publicUrl(key)`, `delete(key)`. Adapters:
**R2** (via `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, que falam S3)
para produção, e um **in-memory** para testes de aplicação. O contrato roda
contra **MinIO** — ver Etapa 4.

---

## 6. Persistência

- **Prisma** ganha `section`, `tag`, `media_asset` (arquivos de schema por
  contexto, como `identity.prisma`). Migrações versionadas.
- Repositórios: porta em `domain/ports`, adapter Prisma em `infrastructure/`,
  fake in-memory junto do contrato — **contrato único fake↔Prisma** por
  repositório (o padrão da Fase 1).

---

## 7. Contratos de API (tRPC) e telas

Tudo atrás de `requirePermission("taxonomy:manage")` (editorias/tags) — ação de
ADMIN pela matriz. Mídia: criar/gerir exige um staff ativo; a política fina
(quem pode subir) usa `can(...)`.

- `taxonomy.sections.*` — list, create, update, deactivate, reorder
- `taxonomy.tags.*` — list, create, rename, merge, delete
- `media.requestUpload`, `media.register`, `media.library` (busca + filtro por
  tipo/data), `media.get`
- **Telas** (admin): editorias (lista + arrastar-e-soltar + form), tags
  (lista + mesclar), **upload de mídia** (drag-drop com progresso) e
  **biblioteca** (grade com busca/filtro e reuso).

---

## 8. Ambiente — MinIO no dev/CI

O R2 exige conta e credenciais, e a Decisão 4b (hospedagem) está adiada sob o
lema "sem conta em serviço nenhum". Então dev e CI usam **MinIO** (S3-compatível,
open-source, em container): a mesma API S3 do R2, offline. O `docker-compose`
ganha o serviço `minio`; o contrato de `MediaStorage` roda contra um MinIO do
**Testcontainers**. O adapter R2 real é exercido só quando a Decisão 4b for
fechada (produção).

---

## 9. Casos de teste

| # | Caso | Tipo | Etapa |
|---|---|---|---|
| M01 | `Slug` normaliza e rejeita formato inválido | Unit | 1 |
| M02 | Editoria com `parentId` não pode ser pai (2 níveis) | Unit | 1 |
| M03 | `slug` duplicado é rejeitado (`SlugTaken`) | Unit/Integr. | 1/2 |
| M04 | Editoria "em uso" não pode ser excluída, só desativada | Unit | 1 |
| M05 | Contrato `SectionRepository`/`TagRepository`: fake↔Prisma | Integração | 2 |
| M06 | `MediaAsset` sem `credit` é rejeitado no domínio (A29) | Unit | 3 |
| M07 | Imagem sem `altText`/`dimensions` não vincula a publicada | Unit | 3 |
| M08 | `FocalPoint` fora de `[0,1]` é rejeitado | Unit | 3 |
| M09 | `getUploadUrl` gera PUT pré-assinado usável | Integração | 4 |
| M10 | Contrato `MediaStorage`: fake↔MinIO (upload + leitura) | Integração | 4 |
| M11 | Registrar asset após upload persiste com metadados | Integração | 5 |
| M12 | E2E: admin cria editoria; sobe imagem com legenda/crédito | E2E | 5 |

---

## 10. Critérios de aceite (do roadmap)

- [ ] Upload de imagem grande conclui com progresso e **sem passar o arquivo
      pelo servidor** da aplicação
- [ ] Salvar mídia sem alt text ou sem crédito é **rejeitado pelo domínio**
- [ ] Editoria com matéria publicada não pode ser excluída (mensagem na UI) —
      com a checagem de uso pela porta `SectionUsage` (stub nesta fase)
- [ ] Ponto focal persistido e disponível para o corte responsivo (a
      renderização por breakpoint é validada na Fase 4)
- [ ] Contratos fake↔Prisma e fake↔MinIO verdes; cobertura dos domínios ≥95%
- [ ] `dependency-cruiser` verde com os dois novos contextos

---

## 11. Decisões (confirmadas 2026-08-05)

Todas aprovadas conforme a recomendação.

- **D1 — MinIO como alvo do contrato de `MediaStorage`** _(recomendado)_. R2
  precisa de conta; MinIO (S3-compatível, container) dá o mesmo contrato S3
  offline, no dev e no CI (Testcontainers). O adapter R2 real fica pronto, mas é
  exercido só quando a hospedagem (Decisão 4b) for fechada.
- **D2 — "Editoria em uso não excluível" via porta `SectionUsage`**
  _(recomendado)_. Como `Article` só existe na Fase 3, a checagem de uso é uma
  porta que o Editorial implementa depois; nesta fase o adapter responde "sem
  uso" e a desativação é o caminho normal. Mesmo padrão do `ResourceRef`.
- **D3 — Mesclagem de tags parcial nesta fase** _(recomendado)_. CRUD e exclusão
  de tag sem uso agora; a reatribuição de matérias na mesclagem liga na Fase 3
  (quando há matéria), pela mesma porta de uso.
- **D4 — A32 (AVIF/WebP por breakpoint) fica na Fase 4** _(recomendado)_. É
  renderização (`next/image`); aqui guardamos original + dimensões + ponto focal.
- **D5 — Escopo de mídia = imagem no MVP** _(recomendado)_. O agregado modela os
  quatro tipos, mas só imagem tem pipeline (upload, metadados, foco) nesta fase.

---

## 12. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Acoplar `taxonomy`/`media` ao `editorial` (que não existe) | Alto | Portas `SectionUsage`/reatribuição; `contextos-isolados` no CI barra o resto |
| Upload pré-assinado furar CORS/credencial | Médio | MinIO no dev reproduz o fluxo S3 real; contrato M10 pega cedo |
| Metadado obrigatório virar validação só de UI | Alto | Invariante no domínio (M06/M07); a tela é segunda barreira |
| Divergência S3/R2/MinIO | Médio | Só recursos S3 comuns (PUT pré-assinado, GET); contrato roda contra MinIO |

---

## 13. ADR previsto

- **Mídia atrás de porta; R2/S3 em produção, MinIO no dev** — formaliza a
  Decisão 3 e o D1 (número a atribuir na sequência dos ADRs, escrito na Etapa 6).
