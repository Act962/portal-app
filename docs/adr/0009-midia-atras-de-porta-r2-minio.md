# 0009 — Mídia atrás de porta: R2/S3 em produção, MinIO no dev

- **Status:** Aceito
- **Data:** 2026-08-05
- **Decisores:** Equipe do portal-app

## Contexto

A Fase 2 precisa de uma biblioteca de mídia: subir imagens grandes e servi-las
no portal. Duas forças moldam a decisão. Primeira, o requisito de onboarding
**sem conta em serviço nenhum** e offline (`N10`, mesmo espírito do
[0008](./0008-docker-compose-ambiente-dev.md)) — mas a decisão de hospedagem em
produção (Decisão 4b de `stack.md`) está deliberadamente **adiada**. Segunda, o
upload de arquivos grandes não pode passar pelo servidor da aplicação (A28): o
processo Next não deve receber o corpo do arquivo, sob pena de estourar memória
e limites de serverless.

A Decisão 3 de `stack.md` já escolheu **Cloudflare R2** como armazenamento de
objetos (S3-compatível, sem taxa de egresso). Falta decidir **como** o código
fala com ele e **o que roda no dev e no CI**, já que a conta do R2 ainda não
existe.

## Alternativas consideradas

- **Depender do R2 real no dev e no CI.** Exigiria conta, credenciais e rede —
  o oposto do requisito de onboarding, e impossível enquanto a Decisão 4b não
  fecha. Descartado.
- **Upload através do servidor da aplicação** (o arquivo passa pelo Next, que
  repassa ao storage). Simples, mas viola A28: carrega o processo com o binário,
  limita o tamanho e desperdiça banda. Descartado.
- **Sistema de arquivos local no dev, S3 na produção.** Dois caminhos de código
  diferentes para testar — o fluxo S3 (URL pré-assinada, CORS) só seria exercido
  em produção, onde falhar é caro. Descartado.
- **Porta de armazenamento + MinIO no dev/CI (escolhido).** MinIO fala a mesma
  API S3 do R2; o mesmo adapter roda contra os dois. O fluxo pré-assinado é
  exercido offline, no dev e no CI.

## Decisão

A mídia fica **atrás de uma porta de domínio `MediaStorage`**
(`getUploadUrl`/`publicUrl`/`delete`). Um único adapter `S3MediaStorage`
(`@aws-sdk/client-s3` + `s3-request-presigner`) serve **R2 em produção** e
**MinIO no dev/CI** — só recursos S3 comuns (PUT pré-assinado, GET), sem depender
de extensões de um provedor. A configuração entra por injeção, lida do
`@portal-app/env` (`S3_*`), com **defaults apontando para o MinIO** local.

O upload é **direto do cliente para o storage** (A28): a API devolve uma URL PUT
pré-assinada e a `storageKey`; o navegador sobe o arquivo; depois a API registra
o `MediaAsset`. O arquivo nunca passa pelo servidor.

No dev, o MinIO sobe no `docker-compose` (com um init que cria o bucket
`portal-media` com leitura pública). No CI, o **contrato de `MediaStorage` roda
contra um MinIO real via Testcontainers** (M10), a par do contrato fake↔Prisma
do repositório (M11).

## Consequências

- **Mais fácil:** onboarding e CI offline, sem conta; o fluxo S3 (pré-assinado,
  CORS, path-style) é validado no dev e no CI, não só em produção; trocar R2 por
  outro storage S3 é mudar env, não código; a Decisão 4b segue adiada sem custo.
- **Mais difícil / a monitorar:** manter a paridade S3 — usar só o denominador
  comum entre MinIO e R2; configurar **CORS** e política de acesso no bucket de
  produção (no MinIO de dev o init já resolve); o adapter R2 real só é exercido
  de fato quando a Decisão 4b fechar e houver credenciais de produção.
