# Spec — SEO e indexação do portal

> **Status:** ✅ Implementada (2026-08-13).
> **Referências:** [`04-portal-publico.md`](./04-portal-publico.md) (P26–P28, de
> onde vieram sitemaps, news-sitemap e RSS) · [`05b-configuracoes-do-site.md`](./05b-configuracoes-do-site.md)
> (D7/D8 — a identidade do veículo mora no banco) · `../pendencias.md` ·
> `../ui-ux.md` §5 (o formato `/{editoria}/{slug}`).

---

## 1. Objetivo

**Fazer o portal ser encontrado.** Um veículo de notícias local vive de duas
portas de entrada: a busca do Google (incluindo Google News e Discover) e o link
compartilhado no WhatsApp. As duas dependem de metadados que o leitor nunca vê.

Critério de sucesso em uma frase: **qualquer URL pública do portal, colada no
WhatsApp, mostra título, descrição e imagem da marca; e qualquer matéria
publicada tem uma URL canônica única, uma data confiável e um lugar no sitemap
em menos de um minuto.**

Esta spec não inventa o SEO do portal — a Fase 4 já entregou sitemaps, RSS,
`NewsArticle` e canônicas. Ela **audita o que existe**, corrige o que está
errado e fecha as lacunas.

---

## 2. Estado atual

Auditoria de 2026-08-13, varrendo as **13 páginas públicas** do grupo `(site)` e
as **7 rotas de feed**.

### O que já estava certo (e continua)

| | Onde |
|---|---|
| `metadataBase`, título com template, descrição e favicon vindos do banco | `app/layout.tsx` |
| Canônica própria | matéria, editoria, tag, autor, busca, menu, últimas, colunistas, enquetes, privacidade, termos |
| `og:type=article` com `publishedTime`/`modifiedTime`/`section`/`tags` | matéria |
| `noindex, follow` na busca e no menu | as duas páginas que não têm o que indexar |
| `NewsArticle`, `WebSite` + `SearchAction`, `ProfilePage`, `BreadcrumbList`, `NewsMediaOrganization` | `lib/structured-data.ts` |
| Índice de sitemaps + geral + um por editoria + news-sitemap (48 h, ≤1.000) | `app/sitemap*.xml`, `app/news-sitemap.xml` |
| RSS geral e por editoria, com `atom:link rel=self` | `app/rss.xml`, `(site)/[editoria]/rss.xml` |
| `robots.txt` liberando o portal e barrando painel/API | `app/robots.ts` |
| `max-image-preview: large` (requisito prático do Discover) | `app/layout.tsx` |

### Os 19 achados

Numerados A1–A19; a coluna "peso" é o efeito estimado sobre tráfego orgânico.

| # | Achado | Peso |
|---|---|---|
| **A1** | **`og:site_name` e `og:locale` somem em 5 páginas.** O Next **substitui o objeto `openGraph` inteiro** quando um filho declara o seu (`mergeMetadata`, `resolve-metadata.ts`) — não é merge profundo. Matéria, editoria, tag e autor declaram `openGraph` e, com isso, perdem `siteName`, `locale` e `type` que a raiz define | Alto |
| **A2** | **`og:url` aponta para a home** em toda página que **não** declara `openGraph`: ela herda o objeto da raiz inteiro, inclusive `url: site.url`. Últimas, colunistas, enquetes, privacidade, termos e busca anunciavam a home como sua URL social | Alto |
| **A3** | **A home não tem metadata própria** — sem canônica, sem `og:title`/`og:description` dela | Alto |
| **A4** | **Nenhuma página tem `og:image` por padrão.** Só a matéria COM capa. O link do portal no WhatsApp — o formato que o leitor local mais vê — saía sem imagem | Alto |
| **A5** | **A paginação canonicaliza para a página 1.** `?page=2` de editoria, tag, autor e últimas declarava a página 1 como canônica: o Google descarta a 2 e as matérias que só aparecem lá ficam órfãs de link interno | Alto |
| **A6** | **`?ordem=` duplica cada editoria** (3 ordenações × N editorias) sem canônica apontando para a base | Médio |
| **A7** | **Duas fontes de verdade para a URL do veículo.** `metadataBase` e o `og:*` da raiz vêm do BANCO; canônicas dos feeds, sitemaps, `robots.txt` e schema.org vinham do ARQUIVO (`config/site.ts`). Trocar o domínio nas Configurações produzia um portal que se declara em dois domínios | Alto |
| **A8** | **`generateMetadata` devolvia `{}`** quando a matéria/editoria/tag/autor não existe — o 404 herdava o título da home | Baixo |
| **A9** | **`robots.txt` não fecha o espaço de rastreio**: `/busca?q=` é infinito, `?ordem=` e `?page=` multiplicam URLs, `/reset-password` estava liberada | Médio |
| **A10** | **Sitemap sem `lastmod`** no índice e nas entradas de navegação — o rastreador revisita no escuro | Médio |
| **A11** | **Sitemap sem extensão de imagem** — as capas não entram no Google Imagens | Médio |
| **A12** | **RSS mínimo**: sem `lastBuildDate`, `ttl`, `image`, autor por item nem imagem (`enclosure`) | Médio |
| **A13** | **`NewsArticle` incompleto**: `image` como string solta (o Google pede `ImageObject` com dimensões), sem `isPartOf`, sem `speakable` | Médio |
| **A14** | **Listagens sem `CollectionPage`/`ItemList`** — editoria, tag, autor, últimas e colunistas não dizem ao buscador o que listam | Médio |
| **A15** | **`Organization` sem endereço nem `contactPoint`**, embora os dados existam nas Configurações. É o que alimenta o painel de conhecimento local | Médio |
| **A16** | **Sem `manifest` e sem `theme-color`** | Baixo |
| **A17** | **Sem verificação do Search Console** — não havia como provar a propriedade do domínio sem editar código | Médio |
| **A18** | **A capa sai sem `width`/`height`** no `<img>`: CLS (Core Web Vitals é sinal de ranqueamento) e `og:image` sem dimensões, o que faz o WhatsApp às vezes recusar a prévia | Médio |
| **A19** | **`(site)/not-found.tsx` não tem título próprio.** O Next injeta `noindex` sozinho em resposta 404, então não há risco de indexação — o custo é só a aba com o nome da home | Baixo |

---

## 3. Escopo

### Entra

| # | Etapa | Entrega |
|---|---|---|
| S1 | Fonte única | `lib/seo/site-identity.ts` — a identidade do veículo lida do banco, consumida por metadata, schema.org, feeds e `robots.txt` (resolve **A7**) |
| S2 | Construtor de metadata | `lib/seo/metadata.ts` — `pageMetadata()` monta o `openGraph` COMPLETO em toda página (resolve **A1**, **A2**, **A3**); `canonicalFor()` trata paginação e ordenação (**A5**, **A6**) |
| S3 | Imagem social | `/og` — `ImageResponse` 1200×630 com a marca e o título da página (**A4**) |
| S4 | Dados estruturados | `Organization` com endereço/contato, `NewsArticle` com `ImageObject`/`isPartOf`/`speakable`, `CollectionPage` + `ItemList` nas listagens (**A13**, **A14**, **A15**) |
| S5 | Feeds | `lastmod` no índice e na navegação, extensão de imagem, RSS com `lastBuildDate`/`ttl`/`image`/`enclosure`/autor (**A10**, **A11**, **A12**) |
| S6 | Rastreio | `robots.txt` fechando busca, ordenação e `/reset-password` (**A9**) |
| S7 | Acessórios | `manifest.ts`, `theme-color`, `GOOGLE_SITE_VERIFICATION`, dimensões da capa e `fetchPriority` (**A16**, **A17**, **A18**), título próprio de "não encontrado" (**A8**) |

### Não entra (e por quê)

- **`next/image` no portal.** A capa e as fotos de lista usam `<img>` cru. Migrar
  exige `remotePatterns` para o host do R2, orçamento de transformação e uma
  decisão sobre custo — é uma entrega de performance com nome próprio, já
  registrada em `pendencias.md`. O que entra aqui é o barato e imediato:
  `width`/`height` para matar o CLS.
- **AMP.** O Google removeu a exigência de AMP para o carrossel de Top Stories em
  2021. Manter uma segunda renderização do portal para nada seria dívida pura.
- **Página de "Quem somos" / princípios editoriais.** São sinais de E-E-A-T de
  verdade, mas são CONTEÚDO — precisam de um CMS de páginas estáticas ou de
  texto escrito pelo cliente. Fica para a spec de páginas institucionais.
- **`hreflang` / multi-idioma.** Um idioma, um país.
- **Analytics de busca (Search Console API no painel).** O `GOOGLE_SITE_VERIFICATION`
  abre a porta; ler os dados de dentro do painel é outra entrega.
- **Revalidação por evento.** Os feeds ainda são `force-dynamic` com cache de CDN
  de 5 min. É a mesma pendência da Etapa 5, não desta spec.
- **Título do `(site)/not-found.tsx` (A19).** Fica como está: o Next só aceita
  `metadata`/`generateMetadata` em `layout` e `page`, e `not-found` não é
  nenhum dos dois. O que dava para consertar foi consertado — as rotas
  dinâmicas (matéria, editoria, tag, autor) agora devolvem
  `notFoundMetadata()` em vez de `{}`, então a URL inexistente COM rota
  conhecida já tem título próprio. Sobra a URL sem rota nenhuma, que herda o
  título da home na aba. O Next injeta `noindex` sozinho em resposta 404, então
  não há risco de indexação — é cosmético.

---

## 4. Decisões

### D1 — A identidade do veículo é a do banco, em TODO lugar

`config/site.ts` continua existindo como **defaults**, mas nenhum gerador de SEO
o lê mais direto. `loadSiteIdentity()` devolve a identidade resolvida (nome, URL
sem barra final, descrição, logo absoluto, contato, redes) e é ela que alimenta
`generateMetadata`, schema.org, sitemaps, RSS e `robots.txt`.

**Por quê:** com duas fontes, trocar o domínio nas Configurações produzia um
portal cujas tags `og:url` diziam um domínio e cujo `sitemap.xml` dizia outro. O
Google resolve esse conflito ignorando o site — em silêncio, sem aviso no Search
Console. É a classe de erro que só aparece três semanas depois, no gráfico de
tráfego.

**Consequência:** `structured-data.ts` e `feed.ts` deixaram de importar
`siteConfig` e passaram a **receber** a identidade por parâmetro. Isso os torna
funções puras — testáveis sem banco, que é a regra da casa para código novo.

### D2 — Toda página monta o `openGraph` completo, sempre

Nada de "a raiz define e o filho complementa": o Next **substitui** o objeto
inteiro. `pageMetadata()` é o único lugar que monta `openGraph`, e ele sempre
emite `siteName`, `locale`, `type`, `url`, `title`, `description` e `images`.

**Por quê:** o merge raso do Next é uma armadilha silenciosa — a tag some do HTML
e nada quebra. Centralizar é o que garante que a próxima página nasça correta sem
ninguém se lembrar da regra.

### D3 — A canônica da página paginada é ela mesma

`/{editoria}?page=2` canonicaliza para `/{editoria}?page=2`, não para a página 1.
`?ordem=` **não** entra na canônica: é a mesma lista em outra ordem.

**Por quê:** apontar a página 2 para a 1 diz ao Google "esta página é uma cópia";
ele então não rastreia os links dela, e as matérias que só aparecem na página 2
perdem o único caminho interno que tinham. Autocanônica por página é a
recomendação atual do Google desde que `rel=prev/next` foi aposentado (2019).

### D4 — Imagem social gerada, não desenhada

`/og?title=…&eyebrow=…` renderiza um PNG 1200×630 com a marca. Matéria com capa
continua usando a capa; todo o resto usa o gerado.

**Por quê:** a alternativa era um `og-default.png` fixo — um único cartão igual
para as 13 páginas, que no feed do WhatsApp vira ruído visual indistinguível.
Gerar custa uma rota e nenhum asset binário no repositório, e cada página ganha
um cartão com o próprio título. O texto é **truncado e escapado** na rota: o
parâmetro é público e não pode virar uma tela em branco com 4.000 caracteres.

### D5 — `speakable` entra; `keywords` de news-sitemap não

`SpeakableSpecification` marca manchete e linha fina como o trecho que um
assistente de voz deve ler. É barato, é suportado, e é especialmente coerente com
um veículo que nasceu no rádio.

`news:keywords` e `news:genres`, ao contrário, **foram descontinuados** pelo
Google — emiti-los seria XML morto no feed.

### D6 — O que é ruído para o buscador é barrado no `robots.txt`, não no `<meta>`

Busca (`/busca`), menu (`/menu`) e ordenações (`?ordem=`) já tinham tratamento por
`meta robots`, mas isso só age DEPOIS do rastreio. O `Disallow` corta antes,
economizando o orçamento de rastreio para as matérias.

**Ressalva registrada:** `Disallow` numa URL que já esteja indexada impede o
Google de ler o `noindex` dela. As duas páginas afetadas (`/busca`, `/menu`)
nunca foram enviadas em sitemap e não têm link externo — o risco é teórico aqui,
mas a ordem certa em geral é `noindex` primeiro, `Disallow` depois de sair do
índice.

### D7 — Verificação do Search Console por variável de ambiente

`GOOGLE_SITE_VERIFICATION` é opcional. Sem ela, nenhuma tag é emitida.

**Por quê:** é um segredo por ambiente (produção tem um, preview tem outro), e
cravá-lo no código faria o preview reivindicar a propriedade do domínio de
produção. Opcional porque dev, build e CI não podem depender de conta em serviço
nenhum — a mesma regra de N10 que vale para Resend, Redis e AwesomeAPI.

---

## 5. Mapa das páginas depois da entrega

| Rota | Indexa? | Canônica | `og:image` | Dados estruturados |
|---|---|---|---|---|
| `/` | Sim | `/` | gerado | `WebSite`+`SearchAction`, `ItemList` das manchetes |
| `/{editoria}` | Sim | com `?page` | gerado | `CollectionPage`+`ItemList`, `BreadcrumbList` |
| `/{editoria}/{slug}` | Sim | limpa | **capa**, com fallback gerado | `NewsArticle`, `BreadcrumbList` |
| `/autor/{slug}` | Sim | com `?page` | foto, com fallback gerado | `ProfilePage`, `ItemList`, `BreadcrumbList` |
| `/tag/{slug}` | Sim | com `?page` | gerado | `CollectionPage`+`ItemList`, `BreadcrumbList` |
| `/ultimas` | Sim | com `?page` | gerado | `CollectionPage`+`ItemList`, `BreadcrumbList` |
| `/colunistas` | Sim | `/colunistas` | gerado | `CollectionPage`+`ItemList`, `BreadcrumbList` |
| `/enquetes` | Sim | `/enquetes` | gerado | `CollectionPage`, `BreadcrumbList` |
| `/privacidade` | Sim | `/privacidade` | gerado | `BreadcrumbList` |
| `/termos` | Sim | `/termos` | gerado | `BreadcrumbList` |
| `/busca` | **Não** (`noindex, follow` + `Disallow`) | `/busca` | gerado | — |
| `/menu` | **Não** (`noindex, follow` + `Disallow`) | `/menu` | gerado | — |
| 404 | Não (`noindex` automático do Next em resposta 404) | — | — | — |

Feeds: `/robots.txt` · `/sitemap.xml` (índice) · `/sitemap-geral.xml` ·
`/{editoria}/sitemap.xml` · `/news-sitemap.xml` · `/rss.xml` ·
`/{editoria}/rss.xml` · `/manifest.webmanifest` · `/og`.

---

## 6. Arquivos

**Novos**

- `apps/web/src/lib/seo/site-identity.ts` — identidade resolvida (puro + loader)
- `apps/web/src/lib/seo/metadata.ts` — `pageMetadata`, `canonicalFor`, `ogImageUrl`
- `apps/web/src/app/og/route.tsx` — imagem social gerada
- `apps/web/src/app/manifest.ts`
- `apps/web/tests/unit/seo-metadata.test.ts`, `seo-site-identity.test.ts`,
  `structured-data.test.ts`, `feed.test.ts`

**Alterados**

- `app/layout.tsx` (verificação, `theme-color`), `app/robots.ts`,
  `app/sitemap.xml`, `app/sitemap-geral.xml`, `app/news-sitemap.xml`,
  `app/rss.xml`, `(site)/[editoria]/{rss,sitemap}.xml`
- Todas as 12 páginas do `(site)`
- `lib/structured-data.ts`, `lib/feed.ts`, `components/news/article-header.tsx`
  (os âncoras `data-speakable`)
- `data/types.ts` e `data/read-model.ts` (dimensões da capa)
- `packages/env/src/server.ts` e `apps/web/.env.example`
  (`GOOGLE_SITE_VERIFICATION`)

---

## 7. Verificação

Não há teste automatizado que prove "o Google indexou". O que dá para provar em
casa, e é o que os testes cobrem:

1. **Unitário, sem banco** — `pageMetadata` emite `og:site_name`/`locale`/`url`
   em toda chamada; `canonicalFor` preserva `?page` e descarta `?ordem`;
   `ogImageUrl` escapa e trunca; o XML dos feeds escapa `&` e `<`; o
   `NewsArticle` traz os campos obrigatórios do Google.
2. **Manual, uma vez** — colar uma matéria e a home no
   [Rich Results Test](https://search.google.com/test/rich-results) e no
   depurador de compartilhamento do Facebook; conferir `curl -s /sitemap.xml` e
   `/rss.xml` contra um validador de XML.
3. **Depois do deploy** — enviar `/sitemap.xml` no Search Console e acompanhar
   "Páginas" por duas semanas. É o único lugar onde erro de canônica aparece.

O que **não** é verificável e fica registrado como risco: a validade da
`GOOGLE_SITE_VERIFICATION` e a aceitação no Google News (que é um cadastro
manual, no Publisher Center, e não uma consequência do código).
