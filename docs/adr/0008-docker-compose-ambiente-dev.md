# 0008 — Docker Compose como ambiente de desenvolvimento padrão

- **Status:** Aceito
- **Data:** 2026-08-03
- **Decisores:** Equipe do portal-app

## Contexto

Um dos requisitos do projeto (`N10` de `features.md`) é o onboarding em **um
comando, sem conta em serviço nenhum**: um dev clona o repositório e tem banco,
cache e testes funcionando. Também se quer **paridade** entre a máquina do dev,
o CI e a produção, para eliminar a classe de bug "funciona na minha máquina".

## Alternativas consideradas

- **Serviços gerenciados na nuvem já no dev.** Exigiriam contas, credenciais e
  custo, e não funcionam offline — o oposto do requisito de onboarding.
- **Instalar Postgres/Redis direto na máquina.** Cada dev numa versão diferente;
  reproduz exatamente o bug de ambiente que se quer evitar.
- **Docker Compose (escolhido).** Serviços com estado em containers de versão
  fixa, subindo com um comando.

## Decisão

O `packages/db/docker-compose.yml` sobe **Postgres e Redis** com `pnpm db:start`.
As *major versions* são fixadas (`postgres:17`, `redis:7-alpine`) para dar
paridade — as mesmas imagens rodam no Testcontainers do CI. Credenciais de dev
são fixas e sem valor, espelhadas no `.env.example`.

O **Inngest fica fora do Compose**: no Next.js ele é biblioteca + Dev Server pela
CLI (`npx inngest-cli dev`), não um container — só o que é *stateful* de fato
vira serviço no Compose. Isso revisa a formulação original da Decisão 4a de
`stack.md`.

## Consequências

- **Mais fácil:** onboarding em um comando, offline e sem conta; paridade
  dev/CI/produção; a decisão de hospedagem em produção (Decisão 4b) fica adiada
  sem custo, porque tudo é serviço padrão em container.
- **Mais difícil / a monitorar:** exige Docker instalado na máquina do dev; há um
  arquivo de Compose a manter conforme novos serviços com estado surgirem.
