import { expect, test } from "@playwright/test";

test("T08: a home renderiza a manchete", async ({ page }) => {
	await page.goto("/");

	// A manchete é o h1 da home (HeroStory com headingLevel "h1").
	const headline = page.getByRole("heading", {
		level: 1,
		name: /pacote de obras para o norte do Piauí/i,
	});

	await expect(headline).toBeVisible();
});
