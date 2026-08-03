import Link from "next/link";
import { Fragment } from "react";

import { routes } from "@/lib/routes";

export type Crumb = {
	label: string;
	href?: string;
};

/** Trail above the headline. Its structured-data twin lives in lib/structured-data.ts. */
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
	return (
		<nav aria-label="Trilha de navegação" className="mb-4.5">
			<ol className="flex flex-wrap items-center gap-1.5 font-mono text-[10.5px] text-meta uppercase tracking-[0.06em]">
				<li>
					<Link href={routes.home} className="text-meta hover:text-brand-red">
						Home
					</Link>
				</li>

				{crumbs.map((crumb) => (
					<Fragment key={crumb.label}>
						<li aria-hidden>/</li>
						<li>
							{crumb.href ? (
								<Link
									href={crumb.href as never}
									className="text-meta hover:text-brand-red"
								>
									{crumb.label}
								</Link>
							) : (
								<span aria-current="page">{crumb.label}</span>
							)}
						</li>
					</Fragment>
				))}
			</ol>
		</nav>
	);
}
