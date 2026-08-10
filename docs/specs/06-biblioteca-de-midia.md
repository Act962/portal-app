# Spec — Biblioteca de mídia: pastas, documentos e ações em lote

> **Status:** 📝 Escrita (2026-08-10), aguardando aprovação.
> **Pedido do cliente:** organizar a biblioteca — pastas, aceitar documentos,
> excluir mídia e agir sobre uma seleção.
> **Referências:** [`02-taxonomia-midia.md`](./02-taxonomia-midia.md) (o
> agregado `MediaAsset` e A29) · [`../adr/0009-midia-atras-de-porta-r2-minio.md`](../adr/0009-midia-atras-de-porta-r2-minio.md)
> (o binário atrás de porta) · [`../pendencias.md`](../pendencias.md) ("Excluir
> imagem da biblioteca").

---

## 1. Objetivo

**A redação encontra o arquivo que procura, e apaga o que não serve mais.**

Hoje a biblioteca é uma grade única, ordenada por data, que só aceita imagem e
da qual nada nunca sai. Depois de alguns meses de portal isso vira um depósito:
o repórter rola procurando a foto do prefeito e passa por 300 imagens de
enchente. E um envio errado — a foto errada, o recorte errado — fica lá para
sempre.

Critério de sucesso em uma frase: **o editor cria a pasta "Eleições 2026", move
para lá as 40 fotos da cobertura, e apaga as 6 que subiram duplicadas.**

---

## 2. Estado atual

| Peça | Como está |
|---|---|
| Agregado `MediaAsset` | Metadados + invariantes A29 (crédito sempre; alt-text e dimensões só para imagem) |
| `MEDIA_TYPES` | `IMAGE`, `VIDEO`, `AUDIO`, `DOCUMENT` — **os quatro já existem no modelo** |
| Upload | `requestUpload` → PUT direto no R2 → `register`. Só `accept="image/*"` na tela |
| `MediaRepository.delete(id)` | **Existe na porta e nos dois adapters** — mas nenhuma rota a expõe |
| Organização | Nenhuma. Uma grade, ordenada por `createdAt` desc |
| Seleção | Nenhuma. Clicar abre o detalhe de um item |

Duas coisas boas herdadas: o tipo `DOCUMENT` já é modelado, e o `delete` já
existe no repositório. O trabalho é menor do que parece.

---

## 3. Decisões

### D1 — Pastas são PLANAS, sem aninhamento

Uma pasta tem nome e nada mais; um arquivo está em uma pasta ou em nenhuma.

Aninhar traz caminho, mover-com-subárvore, prevenção de ciclo, migalha de pão na
tela e a pergunta "apagar a pasta apaga as filhas?". Nada disso serve ao caso de
uso real, que é **separar cobertura por assunto** — "Eleições 2026",
"Institucional", "Esportes". Uma redação de portal municipal não constrói
hierarquia de três níveis; constrói dez gavetas.

É reversível: aninhar depois é acrescentar `parentId`, não refazer o modelo.

### D2 — "Sem pasta" é um estado válido, não uma pasta raiz

`folderId` é anulável. Não existe pasta "Todos" nem "Raiz" no banco.

Inventar uma pasta raiz obrigaria a criá-la em migração, a protegê-la de
exclusão e a tratá-la como exceção em toda consulta. O nulo já diz exatamente o
que se quer dizer, e todo o acervo atual entra na feature sem tocar em uma linha
de dado.

### D3 — Pasta com arquivo dentro NÃO é excluída

Requisito do cliente, e é o comportamento certo: apagar uma pasta cheia ou
apagaria arquivos junto (destrutivo e surpreendente) ou os deixaria órfãos num
limbo invisível.

Erro de domínio `FolderNotEmpty`, com a CONTAGEM na mensagem — "tem 12 arquivos"
é acionável; "não está vazia" manda o usuário adivinhar. A tela oferece o
caminho: mover os arquivos, depois apagar a pasta.

A checagem mora no mesmo contexto (media conhece `MediaAsset`), então é uma
consulta ao próprio repositório — não precisa de porta.

### D4 — Excluir mídia EM USO por matéria é proibido, e isso atravessa contexto

**É a decisão mais importante desta spec.** Apagar uma imagem que é capa de
matéria publicada não dá erro em lugar nenhum: o portal simplesmente passa a
servir imagem quebrada, e ninguém descobre até um leitor reclamar.

O contexto de mídia **não conhece `Article`** — e não pode passar a conhecer,
sob pena de quebrar `contextos-isolados`. Então a pergunta vira porta:

```ts
export interface MediaUsage {
  /** A mídia é capa ou bloco do corpo de alguma matéria? */
  isMediaInUse(mediaId: string): Promise<boolean>;
}
```

É o mesmo arranjo do `ContentUsage` da taxonomia (D5 da spec 02): a porta mora
em `media/domain/ports/`, o adapter real mora na raiz de composição
(`packages/api`) e é o editorial quem responde. O fake do contexto responde
"sem uso", como o `StubNoUsage`.

**Vale para PUBLICADA e para rascunho.** Bloquear só o publicado deixaria o
redator apagar a foto do rascunho do colega — que é a mesma surpresa, com menos
testemunhas.

### D5 — Excluir apaga o binário DEPOIS da linha, e tolera falha no storage

Ordem: valida uso → apaga a linha do banco → tenta apagar o objeto no storage.

Se o storage falhar, a operação **não** é revertida. O oposto — apagar o arquivo
primeiro — deixaria a linha apontando para um objeto inexistente, que é o estado
pior: a biblioteca mostra um item quebrado e insiste que ele existe. Um objeto
órfão no bucket custa centavos e não aparece para ninguém.

Registrado como dívida consciente: não há varredura de órfãos. Entra se o volume
justificar.

### D6 — Documentos entram; a regra de acessibilidade continua sendo por tipo

Aceitos: **PDF, DOC/DOCX, XLS/XLSX, CSV, TXT**, além de imagem.

O tipo é derivado do `mimeType` no domínio — não vem escolhido pela tela, que
seria confiar no cliente para classificar. `image/*` → `IMAGE`; a lista de
documentos acima → `DOCUMENT`; `video/*` → `VIDEO`; `audio/*` → `AUDIO`.

Os invariantes A29 já são condicionais ao tipo: alt-text e dimensões valem para
`IMAGE`. Um PDF sem alt-text é válido — e deve ser, porque alt-text de PDF não
existe.

**`credit` continua obrigatório para todos**, inclusive documentos. É estranho
para um edital, mas mexer num invariante existente para acomodar um caso novo
custa mais do que digitar "Prefeitura" no campo. Fica registrado como ponto a
revisar se incomodar na prática.

### D7 — Ação em lote NÃO é transação: relata item a item

Mover 40 arquivos e excluir 6 são operações por item. Se o item 12 falhar por
estar em uso, os 11 anteriores **permanecem feitos** e o resultado diz o que
passou e o que não passou.

O contrário — abortar tudo no primeiro erro — obrigaria o editor a descobrir por
tentativa e erro qual arquivo trava a operação, refazendo a seleção a cada
rodada. O relatório resolve numa passada: "3 excluídos, 3 não: em uso por
matéria".

### D8 — Confirmação com CONSEQUÊNCIA, não com "tem certeza?"

Requisito do cliente. Mas o diálogo diz o que vai acontecer e é irreversível:
"Excluir 6 arquivos? Esta ação não pode ser desfeita." — e não "Você tem
certeza?", que ninguém lê.

Mover **não** pede confirmação: é reversível em um clique, e um diálogo a cada
arrasto vira ruído que ensina a clicar "Sim" sem ler.

---

## 4. Modelo

```prisma
model MediaFolder {
  id   String @id @default(cuid())
  name String @unique          // nome é a identidade para quem usa

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  assets MediaAsset[]
  @@map("media_folder")
}

model MediaAsset {
  // … campos atuais …
  folderId String?
  folder   MediaFolder? @relation(fields: [folderId], references: [id], onDelete: Restrict)

  @@index([folderId])
}
```

`onDelete: Restrict` é a **segunda linha de defesa** de D3: mesmo que a regra da
aplicação falhe ou alguém apague pela mão no banco, o Postgres recusa. O
invariante não depende só do nosso código.

---

## 5. Permissões

Tudo atrás de `media:manage`, que já existe. Não se cria papel novo: quem podia
enviar imagem pode organizar e apagar.

---

## 6. Critérios de aceite

1. Criar pasta com nome repetido é recusado com mensagem em pt-BR.
2. Pasta com arquivo dentro não é excluída, e a mensagem diz **quantos**.
3. Excluir mídia que é capa ou bloco de corpo de matéria é recusado — publicada
   **ou** rascunho.
4. Excluir mídia sem uso some da biblioteca e do storage.
5. Falha ao apagar no storage **não** ressuscita a linha nem quebra a tela.
6. Enviar PDF funciona, e o item aparece como documento — sem exigir alt-text.
7. Enviar imagem **continua** exigindo alt-text e dimensões.
8. Selecionar N itens e excluir relata quantos foram e quantos não, com o
   motivo.
9. Mover seleção para uma pasta não pede confirmação; excluir pede.
10. Filtrar por pasta mostra só o que está nela; "Sem pasta" é um filtro
    possível.

---

## 7. Testes

| Nível | O que cobre |
|---|---|
| Unidade — domínio | `Folder` (nome vazio, aparado); `mediaTypeFromMime`; `MediaAsset.moveTo` |
| Unidade — aplicação | pasta não vazia recusa; mídia em uso recusa; lote relata parcial; falha de storage não reverte |
| Contrato — `FolderRepository` | fake e Prisma no mesmo teste, inclusive `countAssets` e nome único |
| Contrato — `MediaRepository` | filtro por pasta (incluindo "sem pasta"), que é onde fake e SQL divergem com facilidade |

O teste que mais importa é o de **falha de storage**: é o único caminho em que o
banco e o bucket discordam, e o único que ninguém executa à mão.
