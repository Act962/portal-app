# Spec — Fase 11: Stories com publicação manual (link clicável)

> **Status:** 🚧 Em validação — F1 a F3 implementadas em 14/09/2026. O cliente
> confirmou em 14/09 as três propostas (§6): Stories nascem manuais, aviso só
> na fila (sem e-mail por ora) e qualquer pessoa com `social:publish` publica.
> Falta publicar um story de verdade pelo kit, no celular.
> **Motivo:** o cliente quer botão com link clicável nos Stories. A API de
> publicação da Meta não aceita figurinha: *"Publishing stickers (i.e., link,
> poll, location) is not supported"*
> ([IG User Media](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media)).
> Link clicável só existe em story publicado pelo app do Instagram.
> **Estende:** `08-redes-sociais.md` §17 (Stories como destino, D35–D41) e
> `10-editor-de-artes-konva.md` (a arte do story).

---

## 1. Objetivo

**O portal prepara o story inteiro — arte e link — e uma pessoa o publica pelo
app do Instagram em menos de um minuto, com a figurinha de link.**

Hoje o story sai sozinho, mas sem link: o "MATÉRIA COMPLETA" desenhado na arte
não é clicável, e quem vê o story não tem como chegar à matéria. Publicar à mão
devolve o link, e o portal tira da pessoa todo o trabalho que não é o toque na
figurinha.

Critério de sucesso: **aprovado o post, quem cuida das redes abre o painel no
celular, toca em "Publicar no Instagram", a arte abre no Instagram, cola o link
na figurinha, publica e toca em "Já publiquei" — e a fila mostra o story no ar.**

---

## 2. Decisões

**D1 — Cada entrega tem um modo: automático ou manual.** O modo é da ENTREGA,
não do post nem do destino (08, D6/D35). Assim o feed continua saindo sozinho e
o story do mesmo post espera uma pessoa, com uma aprovação só.

| Modo | O que o portal faz | Quem põe no ar |
|---|---|---|
| **Automático** | publica pela API (como hoje) | o worker |
| **Manual** | prepara a arte e o link, e espera | uma pessoa, pelo app |

O modelo aceita manual em qualquer destino, mas a tela só oferece nos Stories —
é o único lugar onde a API perde algo que o app tem.

**D2 — Stories nascem manuais (confirmar).** O padrão por destino fica numa
constante, ao lado de `AUTO_POST_PLATFORMS`: `INSTAGRAM_STORIES → MANUAL`,
feeds → `AUTOMATICO`. No editor do post, os Stories ganham a escolha
"Publicar à mão (com link)" / "Publicar sozinho (sem link)".

**D3 — Estados novos da entrega.**

| Estado | Quando | Tela |
|---|---|---|
| `AGUARDANDO_PESSOA` | entrega manual aprovada, arte pronta | "esperando você" |
| `DISPENSADA` | a pessoa decidiu não publicar | "dispensado" |

`PENDENTE`, `PUBLICADO` e `FALHOU` continuam. O worker só pega `PENDENTE`, então
nunca publica uma entrega manual por engano. As colunas de estado são texto:
não há enum a migrar.

**D4 — O post ganha `AGUARDANDO_PESSOA` no estado derivado.** A ordem da
derivação (08, `refreshStatus`) passa a ser:

1. alguma `PENDENTE` → `PUBLICANDO`;
2. alguma `AGUARDANDO_PESSOA` → `AGUARDANDO_PESSOA` ("Falta publicar à mão");
3. ignorando as `DISPENSADA`: todas no ar → `PUBLICADO`; algumas → `PARCIAL`;
   nenhuma → `FALHOU`;
4. todas `DISPENSADA` → `CANCELADA`.

Um story dispensado não deixa o post "em parte": a decisão foi de alguém.

**D5 — A arte é preparada na aprovação, pelo worker.** Aprovar põe a entrega
manual em `PENDENTE` com `mode = MANUAL`; o worker desenha a arte (a mesma
`publishable` do automático, com cache), grava a URL na entrega e a passa a
`AGUARDANDO_PESSOA`. Ganhos:

- a pessoa abre o kit e a imagem já existe, sem esperar o skia;
- **foto que sumiu falha AQUI**, com a mesma mensagem de hoje, em vez de a
  pessoa descobrir no celular — ver D10;
- o que a pessoa publica é pixel a pixel o que seria publicado automaticamente.

A entrega manual não precisa de conta conectada nem gasta cota da API: o
impedimento "Nenhuma conta do Instagram" não vale para ela.

**D6 — O kit do story.** Para cada entrega `AGUARDANDO_PESSOA`, o painel mostra:

- a arte (1080×1920);
- **Publicar no Instagram** — no celular, o compartilhar do sistema
  (`navigator.share` com o arquivo): o Instagram aparece na lista e abre o
  editor de story com a arte. Sem suporte a compartilhar arquivo (computador),
  o botão vira **Baixar arte**;
- **Copiar link** — o `linkUrl` do post, copiado para a área de transferência;
- o passo a passo curto: "Toque na figurinha → Link → cole → publique";
- **Já publiquei** e **Não vou publicar**.

O download é do próprio painel (usuário logado, rota autenticada), não um link
público solto.

**D7 — "Já publiquei" é a prova.** O automático prova com `remoteId`; o manual
prova com quem clicou. A entrega passa a `PUBLICADO` com
`publishedByStaffId` e hora, `remoteId` nulo. O campo **Link do story** é
opcional: se colado, vira o `permalink` e o botão "Ver o story (24 h)" funciona.
A invariante de 08 continua: entrega publicada não muda mais.

**D8 — Falhou no automático, dá para fazer à mão.** Numa entrega automática em
`FALHOU` de um destino que aceita manual, a fila oferece **Publicar à mão**, ao
lado de "Tentar de novo": troca o modo e segue o D5. É a saída para o erro de
hoje (story sem link, API recusou) sem refazer o post.

**D9 — Aviso a quem publica (confirmar).** A fila ganha o filtro "Para publicar
à mão" e um contador no menu Redes sociais. E-mail (o `Mailer` do contexto de
identidade já existe) para quem tem `social:publish` fica na F4, se o cliente
quiser — em plantão, o aviso que funciona costuma ser o celular, não a caixa de
entrada.

**D10 — Arte sem foto não sai, nem à mão.** Hoje, se o arquivo da foto não é
encontrado no armazenamento, a arte do padrão sai com o cinza de "sem foto" e
é publicada assim (visto em 14/09, post `a2dd30e5`). Esta fase corrige: o 404
da foto torna a arte indisponível e a entrega falha com "A foto do post não
está mais no armazenamento". Vale para o automático e para o manual.

**D11 — Story velho avisa, não expira.** O kit mostra "aprovado há 5 h". Não há
expiração automática: só a redação sabe se a notícia ainda vale um story.

**D12 — Permissão.** Ver o kit, marcar publicado e dispensar exigem
`social:publish` — é publicar, só que por outro caminho.

---

## 3. Escopo

| Fatia | Entrega | Estado |
|---|---|---|
| F1 | Domínio e migração: `DeliveryMode`, estados `AGUARDANDO_PESSOA`/`DISPENSADA`, derivação D4, `markPrepared`, `markPublishedByPerson`, `dismiss`, `switchToManual`; D10 no desenhista | ✅ 14/09 |
| F2 | Worker prepara a arte da entrega manual (D5); API: `confirmManual`, `dismissDelivery`, `publishManually`, `modes` no `createDraft`/`update`; rota autenticada `/api/social/story-art` | ✅ 14/09 |
| F3 | Telas: escolha do modo nos Stories, cartão da fila com o kit (D6), compartilhar/baixar, copiar link, "Já publiquei" com link opcional, filtro, aviso e contador (D9) | ✅ 14/09 |
| F4 | E-mail a quem tem `social:publish` quando há story esperando | Adiada (cliente, 14/09) |

### Não entra (e por quê)

- **API não oficial para pôr a figurinha.** Viola os termos da Meta e arrisca a
  conta do portal.
- **Conferir na Meta se o story foi mesmo ao ar.** A API lista stories da conta
  (`/stories`), mas não diz qual é "o nosso" sem o id; fica para quando houver
  pedido real.
- **Link com UTM automático.** Útil para medir, mas é decisão de analytics — o
  link copiado é o `linkUrl` do post, que já pode ser editado.
- **Stories do Facebook.** Continuam fora (08, §17.3).

---

## 4. Modelo (F1)

```ts
type DeliveryMode = "AUTOMATICO" | "MANUAL";

type DeliveryStatus =
  | "PENDENTE" | "AGUARDANDO_PESSOA" | "PUBLICADO" | "FALHOU" | "DISPENSADA";

type DeliveryProps = {
  // ... o que já existe (destination, status, remoteId, permalink, error,
  //     attempts, lastAttemptAt)
  mode: DeliveryMode;
  /** A arte pronta para a pessoa publicar (D5). Só no manual. */
  preparedImageUrl: string | null;
  /** Quem confirmou a publicação manual (D7). */
  publishedByStaffId: string | null;
};

type PostStatus = /* os de hoje */ | "AGUARDANDO_PESSOA";
```

Na criação e edição do post, `platforms` passa a aceitar o modo:
`{ destination, mode }[]`, com o padrão do D2 quando o modo não vem.

**Migração** (`social_delivery`):

```sql
ALTER TABLE social_delivery
  ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'AUTOMATICO',
  ADD COLUMN "preparedImageUrl" TEXT,
  ADD COLUMN "publishedByStaffId" TEXT;
```

As entregas existentes ficam automáticas — nada muda para o que já saiu.

**Eventos:** `SocialPostPublished` ganha `manual: boolean` (e `remoteId` pode ser
nulo); novo `SocialDeliveryDismissed`. A auditoria registra quem publicou à mão
e quem dispensou.

---

## 5. Casos de teste (F1–F2)

- Aprovar post com feed automático e story manual: o feed fica `PENDENTE`, o
  story `PENDENTE` com modo manual; o worker publica o feed e prepara o story.
- O worker nunca chama o publicador para entrega manual.
- Story manual preparado → `AGUARDANDO_PESSOA`, com `preparedImageUrl`; post
  `AGUARDANDO_PESSOA` enquanto a pessoa não age, mesmo com o feed no ar.
- Foto ausente no armazenamento (404): a preparação falha com a mensagem do
  D10; no automático, a arte com padrão também falha (antes saía cinza).
- "Já publiquei" → `PUBLICADO` com `publishedByStaffId`, `remoteId` nulo; com
  link colado, `permalink` preenchido; segunda confirmação é ignorada.
- "Já publiquei" em entrega que não está `AGUARDANDO_PESSOA` é recusado.
- Dispensar: feed no ar + story dispensado → post `PUBLICADO`; tudo dispensado
  → `CANCELADA`.
- "Tentar de novo" não mexe em entrega `AGUARDANDO_PESSOA` nem `DISPENSADA`.
- "Publicar à mão" só em entrega automática `FALHOU` de destino que aceita
  manual; zera o erro e volta à preparação.
- Entrega manual não é barrada por falta de conta conectada nem conta na cota.
- `platforms` sem modo usa o padrão do destino (D2).
- Sem `social:publish`: kit, confirmar e dispensar respondem `FORBIDDEN`.

---

## 6. Perguntas para o cliente

1. **Stories nascem manuais?** (D2) Proposto: sim. A alternativa é nascerem
   automáticos e a pessoa escolher "à mão" quando quiser link.
2. **Aviso por e-mail?** (D9/F4) Proposto: começar só com filtro e contador na
   fila, e ligar o e-mail se a espera virar problema.
3. **Quem publica à mão?** Proposto: qualquer um com `social:publish`. Se for
   uma pessoa fixa, o aviso pode ir só para ela.
