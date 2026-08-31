import {
	ArticleNotFound,
	ArticleOnAir,
	approve,
	archive,
	archiveMany,
	createDraft,
	deleteArticle,
	deleteMany,
	getArticle,
	InMemoryArticleRepository,
	listArticles,
	listScheduled,
	publish,
	publishDueScheduled,
	reject,
	schedule,
	submitForReview,
	updateArticle,
} from "@portal-app/editorial";
import { Forbidden, StaffMember } from "@portal-app/identity";
import { FixedClock, SequentialIdGenerator } from "@portal-app/shared-kernel";
import { beforeEach, describe, expect, it } from "vitest";

const CLOCK = new FixedClock(new Date("2026-08-05T12:00:00Z"));

let repo: InMemoryArticleRepository;
let deps: {
	repo: InMemoryArticleRepository;
	clock: FixedClock;
	ids: SequentialIdGenerator;
};

beforeEach(() => {
	repo = new InMemoryArticleRepository();
	deps = { repo, clock: CLOCK, ids: new SequentialIdGenerator("art") };
});

function staff(
	role: "ADMIN" | "EDITOR" | "REDATOR",
	id: string,
	sectionIds: string[] = [],
): StaffMember {
	return StaffMember.restore({
		id,
		email: `${id}@x.com`,
		role,
		status: "ATIVO",
		sectionIds,
	});
}

const content = {
	headline: "Enchente atinge o centro",
	authorName: "Ana",
	sectionId: "cidades",
	body: [{ type: "paragraph" as const, text: "Choveu muito." }],
	cover: { mediaId: "m-1", altText: "Rua alagada" },
};

async function draftBy(author: StaffMember) {
	return (await createDraft(author, content, deps)).unwrap();
}

describe("createDraft", () => {
	it("redator cria com a própria assinatura", async () => {
		const article = await draftBy(staff("REDATOR", "red"));
		expect(article.byline.authorId).toBe("red");
		expect(article.status).toBe("RASCUNHO");
		expect((await listArticles({}, deps)).items).toHaveLength(1);
	});

	it("staff inativo é barrado (Forbidden)", async () => {
		const inactive = StaffMember.restore({
			id: "x",
			email: "x@x.com",
			role: "REDATOR",
			status: "INATIVO",
			sectionIds: [],
		});
		expect(
			(await createDraft(inactive, content, deps)).unwrapErr(),
		).toBeInstanceOf(Forbidden);
	});
});

describe("fluxo redator → editor", () => {
	it("redator submete, editor da editoria aprova e publica", async () => {
		const red = staff("REDATOR", "red");
		const ed = staff("EDITOR", "ed", ["cidades"]);
		const article = await draftBy(red);

		expect((await submitForReview(red, { id: article.id }, deps)).isOk()).toBe(
			true,
		);
		expect((await approve(ed, { id: article.id }, deps)).isOk()).toBe(true);
		const published = (await publish(ed, { id: article.id }, deps)).unwrap();
		expect(published.status).toBe("PUBLICADA");
	});

	it("redator não pode aprovar (Forbidden)", async () => {
		const red = staff("REDATOR", "red");
		const article = await draftBy(red);
		await submitForReview(red, { id: article.id }, deps);
		expect(
			(await approve(red, { id: article.id }, deps)).unwrapErr(),
		).toBeInstanceOf(Forbidden);
	});

	it("editor de outra editoria não pode aprovar", async () => {
		const red = staff("REDATOR", "red");
		const outro = staff("EDITOR", "ed2", ["esportes"]);
		const article = await draftBy(red);
		await submitForReview(red, { id: article.id }, deps);
		expect(
			(await approve(outro, { id: article.id }, deps)).unwrapErr(),
		).toBeInstanceOf(Forbidden);
	});

	it("devolução exige motivo e volta para RASCUNHO", async () => {
		const red = staff("REDATOR", "red");
		const ed = staff("EDITOR", "ed", ["cidades"]);
		const article = await draftBy(red);
		await submitForReview(red, { id: article.id }, deps);

		const back = (
			await reject(ed, { id: article.id, reason: "faltam fontes" }, deps)
		).unwrap();
		expect(back.status).toBe("RASCUNHO");
		expect(back.rejectionReason).toBe("faltam fontes");
	});
});

describe("edição", () => {
	it("autor edita a própria; outro redator não", async () => {
		const red = staff("REDATOR", "red");
		const article = await draftBy(red);

		const edited = (
			await updateArticle(red, { id: article.id, headline: "Novo" }, deps)
		).unwrap();
		expect(edited.headline).toBe("Novo");

		const outro = staff("REDATOR", "red2");
		expect(
			(
				await updateArticle(outro, { id: article.id, headline: "X" }, deps)
			).unwrapErr(),
		).toBeInstanceOf(Forbidden);
	});

	it("admin publica e ao editar vira ATUALIZADA", async () => {
		const admin = staff("ADMIN", "adm");
		const article = await draftBy(admin);
		await submitForReview(admin, { id: article.id }, deps);
		await approve(admin, { id: article.id }, deps);
		await publish(admin, { id: article.id }, deps);

		const updated = (
			await updateArticle(
				admin,
				{ id: article.id, standfirst: "nova linha" },
				deps,
			)
		).unwrap();
		expect(updated.status).toBe("ATUALIZADA");
	});
});

describe("agendamento (poller síncrono / node-cron-friendly)", () => {
	const LATER = new Date("2026-08-05T18:00:00Z");

	async function scheduleOne() {
		const admin = staff("ADMIN", "adm");
		const article = await draftBy(admin);
		await submitForReview(admin, { id: article.id }, deps);
		await approve(admin, { id: article.id }, deps);
		(await schedule(admin, { id: article.id, at: LATER }, deps)).unwrap();
		return article.id;
	}

	it("lista as agendadas (calendário A15)", async () => {
		const id = await scheduleOne();
		const scheduled = await listScheduled({ repo });
		expect(scheduled.map((a) => a.id)).toEqual([id]);
	});

	it("E09: publica só quando o horário chega — FixedClock, sem espera", async () => {
		const id = await scheduleOne();

		const early = await publishDueScheduled({
			repo,
			clock: new FixedClock(new Date("2026-08-05T12:00:00Z")),
		});
		expect(early).toHaveLength(0);
		expect((await getArticle(id, { repo }))?.status).toBe("AGENDADA");

		const due = await publishDueScheduled({
			repo,
			clock: new FixedClock(LATER),
		});
		expect(due).toHaveLength(1);
		expect((await getArticle(id, { repo }))?.status).toBe("PUBLICADA");
	});
});

describe("erros de carga", () => {
	it("id inexistente devolve ArticleNotFound", async () => {
		const admin = staff("ADMIN", "adm");
		expect(
			(await publish(admin, { id: "nao-existe" }, deps)).unwrapErr(),
		).toBeInstanceOf(ArticleNotFound);
		expect(
			(await archive(admin, { id: "nao-existe" }, deps)).unwrapErr(),
		).toBeInstanceOf(ArticleNotFound);
	});
});

describe("arquivo (o que a lista esconde)", () => {
	/** Cria e leva ao ar — só matéria publicada pode ser arquivada. */
	async function publishedBy(actor: StaffMember, headline: string) {
		const article = (
			await createDraft(actor, { ...content, headline }, deps)
		).unwrap();
		await submitForReview(actor, { id: article.id }, deps);
		await approve(actor, { id: article.id }, deps);
		(await publish(actor, { id: article.id }, deps)).unwrap();
		return article.id;
	}

	it("arquivada some da lista por padrão", async () => {
		const admin = staff("ADMIN", "adm");
		const guardada = await publishedBy(admin, "Obras na BR-343");
		const noAr = await publishedBy(admin, "Chuva alaga o centro");
		(await archive(admin, { id: guardada }, deps)).unwrap();

		const page = await listArticles({}, deps);
		expect(page.items.map((a) => a.id)).toEqual([noAr]);
		// O total conta o MESMO que a lista mostra: divergir aqui deixa a última
		// página vazia sem explicação.
		expect(page.total).toBe(1);
	});

	it("`includeArchived` traz o arquivo de volta", async () => {
		const admin = staff("ADMIN", "adm");
		const guardada = await publishedBy(admin, "Obras na BR-343");
		(await archive(admin, { id: guardada }, deps)).unwrap();

		const page = await listArticles({ includeArchived: true }, deps);
		expect(page.items.map((a) => a.id)).toContain(guardada);
		expect(page.total).toBe(1);
	});

	it("pedir status ARQUIVADA já é pedir o arquivo, sem a bandeira", async () => {
		const admin = staff("ADMIN", "adm");
		const guardada = await publishedBy(admin, "Obras na BR-343");
		await publishedBy(admin, "Chuva alaga o centro");
		(await archive(admin, { id: guardada }, deps)).unwrap();

		const page = await listArticles({ status: "ARQUIVADA" }, deps);
		expect(page.items.map((a) => a.id)).toEqual([guardada]);
	});

	it("filtrar por outro status continua fora do arquivo", async () => {
		const admin = staff("ADMIN", "adm");
		const guardada = await publishedBy(admin, "Obras na BR-343");
		(await archive(admin, { id: guardada }, deps)).unwrap();

		expect(
			(await listArticles({ status: "PUBLICADA" }, deps)).items,
		).toHaveLength(0);
	});

	it("arquiva o lote e diz o que passou", async () => {
		const admin = staff("ADMIN", "adm");
		const um = await publishedBy(admin, "Obras na BR-343");
		const dois = await publishedBy(admin, "Chuva alaga o centro");

		const outcome = await archiveMany(admin, { ids: [um, dois] }, deps);
		expect(outcome.done).toEqual([um, dois]);
		expect(outcome.failed).toEqual([]);
		expect((await listArticles({}, deps)).items).toHaveLength(0);
	});

	it("o que falha no lote não derruba o que deu certo", async () => {
		const admin = staff("ADMIN", "adm");
		const noAr = await publishedBy(admin, "Obras na BR-343");
		// Já arquivada por outra pessoa antes do clique: é o caso real de falha
		// depois que arquivar passou a valer de qualquer estado (um rascunho no
		// meio do lote agora PASSA, e não serve mais de exemplo de recusa).
		const jaArquivada = (await draftBy(admin)).id;
		(await archive(admin, { id: jaArquivada }, deps)).unwrap();

		const outcome = await archiveMany(
			admin,
			{ ids: [jaArquivada, noAr] },
			deps,
		);
		expect(outcome.done).toEqual([noAr]);
		expect(outcome.failed.map((f) => f.id)).toEqual([jaArquivada]);
		// A que passou FICOU arquivada — o lote não é transação, e desfazer as
		// boas por causa da ruim é o comportamento que este teste proíbe.
		expect((await getArticle(noAr, { repo }))?.status).toBe("ARQUIVADA");
	});

	it("redator não arquiva matéria alheia, nem em lote", async () => {
		const admin = staff("ADMIN", "adm");
		const alheia = await publishedBy(admin, "Obras na BR-343");

		const outcome = await archiveMany(
			staff("REDATOR", "red"),
			{ ids: [alheia] },
			deps,
		);
		expect(outcome.done).toEqual([]);
		expect(outcome.failed).toHaveLength(1);
		expect((await getArticle(alheia, { repo }))?.status).toBe("PUBLICADA");
	});
});

describe("descartar o próprio rascunho", () => {
	/**
	 * O caso que motivou tudo isto: a matéria criada por engano, ainda sem corpo
	 * e sem editoria. Antes, arquivar exigia `article:unpublish` — permissão que
	 * o redator não tem e que o editor só tem DENTRO das editorias dele. Um
	 * rascunho sem editoria não satisfaz nem uma coisa nem outra, então a única
	 * ação oferecida era empurrá-lo para a revisão.
	 */
	it("o redator arquiva o rascunho que ele mesmo criou", async () => {
		const redator = staff("REDATOR", "red");
		const rascunho = await draftBy(redator);

		expect((await archive(redator, { id: rascunho.id }, deps)).isOk()).toBe(
			true,
		);
		expect((await getArticle(rascunho.id, { repo }))?.status).toBe("ARQUIVADA");
	});

	it("o redator NÃO arquiva o rascunho alheio", async () => {
		const rascunho = await draftBy(staff("REDATOR", "outra"));

		expect(
			(
				await archive(staff("REDATOR", "red"), { id: rascunho.id }, deps)
			).unwrapErr(),
		).toBeInstanceOf(Forbidden);
	});

	it("tirar do AR continua exigindo a permissão de despublicar", async () => {
		// A porta que se abriu foi para o rascunho, não para o portal: o redator
		// não passa a poder derrubar matéria que o público está lendo.
		const admin = staff("ADMIN", "adm");
		const redator = staff("REDATOR", "red");
		const article = await draftBy(redator);
		await submitForReview(redator, { id: article.id }, deps);
		await approve(admin, { id: article.id }, deps);
		(await publish(admin, { id: article.id }, deps)).unwrap();

		expect(
			(await archive(redator, { id: article.id }, deps)).unwrapErr(),
		).toBeInstanceOf(Forbidden);
		expect((await getArticle(article.id, { repo }))?.status).toBe("PUBLICADA");
	});
});

describe("apagar de vez", () => {
	async function published(actor: StaffMember) {
		const article = await draftBy(actor);
		await submitForReview(actor, { id: article.id }, deps);
		await approve(actor, { id: article.id }, deps);
		(await publish(actor, { id: article.id }, deps)).unwrap();
		return article.id;
	}

	it("apaga o rascunho e ele some do repositório", async () => {
		const admin = staff("ADMIN", "adm");
		const rascunho = await draftBy(admin);

		const result = await deleteArticle(admin, { id: rascunho.id }, deps);
		expect(result.unwrap().headline).toBe(content.headline);
		expect(await getArticle(rascunho.id, { repo })).toBeNull();
	});

	it("recusa matéria no ar, e ela CONTINUA lá", async () => {
		const admin = staff("ADMIN", "adm");
		const noAr = await published(admin);

		expect(
			(await deleteArticle(admin, { id: noAr }, deps)).unwrapErr(),
		).toBeInstanceOf(ArticleOnAir);
		expect((await getArticle(noAr, { repo }))?.status).toBe("PUBLICADA");
	});

	it("arquivar primeiro destrava o apagamento", async () => {
		// O caminho de duas etapas: a parada no meio é a chance de mudar de ideia.
		const admin = staff("ADMIN", "adm");
		const noAr = await published(admin);
		(await archive(admin, { id: noAr }, deps)).unwrap();

		expect((await deleteArticle(admin, { id: noAr }, deps)).isOk()).toBe(true);
		expect(await getArticle(noAr, { repo })).toBeNull();
	});

	it("matéria inexistente é NOT_FOUND, não sucesso silencioso", async () => {
		expect(
			(
				await deleteArticle(staff("ADMIN", "adm"), { id: "nao-existe" }, deps)
			).unwrapErr(),
		).toBeInstanceOf(ArticleNotFound);
	});

	it("o redator apaga o próprio rascunho", async () => {
		const redator = staff("REDATOR", "red");
		const rascunho = await draftBy(redator);

		expect(
			(await deleteArticle(redator, { id: rascunho.id }, deps)).isOk(),
		).toBe(true);
	});

	it("o redator NÃO apaga rascunho alheio", async () => {
		const alheio = await draftBy(staff("REDATOR", "outra"));

		expect(
			(
				await deleteArticle(staff("REDATOR", "red"), { id: alheio.id }, deps)
			).unwrapErr(),
		).toBeInstanceOf(Forbidden);
	});

	it("o redator NÃO apaga o que já esteve no ar, nem sendo dele", async () => {
		// Apagar o registro de algo que foi público é mexer no acervo: exige
		// também a permissão de tirar do ar. É a segunda checagem do caso de uso,
		// e sem ela o autor eliminaria sozinho um endereço que o mundo conhece.
		const admin = staff("ADMIN", "adm");
		const redator = staff("REDATOR", "red");
		const article = await draftBy(redator);
		await submitForReview(redator, { id: article.id }, deps);
		await approve(admin, { id: article.id }, deps);
		(await publish(admin, { id: article.id }, deps)).unwrap();
		(await archive(admin, { id: article.id }, deps)).unwrap();

		expect(
			(await deleteArticle(redator, { id: article.id }, deps)).unwrapErr(),
		).toBeInstanceOf(Forbidden);
		expect(await getArticle(article.id, { repo })).not.toBeNull();
	});

	it("o editor da editoria apaga o arquivado dela", async () => {
		const admin = staff("ADMIN", "adm");
		const editor = staff("EDITOR", "ed", ["cidades"]);
		const article = await published(admin);
		(await archive(admin, { id: article }, deps)).unwrap();

		expect((await deleteArticle(editor, { id: article }, deps)).isOk()).toBe(
			true,
		);
	});

	it("o editor de OUTRA editoria não apaga", async () => {
		const admin = staff("ADMIN", "adm");
		const article = await published(admin);
		(await archive(admin, { id: article }, deps)).unwrap();

		expect(
			(
				await deleteArticle(
					staff("EDITOR", "ed", ["esportes"]),
					{ id: article },
					deps,
				)
			).unwrapErr(),
		).toBeInstanceOf(Forbidden);
	});

	it("o lote apaga o que pode e relata o que não pôde", async () => {
		const admin = staff("ADMIN", "adm");
		const rascunho = (await draftBy(admin)).id;
		const noAr = await published(admin);

		const outcome = await deleteMany(admin, { ids: [rascunho, noAr] }, deps);
		expect(outcome.done).toEqual([rascunho]);
		expect(outcome.failed.map((f) => f.id)).toEqual([noAr]);
		// A recusada continua inteira: o lote é conveniência de tela, não uma
		// transação que se desfaz por causa de um item.
		expect(await getArticle(rascunho, { repo })).toBeNull();
		expect((await getArticle(noAr, { repo }))?.status).toBe("PUBLICADA");
	});

	it("o lote com id inexistente não derruba os outros", async () => {
		const admin = staff("ADMIN", "adm");
		const rascunho = (await draftBy(admin)).id;

		const outcome = await deleteMany(
			admin,
			{ ids: ["nao-existe", rascunho] },
			deps,
		);
		expect(outcome.done).toEqual([rascunho]);
		expect(outcome.failed).toHaveLength(1);
	});
});
