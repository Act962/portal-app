import { StaffMember } from "@portal-app/identity";
import { FixedClock, SequentialIdGenerator } from "@portal-app/shared-kernel";
import {
	ArticleNotFound,
	InMemoryArticleRepository,
	approve,
	archive,
	createDraft,
	getArticle,
	listArticles,
	listScheduled,
	publish,
	publishDueScheduled,
	reject,
	schedule,
	submitForReview,
	updateArticle,
} from "@portal-app/editorial";
import { Forbidden } from "@portal-app/identity";
import { beforeEach, describe, expect, it } from "vitest";

const CLOCK = new FixedClock(new Date("2026-08-05T12:00:00Z"));

let repo: InMemoryArticleRepository;
let deps: { repo: InMemoryArticleRepository; clock: FixedClock; ids: SequentialIdGenerator };

beforeEach(() => {
	repo = new InMemoryArticleRepository();
	deps = { repo, clock: CLOCK, ids: new SequentialIdGenerator("art") };
});

function staff(role: "ADMIN" | "EDITOR" | "REDATOR", id: string, sectionIds: string[] = []): StaffMember {
	return StaffMember.restore({ id, email: `${id}@x.com`, role, status: "ATIVO", sectionIds });
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
		expect((await createDraft(inactive, content, deps)).unwrapErr()).toBeInstanceOf(Forbidden);
	});
});

describe("fluxo redator → editor", () => {
	it("redator submete, editor da editoria aprova e publica", async () => {
		const red = staff("REDATOR", "red");
		const ed = staff("EDITOR", "ed", ["cidades"]);
		const article = await draftBy(red);

		expect((await submitForReview(red, { id: article.id }, deps)).isOk()).toBe(true);
		expect((await approve(ed, { id: article.id }, deps)).isOk()).toBe(true);
		const published = (await publish(ed, { id: article.id }, deps)).unwrap();
		expect(published.status).toBe("PUBLICADA");
	});

	it("redator não pode aprovar (Forbidden)", async () => {
		const red = staff("REDATOR", "red");
		const article = await draftBy(red);
		await submitForReview(red, { id: article.id }, deps);
		expect((await approve(red, { id: article.id }, deps)).unwrapErr()).toBeInstanceOf(Forbidden);
	});

	it("editor de outra editoria não pode aprovar", async () => {
		const red = staff("REDATOR", "red");
		const outro = staff("EDITOR", "ed2", ["esportes"]);
		const article = await draftBy(red);
		await submitForReview(red, { id: article.id }, deps);
		expect((await approve(outro, { id: article.id }, deps)).unwrapErr()).toBeInstanceOf(Forbidden);
	});

	it("devolução exige motivo e volta para RASCUNHO", async () => {
		const red = staff("REDATOR", "red");
		const ed = staff("EDITOR", "ed", ["cidades"]);
		const article = await draftBy(red);
		await submitForReview(red, { id: article.id }, deps);

		const back = (await reject(ed, { id: article.id, reason: "faltam fontes" }, deps)).unwrap();
		expect(back.status).toBe("RASCUNHO");
		expect(back.rejectionReason).toBe("faltam fontes");
	});
});

describe("edição", () => {
	it("autor edita a própria; outro redator não", async () => {
		const red = staff("REDATOR", "red");
		const article = await draftBy(red);

		const edited = (await updateArticle(red, { id: article.id, headline: "Novo" }, deps)).unwrap();
		expect(edited.headline).toBe("Novo");

		const outro = staff("REDATOR", "red2");
		expect(
			(await updateArticle(outro, { id: article.id, headline: "X" }, deps)).unwrapErr(),
		).toBeInstanceOf(Forbidden);
	});

	it("admin publica e ao editar vira ATUALIZADA", async () => {
		const admin = staff("ADMIN", "adm");
		const article = await draftBy(admin);
		await submitForReview(admin, { id: article.id }, deps);
		await approve(admin, { id: article.id }, deps);
		await publish(admin, { id: article.id }, deps);

		const updated = (await updateArticle(admin, { id: article.id, standfirst: "nova linha" }, deps)).unwrap();
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

		const early = await publishDueScheduled({ repo, clock: new FixedClock(new Date("2026-08-05T12:00:00Z")) });
		expect(early).toHaveLength(0);
		expect((await getArticle(id, { repo }))?.status).toBe("AGENDADA");

		const due = await publishDueScheduled({ repo, clock: new FixedClock(LATER) });
		expect(due).toHaveLength(1);
		expect((await getArticle(id, { repo }))?.status).toBe("PUBLICADA");
	});
});

describe("erros de carga", () => {
	it("id inexistente devolve ArticleNotFound", async () => {
		const admin = staff("ADMIN", "adm");
		expect((await publish(admin, { id: "nao-existe" }, deps)).unwrapErr()).toBeInstanceOf(
			ArticleNotFound,
		);
		expect((await archive(admin, { id: "nao-existe" }, deps)).unwrapErr()).toBeInstanceOf(
			ArticleNotFound,
		);
	});
});
