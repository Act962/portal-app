import type { Route } from "next";

/**
 * Single place where public URLs are built.
 *
 * The shape `/{editoria}/{slug}` is a product decision recorded in
 * docs/ui-ux.md §5 — no dates and no numeric ids, so a story can be updated
 * without its URL going stale.
 *
 * `typedRoutes` cannot verify an interpolated segment, so each helper asserts
 * the result. That assertion is the one place the guarantee is made.
 */
export const routes = {
	home: "/" as Route,
	menu: "/menu" as Route,
	latest: "/ultimas" as Route,
	search: "/busca" as Route,
	columnists: "/colunistas" as Route,
	polls: "/enquetes" as Route,
	privacy: "/privacidade" as Route,
	terms: "/termos" as Route,
	section: (slug: string) => `/${slug}` as Route,
	article: (sectionSlug: string, slug: string) =>
		`/${sectionSlug}/${slug}` as Route,
	author: (slug: string) => `/autor/${slug}` as Route,
	tag: (slug: string) => `/tag/${slug}` as Route,
	searchFor: (term: string) => `/busca?q=${encodeURIComponent(term)}` as Route,
};
