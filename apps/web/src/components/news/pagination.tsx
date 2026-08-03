import { Chip } from "@portal-app/ui/components/chip";
import type { Route } from "next";
import Link from "next/link";

type PaginationProps = {
	currentPage: number;
	totalPages: number;
	/** Base path the page number is appended to as `?page=`. */
	basePath: string;
};

export function Pagination({
	currentPage,
	totalPages,
	basePath,
}: PaginationProps) {
	if (totalPages <= 1) {
		return null;
	}

	const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

	return (
		<nav aria-label="Paginação" className="flex items-center gap-2 pt-stack">
			{pages.map((page) =>
				page === currentPage ? (
					<Chip key={page} variant="selected" aria-current="page">
						{page}
					</Chip>
				) : (
					<Link key={page} href={`${basePath}?page=${page}` as Route}>
						<Chip>{page}</Chip>
					</Link>
				),
			)}

			{currentPage < totalPages ? (
				<Link
					href={`${basePath}?page=${currentPage + 1}` as Route}
					aria-label="Próxima página"
				>
					<Chip>›</Chip>
				</Link>
			) : null}
		</nav>
	);
}
