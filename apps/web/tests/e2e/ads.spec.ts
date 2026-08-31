import { test } from "@playwright/test";

/**
 * ESQUELETO — publicidade no portal e no painel.
 *
 * A LÓGICA tem teste de verdade e em três camadas: a regra de veiculação
 * (`select-ad.test.ts`), o agregado e a configuração do AdSense
 * (`campaign.test.ts`), os casos de uso e a autorização
 * (`manage-campaigns.test.ts`), o contrato do repositório contra Postgres real
 * (`campaign-repository.contract.test.ts`) e, do lado do app, o sorteio
 * (`ad-rotation.test.ts`), o corpo do beacon (`parse-ad-event-body.test.ts`) e
 * a sincronia das duas listas de posições (`ad-slots.test.ts`).
 *
 * O que falta é o que só o NAVEGADOR sabe. Dois deles já morderam durante a
 * verificação manual desta entrega:
 *
 * 1. O `z.record` com chaves de enum exigia TODAS as posições presentes, e o
 *    formulário manda só as preenchidas — salvar o AdSense era recusado com um
 *    erro de validação por posição em branco. Nenhum teste de tipo pegaria:
 *    o schema estava bem tipado, só não correspondia ao que a tela envia.
 * 2. O cliente Prisma não regenerado deixava `prisma.adCampaign` indefinido, e
 *    o portal degradava para "sem anúncio" — em silêncio, que é justamente o
 *    que a rede de segurança faz de propósito.
 */
test.describe("portal — publicidade", () => {
	test.fixme("posição sem campanha e sem AdSense mostra a caixa vazia com altura reservada", async () => {});

	test.fixme("campanha da casa no ar aparece com rel='sponsored' e link do anunciante", async () => {});

	test.fixme("campanha da casa GANHA do AdSense na mesma posição", async () => {});

	test.fixme("sem campanha, a posição com unidade configurada monta a tag do AdSense", async () => {});

	test.fixme("AdSense desligado não carrega script do Google em página nenhuma", async () => {});

	test.fixme("campanha segmentada aparece na editoria vendida e não na home", async () => {});

	test.fixme("a impressão só é contada quando o anúncio entra na tela", async () => {});

	test.fixme("o clique registra o evento e leva ao anunciante", async () => {});

	test.fixme("/ads.txt responde 404 sem AdSense e a linha da IAB com ele", async () => {});

	test.fixme("a política de privacidade descreve os cookies do Google só quando ligado", async () => {});
});

test.describe("painel — anúncios", () => {
	test.fixme("EDITOR não vê 'Anúncios' no menu e é barrado na rota", async () => {});

	test.fixme("criar campanha sem imagem deixa 'Ativar' desabilitado, com o motivo", async () => {});

	test.fixme("link de destino sem https é recusado com mensagem útil", async () => {});

	test.fixme("salvar o AdSense com posições em branco funciona (regressão do z.record)", async () => {});

	test.fixme("pausar tira do ar sem mexer no período contratado", async () => {});

	test.fixme("excluir campanha avisa que o histórico de métricas vai junto", async () => {});
});
