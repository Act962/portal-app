import {
	AuthorProfile,
	activateStaff,
	bindStaffSections,
	changeStaffRole,
	deactivateStaff,
	Forbidden,
	InMemoryStaffRepository,
	listStaff,
	StaffMember,
	StaffNotFound,
	updateAuthorProfile,
} from "@portal-app/identity";
import { beforeEach, describe, expect, it } from "vitest";

let repo: InMemoryStaffRepository;

const admin = StaffMember.restore({
	id: "admin-1",
	email: "admin@x.com",
	role: "ADMIN",
	status: "ATIVO",
	sectionIds: [],
});
const redator = StaffMember.restore({
	id: "redator-1",
	email: "red@x.com",
	role: "REDATOR",
	status: "ATIVO",
	sectionIds: [],
});

beforeEach(async () => {
	repo = new InMemoryStaffRepository();
	await repo.save(admin);
	await repo.save(redator);
});

describe("gestão de usuários — autorização", () => {
	it("um redator não pode listar usuários", async () => {
		const result = await listStaff(redator, { repo });
		expect(result).toBeErr(Forbidden);
	});

	it("um admin lista os usuários", async () => {
		const result = await listStaff(admin, { repo });
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toHaveLength(2);
	});

	it("um redator não pode alterar papéis", async () => {
		const result = await changeStaffRole(
			redator,
			{ staffId: "redator-1", role: "EDITOR" },
			{ repo },
		);
		expect(result).toBeErr(Forbidden);
	});

	it("um redator não pode reativar um membro", async () => {
		const result = await activateStaff(
			redator,
			{ staffId: "redator-1" },
			{ repo },
		);
		expect(result).toBeErr(Forbidden);
	});
});

describe("gestão de usuários — efeitos", () => {
	it("admin promove um redator a editor e persiste", async () => {
		const result = await changeStaffRole(
			admin,
			{ staffId: "redator-1", role: "EDITOR" },
			{ repo },
		);

		expect(result.isOk()).toBe(true);
		expect((await repo.findById("redator-1"))?.role).toBe("EDITOR");
	});

	it("admin vincula editorias a um editor", async () => {
		await bindStaffSections(
			admin,
			{ staffId: "redator-1", sectionIds: ["politica", "cidades"] },
			{ repo },
		);
		expect(
			(await repo.findById("redator-1"))?.belongsToSection("politica"),
		).toBe(true);
	});

	it("admin desativa um membro (autoria preservada pelo id)", async () => {
		await deactivateStaff(admin, { staffId: "redator-1" }, { repo });
		const loaded = await repo.findById("redator-1");
		expect(loaded?.isActive()).toBe(false);
		expect(loaded?.id).toBe("redator-1");
	});

	it("admin reativa um membro desativado, com o mesmo papel de antes", async () => {
		const roleBefore = (await repo.findById("redator-1"))?.role;
		await deactivateStaff(admin, { staffId: "redator-1" }, { repo });

		const result = await activateStaff(
			admin,
			{ staffId: "redator-1" },
			{ repo },
		);

		expect(result.isOk()).toBe(true);
		const loaded = await repo.findById("redator-1");
		expect(loaded?.isActive()).toBe(true);
		expect(loaded?.role).toBe(roleBefore);
	});

	it("reativar um membro já ativo não tem efeito (idempotente)", async () => {
		const result = await activateStaff(
			admin,
			{ staffId: "redator-1" },
			{ repo },
		);

		expect(result.isOk()).toBe(true);
		expect((await repo.findById("redator-1"))?.isActive()).toBe(true);
	});

	it("alterar um membro inexistente devolve StaffNotFound", async () => {
		const result = await changeStaffRole(
			admin,
			{ staffId: "fantasma", role: "EDITOR" },
			{ repo },
		);
		expect(result).toBeErr(StaffNotFound);
	});
});

describe("perfil de autor", () => {
	it("o próprio membro edita seu perfil sem gerenciar usuários", async () => {
		const profile = AuthorProfile.create({ bio: "Repórter", title: "Redator" });
		const result = await updateAuthorProfile(
			redator,
			{ staffId: "redator-1", profile },
			{ repo },
		);

		expect(result.isOk()).toBe(true);
		expect((await repo.findById("redator-1"))?.authorProfile.bio).toBe(
			"Repórter",
		);
	});

	it("um membro comum não edita o perfil de outro", async () => {
		const profile = AuthorProfile.create({ bio: "hack" });
		const result = await updateAuthorProfile(
			redator,
			{ staffId: "admin-1", profile },
			{ repo },
		);
		expect(result).toBeErr(Forbidden);
	});
});
