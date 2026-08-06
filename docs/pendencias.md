# Pendências — o que falta para o produto ficar completo

> **Atualizado:** 2026-08-06.
> Lista única e priorizada do que está em aberto, para a entrega em andamento.
> Estado por fase em [`proximos-passos.md`](./proximos-passos.md); escopo em
> [`specs/`](./specs/); operação em [`deploy.md`](./deploy.md).

**O que já funciona hoje:** o ciclo completo redação → leitor. Criar editoria e
assunto, subir imagem com ponto focal, escrever matéria em rich-text com
formatação, passar pelo workflow (rascunho → revisão → aprovada → publicada, com
agendamento e auditoria) e ver no portal público com SEO, sitemaps e RSS.

---

## 🔴 Bloqueiam a venda / o uso real

| # | Pendência | Por que importa | Onde |
|---|---|---|---|
| B1 | **Qualquer um cria conta no painel** | Não existe convite: quem abrir `/login` num domínio público vira REDATOR sozinho. Hoje o único freio é ninguém saber o endereço. | `packages/api/src/staff.ts` (`resolveStaff` provisiona qualquer autenticado) |
| B2 | ~~Capa das matérias do seed~~ | ✅ **Resolvido**: o seed distribui, em rodízio, 6 imagens que já estão no bucket do R2. Depende de `S3_PUBLIC_URL` apontar para o bucket. | `packages/db/prisma/seed.mjs` (`IMAGENS`) |
| B3 | **Migrations no deploy** | ✅ **Resolvido**: `pnpm db:deploy` criado. Falta **ligar no build command** da hospedagem. | [`deploy.md`](./deploy.md) §1 |
| B4 | **R2 em produção** | ✅ **Código pronto** (adapter S3 serve R2 sem mudança). Falta cadastrar as variáveis e o **CORS de `PUT`** no bucket — sem ele, o upload falha. | [`deploy.md`](./deploy.md) §2 |
| B5 | **Sem recuperação de senha** | Quem esquece a senha fica trancado para fora **em definitivo**: não há "esqueci minha senha", e o admin também não tem como redefinir a de ninguém. Basta uma pessoa na redação esquecer para virar chamado de suporte sem saída. | Nada implementado — nem rota, nem procedure |
| B6 | ~~"Anúncios" e "Configurações" davam 404~~ | ✅ **Resolvido**: os dois itens saíram da navegação até as telas existirem. Apontavam para rotas inexistentes, e só o ADMIN — o dono do portal — os enxergava. | `apps/web/src/lib/admin-nav.ts` |
| B7 | ~~Agendamento não publicava sozinho~~ | ✅ **Resolvido**: `GET /api/cron/publish-scheduled`, autenticado por `CRON_SECRET`, agendado no `vercel.json` a cada 5 min. Antes, o único gatilho era um clique no painel — matéria marcada para as 6h esperava alguém lembrar. | [`deploy.md`](./deploy.md) §3 |

---

## 🟠 Funcionalidades combinadas e ainda não feitas

### Bloco B — Equipe e configurações
- [ ] **Convite por link** (resolve B1): agregado `Invitation` no contexto
      `identity` (token com hash guardado, e-mail, papel, validade), modelo
      Prisma + migration, e a tela que mostra o link para copiar. Sem depender de
      serviço de e-mail — restrição de infra auto-hospedável.
- [ ] **Fechar o auto-cadastro**: passar a provisionar membro **só com convite
      válido**, exceto o primeiro usuário do sistema.
- [ ] **Redefinição de senha pelo admin** (resolve B5): sai de graça junto do
      convite — é o mesmo token com hash e validade, mudando só o efeito (trocar
      a senha em vez de criar o membro). Sem serviço de e-mail: o admin gera o
      link e entrega pelo canal que quiser.
- [ ] **Reativar membro** — só existe desativar.
- [ ] **Configurações do site**: a permissão `settings:manage` existe desde a
      Fase 1 **sem nada atrás**. Falta o agregado `SiteSettings` (nome, logo,
      contato, redes, integrações) e a tela.

### Bloco C — Banners e anúncios
- [ ] Contexto `advertising` com `Campaign` (imagem, link, posição, período,
      ativo) + migration. O `AdSlot` do portal hoje é **placeholder estático**;
      passa a receber a campanha de um RSC novo (`AdPlacement`), porque
      `packages/ui` não pode consultar banco.
- [ ] Métricas de impressão/clique ficam para depois (exigem rota de tracking e
      cuidado com cache).

### Avulso
- [ ] **Excluir imagem da biblioteca**: o router de mídia só tem
      `requestUpload`, `register`, `library` e `get`. Um envio errado fica lá
      para sempre e a biblioteca só cresce. Precisa apagar no storage **e** na
      linha do banco, e antes disso checar se alguma matéria usa a imagem —
      capa ou bloco do corpo — senão o portal passa a servir imagem quebrada.

---

## 🟡 Dívida técnica assumida

| Item | Razão | Risco se ficar |
|---|---|---|
| **Testes do serializador do TipTap** | Bloco A entregue sem testes novos, a pedido | Uma regressão no `docToBlocks` quebra o autosave silenciosamente. É o teste mais barato e mais valioso que falta: `docToBlocks(blocksToDoc(b)) ≡ b` |
| **Testes de router** para os dois defeitos de autorização corrigidos | idem | Nada impede a regressão voltar |
| **`next/image` no painel e no portal** | Falta `images.remotePatterns` para o host do R2 | Imagens servidas sem otimização; pesa no Core Web Vitals |
| **Paginação por cursor (P12)** | Read model carrega tudo em memória | Só incomoda com muitas matérias; hoje é aceitável |
| **Invalidação por evento** (Fase 4, Etapa 5) | Feito o mínimo: `revalidate = 60` no portal. Faltam o consumidor do outbox chamando `revalidateTag` e o Redis | Matéria publicada demora até 1 min para entrar no ar, e o portal consulta o banco de tempos em tempos mesmo sem novidade. Antes disto, as páginas eram **congeladas no build** e matéria nova só aparecia com um redeploy |
| **Busca full-text** (Fase 4, Etapa 6) | Não chegou a ser feita | A busca é `includes` em memória — não erra, mas não escala nem tolera erro de digitação |
| **Gate de lint (`biome ci`)** | Scaffold nunca formatado | Estilo diverge entre arquivos |
| **Branch protection no `main`** | Precisa do owner (`Act962`) | Push direto em `main` é possível |
| **Editor visual da home (P06)** | Home compõe por recência | Não dá para destacar manualmente uma matéria |

---

## 🟢 Refinamentos de UX (não bloqueiam)

- [ ] Aviso de edição concorrente (dois jornalistas na mesma matéria) — precisa
      de versionamento otimista no agregado.
- [ ] Histórico e diff visual de versões.
- [ ] Busca `⌘K` no painel (o componente já existe, falta ligar).
- [ ] Arrastar-e-soltar para reordenar editorias (hoje é por setas, funcional).
- [ ] Upload de **vários** arquivos de uma vez (hoje é um por vez).
- [ ] Perfil de autor editável pelo próprio redator (o backend já suporta).

---

## Corrigido de passagem (achado ao semear)

Duas coisas só apareceram quando o portal passou a ter conteúdo real — com as
fixtures antigas nenhuma das duas dava sinal:

- **Toda matéria aparecia como "há 1 min".** O cálculo de tempo relativo media
  contra um instante fixo herdado das fixtures (`FIXTURE_NOW`, 3 de agosto), não
  contra o relógio. Qualquer matéria publicada depois daquela data caía no piso.
- **Nenhuma listagem mostrava a capa.** Home, cartões, listas e "leia também"
  renderizavam o espaço hachurado mesmo quando a matéria tinha foto — só a
  página da matéria usava a capa. Agora há um `ArticleThumb` compartilhado, que
  mostra a foto com o ponto focal e cai no placeholder quando não há.

---

## Ordem sugerida, dada a pressa

Os passos de colocar no ar (migrations, R2, seed) estão **feitos** — o portal
está em produção com conteúdo. O que resta:

1. **Cadastrar `CRON_SECRET` na Vercel.** Sem ela a rota do agendamento responde
   503 e as matérias marcadas continuam não saindo sozinhas. É uma variável, não
   é código — mas sem ela o B7 não vale nada.
2. **Convite + fechar o auto-cadastro** (B1) — a única pendência de *segurança*
   antes de divulgar o endereço do painel.
3. **Redefinição de senha** (B5) — vai junto do convite, mesmo mecanismo de
   token, e evita o primeiro chamado de suporte sem saída.
4. **Testes do serializador** — barato, e protege o que mais dói quebrar.
5. Banners, quando houver anunciante.
