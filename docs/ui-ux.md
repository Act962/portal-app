# Diretrizes de UI/UX

> **Status:** Aprovado em 03/08/2026.
> Referência de escopo e estrutura: portais regionais brasileiros como o Hora Piauí. A inspiração
> é de **escopo e funcionalidade**, nunca de cópia visual — a identidade será própria.

---

## 1. Princípios

1. **A notícia é o produto.** Tudo que compete com o texto (banner intrusivo, pop-up, animação)
   é dívida de UX. Anúncio tem lugar definido; não invade a leitura.
2. **Velocidade é usabilidade.** Em portal de notícias, metade do tráfego vem de rede móvel e
   redes sociais. Página que demora 4 s perde o leitor antes de existir.
3. **Escaneabilidade antes de leitura.** O leitor varre a home em segundos. Hierarquia visual
   precisa entregar "o que aconteceu de mais importante" sem esforço.
4. **Acessível por padrão, não por correção.** Acessibilidade entra no componente, não em
   auditoria posterior. Onde possível, vira **invariante de domínio** — imagem sem texto
   alternativo não passa da publicação (ver `architecture.md`, seção 2.1).
5. **Consistência acima de criatividade pontual.** Um sistema de design pequeno e bem aplicado
   envelhece melhor que telas artesanais.

---

## 2. Fundamentos visuais

### Tipografia

O corpo da matéria é a tela mais importante do produto e recebe tratamento próprio.

| Uso | Definição |
|---|---|
| Corpo do texto | **18–20 px** no mobile, 19–21 px no desktop. Nunca abaixo de 16 px |
| Largura de linha | **65–75 caracteres** (`max-width: 68ch`) |
| Altura de linha | 1,65 no corpo · 1,2–1,3 em títulos |
| Espaço entre parágrafos | ~0,8em — respiro sem fragmentar |
| Fonte de leitura | Serifada com boa renderização em tela, ou sans-serif humanista |
| Fonte de interface | Sans-serif (títulos, menus, painel admin) |

Escala tipográfica em razão 1.25 (Major Third), definida como token em
`packages/ui/src/styles/globals.css`. Nada de tamanho arbitrário em componente.

**Regra:** no máximo **duas famílias** de fonte no site inteiro, com no máximo 4 pesos carregados.
Cada peso extra é bloqueio de renderização.

### Cor

- Paleta neutra dominante; **cor é reservada para significado**: editoria, urgente, link, alerta.
- Cada editoria tem uma cor de identificação (usada em chapéu e borda), sempre validada em
  contraste.
- Nenhuma informação transmitida **só** por cor — "urgente" tem rótulo textual, não apenas
  vermelho (WCAG 1.4.1).
- **Dark mode desde o MVP** (o `next-themes` já está no scaffold). Ambos os temas passam pelos
  mesmos limiares de contraste — dark mode mal calibrado é a fonte mais comum de falha de contraste.

### Espaçamento e grade

- Escala de espaçamento base 4 px (tokens do Tailwind), sem valores mágicos.
- Grade de 12 colunas no desktop; 4 no mobile.
- Breakpoints mobile-first: `sm 640` · `md 768` · `lg 1024` · `xl 1280` · `2xl 1536`.
- Alvos de toque de **no mínimo 44×44 px** com 8 px de separação (WCAG 2.5.8).

---

## 3. Acessibilidade — WCAG 2.2 nível AA

Compromisso formal: **AA em todas as páginas públicas e no painel administrativo.** No Brasil isso
também dialoga com a Lei Brasileira de Inclusão e com a eMAG para conteúdo de interesse público.

### Requisitos obrigatórios

| Critério | Aplicação |
|---|---|
| Contraste 1.4.3 | 4,5:1 em texto normal · 3:1 em texto grande e elementos de interface |
| Redimensionamento 1.4.4 | Zoom de 200% sem perda de conteúdo ou scroll horizontal |
| Estrutura 1.3.1 | Landmarks (`header`, `nav`, `main`, `aside`, `footer`) e um único `h1` por página |
| Hierarquia de títulos | `h1 → h2 → h3` sem pular nível — leitores de tela navegam por eles |
| Teclado 2.1.1 | Todo recurso operável por teclado; nenhuma armadilha de foco |
| Foco visível 2.4.7 / 2.4.11 | Indicador de foco nítido e nunca obscurecido por barra fixa |
| Pular para o conteúdo 2.4.1 | Primeiro elemento focável da página |
| Texto alternativo 1.1.1 | Obrigatório e validado no domínio; imagem decorativa recebe `alt=""` |
| Legendas 1.2.2 | Vídeo com legenda; áudio com transcrição |
| Movimento 2.3.3 | Respeitar `prefers-reduced-motion`; nenhum autoplay com som |
| Formulários 3.3.1–3.3.3 | `label` associado, erro descrito em texto, instrução de correção |
| Conteúdo dinâmico 4.1.3 | `aria-live` em "carregar mais", toasts e resultados de busca |
| Idioma 3.1.1 | `<html lang="pt-BR">` |

### Detalhes específicos de portal de notícias

- **Links descritivos.** "Leia mais" repetido 40 vezes na home é inútil para quem navega por lista
  de links. O link é o título da matéria.
- **Data legível por máquina e por humano:** `<time datetime="2026-08-03T10:00">3 de agosto, 10h</time>`.
- **Créditos e legendas** de foto em `<figcaption>`, dentro de `<figure>`.
- **Galeria e carrossel** — se existirem, controláveis por teclado, com contador ("3 de 12") e
  botão de pausa.
- **Anúncio** nunca captura o foco nem se move sozinho no viewport.

Validação automática está descrita em `testing-strategy.md`, seção 12.

---

## 4. Performance e Core Web Vitals

Metas travadas no CI (Lighthouse CI falha o PR se estourar):

| Métrica | Meta | Estratégia |
|---|---|---|
| **LCP** | < 2,5 s | Imagem de capa com `priority` e dimensões explícitas; HTML do CDN via ISR |
| **INP** | < 200 ms | RSC: portal público envia JS mínimo; interatividade só onde é necessária |
| **CLS** | < 0,1 | Toda imagem com `width`/`height`; **slot de anúncio com altura reservada**; fontes com `size-adjust` |
| **TTFB** | < 600 ms | ISR + CDN; cache Redis para blocos da home |
| JS inicial | < 150 KB | Sem biblioteca de estado global no portal; componentes cliente isolados |

**Decisões de performance que valem mais que otimização posterior:**

- **Imagens** via `next/image` com AVIF/WebP e `sizes` correto. Foto de portal é o maior peso da
  página — o ganho está aqui, não em minificação de JS.
- **`FocalPoint` no `MediaAsset`** (ver `architecture.md`, seção 2.4): o corte responsivo respeita
  o ponto focal, evitando cortar a cabeça do entrevistado no mobile.
- **Fontes** auto-hospedadas via `next/font`, com `display: swap` e subset latino.
- **Lazy loading** abaixo da dobra; conteúdo acima da dobra nunca é lazy.
- **Anúncio e widget de terceiro** carregam depois do conteúdo, em contêiner com altura fixa.
- **Sem carrossel automático na home** — custa banda, prejudica CLS e tem baixa taxa de clique
  fora da primeira posição.

---

## 5. SEO para notícias

Para um portal, SEO não é marketing — é o principal canal de distribuição.

### URLs

```
/                              home
/{editoria}                    ex.: /politica
/{editoria}/{slug}             ex.: /politica/prefeitura-anuncia-obras-na-avenida-central
/tag/{slug}
/autor/{slug}
/busca?q=termo
```

Sem data na URL (permite atualizar matéria sem parecer velha) e sem ID numérico. O `slug` é
**imutável após a primeira publicação** — isso é invariante de domínio, não convenção: URL que
quebra destrói ranking e links externos. Mudança de título gera `redirect 301` do slug antigo.

### Marcação obrigatória por página de matéria

- **JSON-LD `NewsArticle`**: `headline` (≤110 caracteres), `datePublished`, `dateModified`,
  `author` (com link para a página do autor), `publisher`, `image` (≥1200 px de largura),
  `articleSection`, `keywords`.
- **JSON-LD `BreadcrumbList`** e, no site todo, `Organization` com logo e redes.
- **Canonical** em toda página; paginação com `rel="prev/next"` lógico.
- **Open Graph + Twitter Card** — determinam a aparência do link no WhatsApp, principal vetor de
  compartilhamento no Brasil.
- `robots`: `max-image-preview:large` (requisito prático para o Google Discover).

### Feeds e sitemaps

| Recurso | Observação |
|---|---|
| `/sitemap.xml` | Índice, particionado por editoria |
| `/news-sitemap.xml` | **Apenas as últimas 48 h**, máximo 1.000 URLs — exigência do Google News |
| `/rss.xml` e `/{editoria}/rss.xml` | Agregadores e parceiros |
| `/robots.txt` | Com referência aos sitemaps |

### E-E-A-T
Página de autor com biografia, foto, especialidade e histórico de matérias; assinatura sempre
visível e vinculada; data de atualização explícita quando a matéria é editada. O Google pondera
autoria em conteúdo jornalístico — e a estrutura já existe no contexto *Identidade* (`AuthorProfile`).

---

## 6. Telas do portal público

### 6.1 Home

Composição em blocos gerenciáveis pela redação (não hard-coded):

1. **Barra superior** — logo, editorias principais, busca, alternador de tema, "últimas".
2. **Manchete** — 1 matéria em destaque máximo: imagem grande, chapéu, título, linha fina.
3. **Chamadas secundárias** — 2 a 4 matérias de peso, grade responsiva.
4. **Plantão / Últimas notícias** — lista cronológica compacta, com horário.
5. **Blocos por editoria** — para cada editoria configurada: título, 1 destaque + 3 chamadas.
6. **Mais lidas** — top 5 das últimas 24 h (Redis, ver `stack.md` 4.4).
7. **Especiais/séries** — quando houver.
8. **Rodapé** — expediente, contato, política de privacidade, redes, RSS.

*Mobile:* coluna única, manchete primeiro, blocos de editoria colapsáveis, menu em drawer.

### 6.2 Página de editoria
Cabeçalho com nome, descrição e cor da editoria; destaque + grade paginada; filtro por
subeditoria e tag; feed RSS próprio.

### 6.3 Página da matéria — a tela mais importante

```
┌─────────────────────────────────────────┐
│ trilha: Home › Política                 │  breadcrumb (com JSON-LD)
│ CHAPÉU                                  │  kicker — contextualiza
│ Título da matéria (h1)                  │  máx. ~110 caracteres
│ Linha fina explicando o assunto         │  standfirst
│ Por Autor · 3 ago 2026, 10h · 4 min     │  assinatura, data, tempo de leitura
│ [compartilhar: WhatsApp X FB link]      │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │        imagem de capa               │ │  com legenda + crédito
│ └─────────────────────────────────────┘ │
│                                         │
│ Corpo em blocos: parágrafo, intertítulo,│  largura 68ch
│ citação, imagem, galeria, embed,        │
│ lista, "leia também", destaque          │
│                                         │
│ Tags relacionadas                       │
│ Compartilhamento (fim da leitura)       │
├─────────────────────────────────────────┤
│ Leia também — 4 matérias relacionadas   │
│ Comentários (pós-MVP)                   │
└─────────────────────────────────────────┘
```

Detalhes que importam:
- **Barra de progresso de leitura** discreta (só desktop), sem custo de layout.
- **Data de atualização** exibida quando houver edição relevante após a publicação.
- **"Leia também"** por editoria e tags — retenção é a métrica mais valiosa do portal.
- **Blocos ricos** renderizados a partir do JSON estruturado (ver `stack.md`, Decisão 5), o que
  permite reaproveitar o mesmo conteúdo em newsletter e app sem reescrever.

### 6.4 Busca
Campo persistente no cabeçalho; página de resultados com termo destacado, filtros por editoria,
período e autor; ordenação por relevância ou data; estado vazio útil (sugestões e mais lidas).

### 6.5 Outras
Página de tag · Página de autor (bio + matérias) · Newsletter · **404 útil** (busca + mais lidas,
nunca um beco sem saída) · Página de erro.

---

## 7. Painel administrativo

Público diferente, prioridades diferentes: aqui **densidade e velocidade de operação** valem mais
que estética. Quem usa passa o dia na ferramenta.

### 7.1 Dashboard
Matérias aguardando revisão (fila do editor), meus rascunhos, agendadas para hoje, publicadas nas
últimas 24 h, mais lidas do momento. Cada cartão é um atalho para ação, não só informação.

### 7.2 Lista de matérias
Tabela densa com busca, filtros (status, editoria, autor, período), ordenação e ações em lote.
Estado visualmente codificado (rascunho, em revisão, aprovada, agendada, publicada, arquivada).
Paginação por cursor — a lista cresce indefinidamente.

### 7.3 Editor de matéria

Layout de duas colunas: edição à esquerda, metadados à direita.

- **Esquerda:** chapéu, título (com contador de caracteres para SEO), linha fina e corpo em blocos
  no editor **TipTap** — headless, portanto estilizado inteiramente pelo nosso design system, com
  a mesma tipografia de leitura do portal (o redator vê o texto como o leitor verá).
- **Direita:** editoria, tags, imagem de capa, autor, status/agendamento, SEO (título e descrição
  com pré-visualização de como aparecerá no Google e no WhatsApp), configurações (comentários,
  destaque).
- **Autosave** de rascunho com indicador claro de "salvo às HH:MM" — perder texto é o pior erro
  possível em ferramenta de redação.
- **Aviso de edição concorrente**: se outra pessoa abrir a mesma matéria, avisar. Bloqueio total é
  frustrante; silêncio causa perda de trabalho.
- **Pré-visualização** que renderiza exatamente como o portal.
- **Validação antes de publicar**: a interface mostra as pendências (falta capa, falta alt text,
  falta editoria) **antes** do clique, refletindo as invariantes do agregado `Article`.
- **Histórico de versões** com comparação e restauração.

### 7.4 Agendamento
Seleção de data/hora com fuso explícito (America/Sao_Paulo), visão de calendário das matérias
agendadas, e possibilidade de cancelar ou reagendar. Feedback claro do que acontece no horário.

### 7.5 Biblioteca de mídia
Grade com busca, filtro por tipo e data, upload por arrastar-e-soltar com progresso.
**Legenda, crédito e texto alternativo são obrigatórios** no upload — regra de negócio, com
mensagem que explica por quê (acessibilidade e direito autoral), não um erro seco. Recorte com
definição de ponto focal.

### 7.6 Editorias e tags
CRUD com ordenação por arrastar, cor, slug, descrição e SEO. Editoria com matérias publicadas só
pode ser **desativada**, nunca excluída — a interface explica o motivo em vez de só bloquear.

### 7.7 Usuários e permissões
Lista com papel e status; convite por e-mail; atribuição de papéis **admin / editor / redator**;
editor pode ser vinculado a editorias específicas. A tela exibe uma matriz clara de "o que cada
papel pode fazer" — permissão que ninguém entende é permissão mal configurada.

### 7.8 Moderação de comentários *(pós-MVP)*
Fila de pendentes com contexto da matéria, ações em lote, filtro de denúncias e lista de termos
bloqueados.

### 7.9 Auditoria
Registro imutável de quem publicou, editou, despublicou ou alterou permissão, e quando.
Em veículo de comunicação isso é requisito de responsabilidade editorial, não recurso opcional.

### 7.10 Configurações
Dados do veículo (nome, logo, expediente), redes sociais, blocos da home, integrações
(Analytics, Search Console), políticas de comentário.

---

## 8. Design system

Base já existente: `packages/ui` com shadcn/ui + Tailwind v4 (estilo `base-lyra`, cor neutra,
ícones Lucide).

**Como cresce:**
- **Tokens** (cor, tipografia, espaçamento, raio, sombra) em
  `packages/ui/src/styles/globals.css`, como variáveis CSS — nunca valor cru no componente.
- **Primitivos compartilhados** (`Button`, `Input`, `Dialog`, `Table`…) em `packages/ui`, via
  `npx shadcn@latest add <componente> -c packages/ui`.
- **Blocos específicos** do portal (`ArticleCard`, `SectionBlock`, `Byline`, `ArticleBody`) em
  `apps/web/src/components` — não poluem o pacote compartilhado.
- Todo componente compartilhado nasce com teste de acessibilidade (`vitest-axe`).
- Componente novo só é criado depois de verificar que não existe equivalente — duplicação em
  design system é o começo da inconsistência.

**Estados obrigatórios** em todo componente de dados: carregando (skeleton com a mesma altura do
conteúdo final, para não gerar CLS), vazio (com ação sugerida), erro (com opção de repetir) e
sucesso.
