"use client";

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@portal-app/ui/components/breadcrumb";
import { Separator } from "@portal-app/ui/components/separator";
import { SidebarTrigger } from "@portal-app/ui/components/sidebar";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

import { ROUTE_LABELS } from "@/lib/admin-nav";

import { ThemeToggle } from "./theme-toggle";

/**
 * Trilha derivada do caminho. Um segmento sem rótulo conhecido (um id, por
 * exemplo) vira o rótulo genérico da página — a tela de detalhe substitui o
 * texto por conta própria quando sabe o título.
 */
function useCrumbs() {
	const pathname = usePathname();
	const segments = pathname.split("/").filter(Boolean);

	return segments.map((_, index) => {
		const href = `/${segments.slice(0, index + 1).join("/")}`;
		return {
			href,
			label: ROUTE_LABELS[href] ?? "Detalhe",
			isLast: index === segments.length - 1,
		};
	});
}

export function AdminTopbar() {
	const crumbs = useCrumbs();

	return (
		<header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<SidebarTrigger className="-ml-1" />
			<Separator orientation="vertical" className="mr-2 h-4" />

			<Breadcrumb>
				<BreadcrumbList>
					{crumbs.map((crumb) => (
						<Fragment key={crumb.href}>
							<BreadcrumbItem>
								{crumb.isLast ? (
									<BreadcrumbPage>{crumb.label}</BreadcrumbPage>
								) : (
									<BreadcrumbLink render={<Link href={crumb.href as Route} />}>
										{crumb.label}
									</BreadcrumbLink>
								)}
							</BreadcrumbItem>
							{crumb.isLast ? null : <BreadcrumbSeparator />}
						</Fragment>
					))}
				</BreadcrumbList>
			</Breadcrumb>

			<div className="flex-1" />

			<ThemeToggle />
		</header>
	);
}
