import {
	InMemoryStaffRepository,
	provisionStaffForNewUser,
} from "@portal-app/identity";
import { beforeEach, describe, expect, it } from "vitest";

describe("provisionStaffForNewUser", () => {
	let repo: InMemoryStaffRepository;

	beforeEach(() => {
		repo = new InMemoryStaffRepository();
	});

	it("o primeiro usuário do sistema nasce ADMIN e ativo", async () => {
		const staff = await provisionStaffForNewUser(
			{ userId: "u1", email: "a@x.com" },
			{ repo },
		);

		expect(staff.role).toBe("ADMIN");
		expect(staff.isActive()).toBe(true);
	});

	it("os seguintes nascem REDATOR", async () => {
		await provisionStaffForNewUser(
			{ userId: "u1", email: "a@x.com" },
			{ repo },
		);
		const second = await provisionStaffForNewUser(
			{ userId: "u2", email: "b@x.com" },
			{ repo },
		);

		expect(second.role).toBe("REDATOR");
	});

	it("é idempotente: não recria nem muda o papel", async () => {
		const first = await provisionStaffForNewUser(
			{ userId: "u1", email: "a@x.com" },
			{ repo },
		);
		const again = await provisionStaffForNewUser(
			{ userId: "u1", email: "a@x.com" },
			{ repo },
		);

		expect(again.id).toBe(first.id);
		expect(again.role).toBe("ADMIN");
		expect(await repo.list()).toHaveLength(1);
	});
});
