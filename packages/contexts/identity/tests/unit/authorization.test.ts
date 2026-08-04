import {
	type Action,
	can,
	StaffMember,
	type StaffStatus,
} from "@portal-app/identity";
import { describe, expect, it } from "vitest";

function staff(overrides: {
	id?: string;
	role: "ADMIN" | "EDITOR" | "REDATOR";
	status?: StaffStatus;
	sectionIds?: string[];
}): StaffMember {
	return StaffMember.restore({
		id: overrides.id ?? "staff-1",
		email: "s@example.com",
		role: overrides.role,
		status: overrides.status ?? "ATIVO",
		sectionIds: overrides.sectionIds ?? [],
		authorProfile: null,
	});
}

const admin = staff({ id: "admin-1", role: "ADMIN" });
const editor = staff({
	id: "editor-1",
	role: "EDITOR",
	sectionIds: ["politica"],
});
const redator = staff({ id: "redator-1", role: "REDATOR" });

describe("can — matriz de permissões independente de recurso (I01)", () => {
	const cases: Array<{
		action: Action;
		redator: boolean;
		editor: boolean;
		admin: boolean;
	}> = [
		{ action: "article:create", redator: true, editor: true, admin: true },
		{ action: "article:submit", redator: true, editor: true, admin: true },
		{ action: "taxonomy:manage", redator: false, editor: false, admin: true },
		{ action: "user:manage", redator: false, editor: false, admin: true },
		{ action: "settings:manage", redator: false, editor: false, admin: true },
		{ action: "audit:view", redator: false, editor: false, admin: true },
	];

	it.each(cases)("$action", ({ action, redator: r, editor: e, admin: a }) => {
		expect(can(redator, action)).toBe(r);
		expect(can(editor, action)).toBe(e);
		expect(can(admin, action)).toBe(a);
	});
});

describe("editor restrito às editorias vinculadas (I03) e redator nunca publica (I02)", () => {
	const restricted: Action[] = [
		"article:edit-any",
		"article:approve",
		"article:publish",
		"article:unpublish",
	];

	it.each(restricted)("editor pode %s na editoria vinculada", (action) => {
		expect(can(editor, action, { sectionId: "politica" })).toBe(true);
	});

	it.each(restricted)("editor NÃO pode %s fora da editoria", (action) => {
		expect(can(editor, action, { sectionId: "esportes" })).toBe(false);
	});

	it.each(restricted)("redator nunca pode %s (I02)", (action) => {
		expect(can(redator, action, { sectionId: "politica" })).toBe(false);
	});

	it.each(restricted)("admin sempre pode %s", (action) => {
		expect(can(admin, action, { sectionId: "esportes" })).toBe(true);
	});
});

describe("article:edit-own só no próprio recurso (I05)", () => {
	it("redator e editor editam o próprio rascunho", () => {
		expect(can(redator, "article:edit-own", { authorId: "redator-1" })).toBe(
			true,
		);
		expect(can(editor, "article:edit-own", { authorId: "editor-1" })).toBe(
			true,
		);
	});

	it("redator e editor não editam rascunho de outro via edit-own", () => {
		expect(can(redator, "article:edit-own", { authorId: "outro" })).toBe(false);
		expect(can(editor, "article:edit-own", { authorId: "outro" })).toBe(false);
	});

	it("edit-own sem recurso é negado", () => {
		expect(can(redator, "article:edit-own")).toBe(false);
	});

	it("admin edita qualquer rascunho", () => {
		expect(can(admin, "article:edit-own", { authorId: "outro" })).toBe(true);
	});
});

describe("staff inativo não pode nada (I04)", () => {
	const inactiveAdmin = staff({
		id: "admin-1",
		role: "ADMIN",
		status: "INATIVO",
	});
	const actions: Action[] = [
		"article:create",
		"user:manage",
		"article:publish",
	];

	it.each(actions)("admin desativado é negado em %s", (action) => {
		expect(
			can(inactiveAdmin, action, {
				sectionId: "politica",
				authorId: "admin-1",
			}),
		).toBe(false);
	});
});
