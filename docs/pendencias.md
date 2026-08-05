# Pendências — o que falta para o produto ficar completo

> **Atualizado:** 2026-08-05.
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

---

## 🟠 Funcionalidades combinadas e ainda não feitas

### Bloco B — Equipe e configurações
- [ ] **Convite por link** (resolve B1): agregado `Invitation` no contexto
      `identity` (token com hash guardado, e-mail, papel, validade), modelo
      Prisma + migration, e a tela que mostra o link para copiar. Sem depender de
      serviço de e-mail — restrição de infra auto-hospedável.
- [ ] **Fechar o auto-cadastro**: passar a provisionar membro **só com convite
      válido**, exceto o primeiro usuário do sistema.
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

---

## 🟡 Dívida técnica assumida

| Item | Razão | Risco se ficar |
|---|---|---|
| **Testes do serializador do TipTap** | Bloco A entregue sem testes novos, a pedido | Uma regressão no `docToBlocks` quebra o autosave silenciosamente. É o teste mais barato e mais valioso que falta: `docToBlocks(blocksToDoc(b)) ≡ b` |
| **Testes de router** para os dois defeitos de autorização corrigidos | idem | Nada impede a regressão voltar |
| **`next/image` no painel e no portal** | Falta `images.remotePatterns` para o host do R2 | Imagens servidas sem otimização; pesa no Core Web Vitals |
| **Paginação por cursor (P12)** | Read model carrega tudo em memória | Só incomoda com muitas matérias; hoje é aceitável |
| **ISR + Redis** (Fase 4, Etapa 5) | Não chegou a ser feita | Toda página bate no banco a cada acesso. Com tráfego real, vira o primeiro gargalo |
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

1. **Ligar `pnpm db:deploy` no build** e **configurar o R2** — sem isso não há
   produção funcionando (B3, B4). Ambos são configuração, não código.
2. **Rodar o seed** para o portal não abrir vazio.
3. **Convite + fechar auto-cadastro** (B1) — é a única pendência de *segurança*
   antes de divulgar o endereço do painel.
4. **Testes do serializador** — barato, e protege o que mais dói quebrar.
5. Banners, quando houver anunciante.
