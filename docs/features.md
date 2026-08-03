# Funcionalidades — Lista Priorizada

> **Status:** Aprovado em 03/08/2026.
> Priorização em MoSCoW. Cada item traz um **critério de aceite** em uma linha — é a semente da
> spec detalhada que será escrita antes da implementação (ver `roadmap.md`).

**Legenda:** 🔴 Must (MVP) · 🟡 Should (pós-MVP próximo) · 🟢 Could (futuro) · ⚪ Won't (fora de escopo agora)

---

## 1. Definição do MVP

**O MVP é o menor sistema em que uma redação real consegue trabalhar todos os dias.** Concretamente:
um redator escreve, um editor aprova e publica, e o leitor encontra e lê a matéria — com SEO
correto e desempenho adequado.

Tudo que não serve a essa frase foi empurrado para depois, por mais tentador que fosse.
Comentários, newsletter e analytics próprio são valiosos — mas o portal existe sem eles; sem
workflow editorial, não.

---

## 2. Portal público

### 2.1 Home 🔴

| # | Funcionalidade | Critério de aceite |
|---|---|---|
| P01 | Manchete principal | A matéria marcada como manchete aparece em destaque máximo, com imagem, chapéu, título e linha fina |
| P02 | Chamadas secundárias | Até 4 matérias de destaque em grade responsiva, definidas pela redação |
| P03 | Blocos por editoria | Cada editoria ativa exibe 1 destaque + 3 chamadas, na ordem configurada no admin |
| P04 | Últimas notícias | Lista cronológica com horário, atualizada a cada publicação |
| P05 | Mais lidas (24 h) | Top 5 calculado a partir de contadores em Redis, com fallback quando o cache estiver frio |
| P06 | Composição gerenciável | A ordem dos blocos da home é configurável no admin sem deploy |
| P07 | Dark mode | Alternância clara/escuro/sistema, persistida, sem "flash" na primeira renderização |

### 2.2 Navegação e listagens 🔴

| # | Funcionalidade | Critério de aceite |
|---|---|---|
| P08 | Página de editoria | `/{editoria}` lista as matérias publicadas, paginadas, com destaque no topo |
| P09 | Página de tag | `/tag/{slug}` lista matérias com aquela tag |
| P10 | Página de autor | `/autor/{slug}` exibe bio, foto e matérias assinadas (base do E-E-A-T) |
| P11 | Menu e navegação | Editorias principais no topo; menu completo em drawer no mobile |
| P12 | Paginação por cursor | Listagens longas paginam sem degradar com o crescimento do acervo |

### 2.3 Página da matéria 🔴

| # | Funcionalidade | Critério de aceite |
|---|---|---|
| P13 | Renderização de blocos | Parágrafo, intertítulo, citação, imagem, galeria, lista, embed e "leia também" renderizam a partir do JSON estruturado |
| P14 | Cabeçalho editorial | Chapéu, título, linha fina, assinatura com link, data e tempo estimado de leitura |
| P15 | Imagem de capa | Exibida com legenda e crédito, com ponto focal respeitado no corte responsivo |
| P16 | Compartilhamento | WhatsApp, X, Facebook e copiar link, com prévia correta (Open Graph) |
| P17 | Matérias relacionadas | 4 sugestões por editoria e tags ao fim da leitura |
| P18 | Data de atualização | Exibida quando a matéria for editada após a publicação |
| P19 | Barra de progresso | Indicador discreto de progresso de leitura no desktop |

### 2.4 Busca 🔴

| # | Funcionalidade | Critério de aceite |
|---|---|---|
| P20 | Busca full-text | Busca por título, linha fina, corpo e tags retorna resultados ordenados por relevância |
| P21 | Filtros | Filtrar resultados por editoria, autor e período |
| P22 | Estado vazio útil | Sem resultado, sugere termos e exibe mais lidas |
| P23 | Busca tolerante a erro de digitação 🟡 | Com Meilisearch (Fase 5): "prefeitra" encontra "prefeitura" |

### 2.5 SEO e distribuição 🔴

| # | Funcionalidade | Critério de aceite |
|---|---|---|
| P24 | JSON-LD | Toda matéria expõe `NewsArticle` + `BreadcrumbList` válidos no Rich Results Test |
| P25 | Metadados sociais | Open Graph e Twitter Card corretos em todas as páginas |
| P26 | `sitemap.xml` | Índice particionado por editoria, atualizado automaticamente |
| P27 | `news-sitemap.xml` | Contém apenas as últimas 48 h, no máximo 1.000 URLs |
| P28 | RSS | Feed geral e um por editoria |
| P29 | URLs estáveis | Slug imutável após publicação; alteração de título gera redirect 301 |
| P30 | ISR + invalidação | Publicação/edição invalida apenas as rotas afetadas (`revalidateTag`) |

### 2.6 Pós-MVP do portal

| # | Funcionalidade | Prioridade |
|---|---|---|
| P31 | Comentários com moderação | 🟡 |
| P32 | Newsletter (inscrição + envio) | 🟡 |
| P33 | Leitor cadastrado: salvar matéria, seguir editoria | 🟡 |
| P34 | Cobertura "ao vivo" (tempo real) | 🟢 |
| P35 | Push notification (web push) | 🟢 |
| P36 | Especiais e séries editoriais | 🟢 |
| P37 | Editoria de vídeos com player próprio | 🟢 |
| P38 | PWA / modo offline | 🟢 |
| P39 | Enquetes e conteúdo interativo | 🟢 |
| P40 | Paywall / assinatura | ⚪ Fora de escopo até haver decisão de modelo de negócio |
| P41 | Versão AMP | ⚪ Google reduziu o peso de AMP; não compensa a manutenção |

---

## 3. Painel administrativo

### 3.1 Matérias — CRUD e workflow 🔴

| # | Funcionalidade | Critério de aceite |
|---|---|---|
| A01 | Criar e editar matéria | Redator cria rascunho com chapéu, título, linha fina, corpo em blocos, capa, editoria e tags |
| A02 | Workflow editorial | Estados `RASCUNHO → EM_REVISÃO → APROVADA → AGENDADA → PUBLICADA → ATUALIZADA → ARQUIVADA`; transição inválida é rejeitada pelo domínio |
| A03 | Submeter para revisão | Redator envia para a fila do editor; editor pode devolver com **motivo obrigatório** |
| A04 | Publicar | Somente editor/admin. Bloqueado se faltar capa, alt text ou editoria — com as pendências listadas na interface antes do clique |
| A05 | Despublicar / arquivar | Matéria publicada nunca é apagada, apenas arquivada (integridade do acervo) |
| A06 | Autosave de rascunho | Salvamento automático com indicador de "salvo às HH:MM" |
| A07 | Histórico de versões | Ver, comparar e restaurar versões anteriores |
| A08 | Pré-visualização | Renderiza exatamente como o portal, inclusive antes de publicar |
| A09 | Edição concorrente | Aviso quando outra pessoa está editando a mesma matéria |
| A10 | Lista com filtros | Filtrar por status, editoria, autor e período; buscar por título; ações em lote |
| A11 | Pré-visualização de SEO | Mostra como o título/descrição aparecerão no Google e no WhatsApp |

### 3.2 Agendamento de publicação 🔴

| # | Funcionalidade | Critério de aceite |
|---|---|---|
| A12 | Agendar | Definir data/hora futura com fuso explícito (America/Sao_Paulo); passado é rejeitado |
| A13 | Publicação automática | Função Inngest durável publica a matéria no horário exato e emite `ArticlePublished`; entrega repetida do mesmo evento **não** duplica a publicação |
| A14 | Cancelar/reagendar | Matéria agendada volta a `APROVADA` ou muda de horário |
| A15 | Calendário editorial | Visão de tudo que está agendado, por dia |

### 3.3 Editorias e tags 🔴

| # | Funcionalidade | Critério de aceite |
|---|---|---|
| A16 | CRUD de editorias | Nome, slug, descrição, cor, ordem e status; hierarquia de no máximo 2 níveis |
| A17 | Desativar em vez de excluir | Editoria com matérias publicadas só pode ser desativada; a interface explica o motivo |
| A18 | Ordenação | Ordem do menu e da home definida por arrastar-e-soltar |
| A19 | CRUD de tags | Criar, renomear, mesclar duplicadas e excluir tags sem uso |

### 3.4 Usuários e permissões 🔴

| # | Funcionalidade | Critério de aceite |
|---|---|---|
| A20 | Autenticação | Login por e-mail/senha (Better-Auth), com sessão segura e logout |
| A21 | Papéis | **Admin**, **Editor** e **Redator**, com a matriz de permissões abaixo aplicada no domínio |
| A22 | Redator restrito | Redator só edita os **próprios** rascunhos e não consegue publicar — verificado no caso de uso, não só na UI |
| A23 | Editor por editoria | Editor pode ser vinculado a editorias específicas |
| A24 | Convite de usuário | Admin convida por e-mail; usuário define a senha no primeiro acesso |
| A25 | Perfil de autor | Bio, foto, cargo e redes — alimenta a página pública de autor |
| A26 | Desativar usuário | Acesso revogado sem apagar a autoria das matérias já publicadas |
| A27 | Matriz visível | A tela de permissões mostra claramente o que cada papel pode fazer |

**Matriz de permissões (MVP):**

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

¹ Restrito às editorias às quais o editor está vinculado.

### 3.5 Mídia 🔴

| # | Funcionalidade | Critério de aceite |
|---|---|---|
| A28 | Upload | Arrastar-e-soltar com progresso, direto para o R2 via URL pré-assinada |
| A29 | Metadados obrigatórios | Legenda, **crédito** e **texto alternativo** são exigidos; a mensagem explica o motivo |
| A30 | Biblioteca | Grade com busca, filtro por tipo e data, e reuso de imagem já enviada |
| A31 | Ponto focal | Definir o ponto focal para corte responsivo sem decapitar pessoas |
| A32 | Otimização | Servida em AVIF/WebP com dimensões corretas por breakpoint |
| A33 | Vídeo e áudio 🟡 | Upload e incorporação (pós-MVP) |

### 3.6 Operação e governança

| # | Funcionalidade | Prioridade | Critério de aceite |
|---|---|---|---|
| A34 | Dashboard | 🔴 | Fila de revisão, meus rascunhos, agendadas de hoje e publicadas nas últimas 24 h |
| A35 | Auditoria | 🔴 | Registro imutável de publicação, edição, despublicação e mudança de permissão |
| A36 | Configurações do site | 🔴 | Nome, logo, expediente, redes sociais e blocos da home |
| A37 | Moderação de comentários | 🟡 | Fila de pendentes, ações em lote e lista de termos bloqueados |
| A38 | Analytics editorial | 🟡 | Matérias mais lidas, tempo de leitura e origem de tráfego, por período |
| A39 | Relatórios de produção | 🟢 | Volume por autor e por editoria |
| A40 | Envio de newsletter | 🟢 | Montagem e disparo a partir de matérias publicadas |

---

## 4. Requisitos não funcionais 🔴

| # | Requisito | Meta verificável |
|---|---|---|
| N01 | Performance | LCP < 2,5 s · INP < 200 ms · CLS < 0,1, medidos no CI (`testing-strategy.md` §12) |
| N02 | Acessibilidade | WCAG 2.2 AA sem violação de nível A/AA detectada pelo axe |
| N03 | Disponibilidade | Portal público servido do CDN continua no ar mesmo com o banco indisponível |
| N04 | Escala de leitura | Suportar pico de tráfego de matéria viral sem intervenção manual (ISR + Redis) |
| N05 | Cobertura de testes | Domínio ≥ 95% · global ≥ 80% |
| N06 | Segurança | Toda rota mutante coberta por teste de autorização; rate limiting em login e busca |
| N07 | Observabilidade | Erro em produção rastreável no Sentry, com contexto do usuário e da rota |
| N08 | Backup | Backup diário do banco com restauração testada ao menos uma vez por trimestre |
| N09 | LGPD | Dados pessoais mínimos; política de privacidade; consentimento de cookies quando houver analytics |
| N10 | Onboarding | Um dev novo roda o projeto localmente com `pnpm install && pnpm db:start && pnpm dev`, sem precisar de conta em nenhum serviço externo |

---

## 5. Rastreabilidade

Cada código (`P01`, `A12`, `N03`…) é permanente e será referenciado nas specs de fase, nos
commits e nos testes de aceitação. Isso permite responder, a qualquer momento do projeto,
"onde foi implementado e testado o requisito A12?" — que é o objetivo do spec-driven development.
