# Spec — Fase 5, Bloco B: Configurações do site

> **Status:** ✅ Aprovada (2026-08-06), com uma emenda do cliente em D12.
> Em execução.
> **Spec-mãe:** [`05-admin-redacao.md`](./05-admin-redacao.md) (Bloco B). Decisões
> numeradas a partir de D6, continuando as D1–D5 de lá.
> **Referências:** `../pendencias.md` (Bloco B) · `../adr/0009-midia-atras-de-porta-r2-minio.md`
> (o logo é mídia) · `../adr/0005-outbox-transacional.md` (auditoria) ·
> `01-identidade-acesso.md` (`settings:manage`) · `04-portal-publico.md` (quem consome).

---

## 1. Objetivo

**O dono do portal muda a identidade do veículo sem programador e sem deploy.**

Hoje o nome da rádio, os telefones, os endereços das redes sociais e o rodapé
inteiro vivem num arquivo TypeScript. Trocar um número de WhatsApp é uma tarefa
de engenharia: editar, revisar, commitar, esperar o build. Para um cliente que
acabou de comprar o produto, isso é a diferença entre um portal que é dele e um
portal que é nosso.

Critério de sucesso em uma frase: **o cliente corrige o telefone da redação num
formulário, salva, e vê a mudança no rodapé do portal em menos de um minuto.**

---

## 2. Estado atual

Levantado na auditoria de 2026-08-06, varrendo as 9 páginas do `(site)`.

| | Situação |
|---|---|
| Fonte da verdade | `apps/web/src/config/site.ts` — 51 linhas, `as const`, importado por 8 componentes |
| Permissão | `settings:manage` existe desde a Fase 1 e **não tem nada atrás** |
| Tela | Não existe. O item da sidebar chegou a apontar para `/dashboard/settings` e **dava 404**; foi removido até esta entrega |
| Redes sociais | Apontam para `instagram.com`, `facebook.com`, `youtube.com` — os domínios genéricos, **não as contas da rádio** |
| Links institucionais | 6 rótulos (`Quem somos`, `Anuncie`…) com `href="#institucional"`, uma âncora que não existe. Aparecem no rodapé **e** no menu mobile |
| Topo | "ANUNCIE" e "FALE COM A REDAÇÃO" apontam para `#anuncie` / `#redacao` — idem |
| Rádio | `radio.streamUrl` é `null`, então o `<audio>` **nem é renderizado**: o botão de play não toca nada. A rádio não vai ao ar pelo site |
| Temperatura | `"32°C"` cravado no `top-bar.tsx`, sem provedor de clima |

O que **já** está resolvido e não faz parte desta spec: a data do cabeçalho e o
ano do rodapé passaram a sair do relógio (commit `4ac52af`).

---

## 3. Escopo

### Entra

| # | Etapa | Entrega |
|---|---|---|
| B-S1 | Agregado + persistência | `SiteSettings` com validação, migration, repositório |
| B-S2 | API | `settings.get` (leitura por qualquer membro) e `settings.update` (`settings:manage`) |
| B-S3 | Tela | `/dashboard/settings` em abas: Identidade · Contato · Redes · Rádio · Rodapé |
| B-S4 | Portal lê do banco | Os 8 componentes deixam de importar `siteConfig` e passam pelo read model |

### Não entra (e por quê)

- **Grade de programação da rádio.** É coleção com entidade própria — programa,
  horário, locutor, dias da semana, "no ar agora" —, não um punhado de campos.
  Merece agregado e tela próprios. **Mas `streamUrl` entra** (D11): é um campo
  único e é o que efetivamente põe a rádio no ar.
- **Colunistas, enquete e vídeos da home.** São conteúdo, não configuração:
  colunista provavelmente é autor com destaque, enquete e vídeo são features
  novas. Ficam para uma fase própria.
- **Banners.** Bloco C, já decidido em D3.
- **Clima no topo.** Exige provedor externo e uma porta `Weather`. Enquanto não
  houver, o campo sai da tela — melhor nada do que 32 °C todo dia (ver D12).
- **Páginas institucionais** ("Quem somos", "Princípios editoriais"). Esta spec
  torna os **links** editáveis; criar as páginas é um CMS de páginas estáticas,
  outro escopo.
- **Multi-veículo / white-label.** Um portal por instalação. O agregado é
  singleton por decisão (D6), não por descuido.

---

## 4. Decisões

### D6 — Agregado singleton, sem contexto novo

**Escolhido:** um agregado `SiteSettings` de linha única, morando em
`packages/contexts/settings/`, com o portal lendo pelo `read-model.ts` como já
faz com matérias e editorias.

Alternativas descartadas:

- **Tabela chave-valor genérica** (`key`/`value`). Parece flexível e envelhece
  mal: sem tipo, sem validação, sem migração — em seis meses tem chave órfã,
  valor com typo e ninguém sabe quais existem. O ganho de flexibilidade é
  ilusório num conjunto de campos que muda uma vez por ano.
- **Enfiar em `identity`.** Identidade é sobre pessoas e permissões. Configuração
  do veículo não é isso, e a mistura quebraria justamente a coesão que o
  `dependency-cruiser` protege.

Custo assumido: mais um pacote no workspace para um agregado com pouca regra.
Vale porque é onde a **validação** e a **auditoria** passam a ter lugar — e
porque a alternativa era espalhar isso por `apps/web`.

**Singleton na prática:** `id` com default fixo (`"singleton"`), garantido por
chave primária. Sem contagem de linhas, sem "pega o primeiro".

### D7 — `siteConfig` vira o DEFAULT, não a fonte

O arquivo continua existindo, com os mesmos valores, mas como **fallback**:
`loadSettings()` devolve o que está no banco **mesclado sobre** os defaults.

Três razões:

1. **O portal nunca renderiza vazio** — nem antes da primeira edição, nem se um
   campo novo entrar em produção antes de alguém preenchê-lo.
2. **A migração é segura**: sobe o código, nada muda visualmente, e o primeiro
   salvamento é que passa a valer. Nada de janela com rodapé em branco.
3. É o mesmo padrão que já usamos no `env` — default explícito e sobrescrita por
   ambiente.

### D8 — O logo é mídia, não URL

`logoMediaId` referenciando a biblioteca, e não um campo de texto com URL.

Um campo de URL convida alguém a colar o link de uma imagem hospedada em outro
lugar — que some, quebra, ou vira hotlink no servidor de terceiro. A biblioteca
já resolve upload, storage e URL pública (ADR 0009), e é onde a imagem deve
estar. O arquivo estático em `public/brand/` permanece como fallback do
fallback — desde 13/08/2026 é `logo-7-cidades.png`, a arte real do cliente, no
lugar do `logo.svg` que era um desenho provisório.

> **Alcance reduzido em 13/08/2026:** o `logoUrl` das Configurações alimenta
> schema.org, RSS, Open Graph e manifest, mas **não** o cabeçalho do portal.
> O masthead precisa de arte horizontal e monocromática numa altura fixa de
> 48px; este campo entrega um quadrado. Atender os dois com o mesmo arquivo era
> o que punha um 150×150 espremido em 48px, com a assinatura ilegível dentro.
> Ver `apps/web/src/components/layout/site-logo.tsx`.

### D9 — Links institucionais viram lista, e âncora morta não se renderiza

`institutional` passa de `string[]` para `{ label, href }[]`, editável (incluir,
remover, reordenar).

E a regra que falta hoje: **item sem `href` não vira link** — vira texto simples
ou não aparece. Um link que não leva a lugar nenhum é pior do que ausência: o
leitor clica, nada acontece, e o portal parece quebrado. É o mesmo raciocínio
que tirou "Anúncios" e "Configurações" da sidebar do painel.

Vale para os dois do topo (`#anuncie`, `#redacao`), que saem do código e viram
campos.

### D10 — Alterar configuração é auditável

`settings.update` emite `SiteSettingsChanged` pelo outbox, com o conjunto de
campos alterados (não os valores — evita jogar telefone e e-mail no log).

Coerente com o resto do sistema (ADR 0005) e útil na prática: quando o rodapé
"mudou sozinho", a auditoria diz quem e quando.

### D11 — A rádio entra pelo `streamUrl`, e só

> ⚠️ **Revogada depois da entrega.** A rádio se desvinculou do portal e a
> transmissão ao vivo saiu do produto: o player, a página `/ao-vivo` e o campo
> `radioStreamUrl` foram removidos (migration
> `20260807181354_drop_radio_stream_url`). Sobraram `radioFrequency` e
> `radioBand`, que são só a identidade exibida no cabeçalho e no rodapé. O texto
> abaixo fica como registro do que se decidiu na época.

Três campos: `radioStreamUrl`, `radioFrequency`, `radioBand`.

É o corte de maior valor por esforço do Bloco B inteiro. Hoje o cliente **é uma
rádio** e o site não toca a rádio — o `<audio>` sequer existe porque a URL é
nula. Três campos num formulário resolvem, sem esperar a grade de programação,
que é um projeto à parte.

O player já trata a ausência: sem URL, nada de elemento de áudio. A mudança é
passar a ter URL.

### D12 — O que não tem fonte de dado **fica** na tela, como placeholder

**Emenda do cliente na aprovação.** A proposta original era tirar da barra o que
não tem fonte real — a temperatura `"32°C"` fixa. **Decidido o contrário:** os
elementos ficam onde estão e vão sendo trocados por dado real conforme o
desenvolvimento avança.

A razão é de produto, e é boa: o portal precisa estar visualmente completo agora,
e um espaço vazio no cabeçalho é mais custoso hoje do que um valor provisório. O
mesmo raciocínio que já vale para o `AdSlot` e para o `MediaPlaceholder` — o
layout reserva o lugar antes de existir conteúdo.

Fica registrada a contrapartida, para não virar esquecimento: **valor fixo que
parece dado ao vivo engana o leitor.** A temperatura é o caso mais claro — 32 °C
todo dia, inclusive quando chove. Enquanto não houver porta `Weather`, isso é
dívida consciente, listada em `pendencias.md`.

**Não confundir com D9.** Placeholder *visual* fica; **link morto não** — um
elemento que convida ao clique e não faz nada é defeito, não provisório.

### D13 — Listas curtas vão em `Json`

`social`, `institutional` e `popularSearches` são colunas `Json`, não tabelas.

São listas curtas, ordenadas, editadas **inteiras** num formulário e nunca
consultadas por item. Tabela normalizada aqui custaria três modelos, três
migrations e três telas de CRUD para nada. É o mesmo critério do ADR 0003 para o
corpo da matéria — e o limite é o mesmo: no dia em que precisar consultar por
item, normaliza.

---

## 5. Modelo de dados

```prisma
model SiteSettings {
  id          String   @id @default("singleton")

  // Identidade
  name        String
  shortName   String
  tagline     String
  description String
  url         String
  city        String
  state       String
  logoMediaId String?

  // Rádio (D11)
  radioFrequency String?
  radioBand      String?
  radioStreamUrl String?

  // Contato
  contactNewsroom String?
  contactWhatsapp String?
  contactEmail    String?
  contactAddress  String?

  // Listas curtas (D13)
  social          Json   // { label, href }[]
  institutional   Json   // { label, href }[]
  popularSearches Json   // string[]

  legal     String?
  updatedAt DateTime @updatedAt

  @@map("site_settings")
}
```

**Validação no domínio** (não no zod da borda, que é defesa em profundidade):
`url` e cada `href` precisam ser absolutos e `http(s)`; `contactEmail` precisa
ter formato de e-mail; `name` não pode ser vazio. Campo inválido devolve `Result`
com erro — nunca lança.

---

## 6. Como o portal lê

`loadSiteSettings()` no `read-model.ts`, embrulhado em `cache()` do React: uma
consulta por render de página, não uma por componente. Os 8 componentes que hoje
importam `siteConfig` passam a receber por props ou a chamar o loader — RSC,
sem provider.

**Propagação:** a mudança aparece no portal em até 60 s, pelo `revalidate` do
layout. Não é instantâneo, e é aceitável para configuração — quem acabou de
salvar não está cronometrando o rodapé. Fica melhor de graça quando a
invalidação por evento entrar (dívida já registrada).

---

## 7. Critérios de aceite

1. ADMIN abre `/dashboard/settings`, altera o telefone da redação, salva, e o
   rodapé do portal mostra o novo número dentro de 60 s.
2. EDITOR e REDATOR **não** acessam a tela nem a mutation — a procedure nega pela
   rede, não só a página redireciona.
3. Com o banco vazio de configurações, o portal renderiza **exatamente** como
   hoje (os defaults do `siteConfig`).
4. ~~Preencher `radioStreamUrl` faz o botão de play tocar a rádio; apagar volta
   ao estado atual, sem erro no console.~~ (critério revogado — ver D11)
5. Um item institucional sem `href` não vira `<a>` clicável.
6. `href` inválido (`javascript:`, relativo, texto solto) é recusado no salvamento
   com mensagem em pt-BR.
7. A alteração aparece na auditoria com autor, horário e os campos tocados.
8. Trocar o logo pela biblioteca reflete no cabeçalho e nos metadados de
   compartilhamento.
9. `pnpm run check-types`, `depcruise`, `test:unit` e `build` verdes.

---

## 8. Testes

Segue a regra do `CLAUDE.md`: **a entrega sai com esqueleto pronto**.

`packages/contexts/settings/tests/unit/site-settings.test.ts`, com caso de fumaça
que roda e `it.todo` para o resto — validação de URL e e-mail, mescla sobre os
defaults, singleton, item sem href, evento emitido.

Atenção à régua: o agregado cai em `packages/contexts/**/src/domain/**`, coberto
pelo **limite de 95%**. Ou o teste sai junto, ou a cobertura derruba o CI — como
já aconteceu com `body.ts`. Aqui o esqueleto **não basta**; é o único ponto desta
spec em que o teste é obrigatório na entrega.

---

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Cliente apaga um campo e o portal fica sem nome | Campos obrigatórios validados no domínio; os opcionais caem no default (D7) |
| URL de stream inválida quebra o player | Validação de formato + o player já degrada para o estado pausado |
| Tela vira depósito de todo campo futuro | Escopo fechado em §3; grade de rádio, colunistas e enquete têm dono próprio |
| Mais um pacote no workspace por pouca regra | Assumido em D6 — é onde validação e auditoria têm lugar |

---

## 10. Depois desta spec

Em ordem de valor, do que a auditoria deixou mapeado:

1. **Convite + fechar auto-cadastro** (B1) — a pendência de *segurança* do Bloco B.
2. **Redefinição de senha** (B5) — mesmo mecanismo de token do convite.
3. **Grade de programação da rádio** — o resto do que ficou fora por D11.
4. **Banners** (Bloco C).
