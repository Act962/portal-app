# 0001 — Monólito modular em vez de microsserviços

- **Status:** Aceito
- **Data:** 2026-08-03
- **Decisores:** Equipe do portal-app

## Contexto

O produto é um portal de notícias de longo prazo, com domínio rico (editorial,
taxonomia, mídia, identidade, engajamento, distribuição) e um time pequeno. Há
necessidade real de **fronteiras** entre esses subdomínios — para que uma
mudança em comentários não quebre a publicação — mas não há necessidade de
escala independente por subdomínio no horizonte visível.

## Alternativas consideradas

- **Microsserviços.** Dão isolamento e escala independentes, mas cobram caro
  antes de qualquer benefício: rede entre serviços, transações distribuídas,
  observabilidade e deploy multiplicados. Para o tamanho do time e a fase do
  produto, é complexidade adiantada sem retorno.
- **Aplicação única sem fronteiras internas.** Rápida no começo, mas sem
  barreiras degrada em *big ball of mud* — exatamente o que um projeto de anos
  não pode aceitar.
- **Monólito modular (escolhido).** Fronteiras de *bounded context* como pacotes
  do monorepo, um único deploy.

## Decisão

Monólito modular: cada *bounded context* é um pacote em `packages/contexts/*`,
com camadas `domain` / `application` / `infrastructure` e uma interface
publicada. Tudo roda num processo e num banco (transações locais). As
fronteiras são **fiscalizadas por ferramenta** (`dependency-cruiser`, ADR da
Etapa 5), não por boa vontade de revisão. Como cada contexto já é um pacote
isolado com interface, extrair um para serviço no futuro é uma operação
localizada, não uma reescrita.

## Consequências

- **Mais fácil:** operação e deploy únicos; chamadas em processo; transações e
  integridade referencial num só banco; refatoração entre contextos com o
  compilador ajudando.
- **Mais difícil / a monitorar:** exige disciplina para não acoplar contextos —
  mitigada pelas regras do `dependency-cruiser` no CI. A escala é do app inteiro,
  não por contexto; aceitável agora, com caminho de extração já preparado pela
  arquitetura de pacotes.
