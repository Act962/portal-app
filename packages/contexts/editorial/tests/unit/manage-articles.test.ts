import { StaffMember } from "@portal-app/identity";
import { FixedClock, SequentialIdGenerator } from "@portal-app/shared-kernel";
import {
	ArticleNotFound,
	InMemoryArticleRepository,
	approve,
	archive,
	createDraft,
	listArticles,
	publish,
	reject,
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
		expect(await listArticles({}, deps)).toHaveLength(1);
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
