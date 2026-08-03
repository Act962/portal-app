import Header from "@/components/header";
import Providers from "@/components/providers";

/**
 * Authenticated area (dashboard, login).
 *
 * Deliberately separate from `(site)`: the portal and the newsroom tooling
 * have different chrome, different audiences and different performance
 * budgets. The real admin replaces this shell in Phase 1 of the roadmap.
 *
 * React Query, the theme provider and the toaster are mounted here rather
 * than at the root because only this area uses them — the public portal is
 * entirely server-rendered and should ship none of that JavaScript.
 */
export default function AppLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<Providers>
			<div className="grid h-svh grid-rows-[auto_1fr]">
				<Header />
				{children}
			</div>
		</Providers>
	);
}
