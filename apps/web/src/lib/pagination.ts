export const DEFAULT_PAGE_SIZE = 6;

export type Paginated<T> = {
	items: T[];
	currentPage: number;
	totalPages: number;
};

/** Clamps out-of-range pages instead of rendering an empty listing. */
export function paginate<T>(
	items: T[],
	requestedPage: number,
	pageSize: number = DEFAULT_PAGE_SIZE,
): Paginated<T> {
	const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
	const currentPage = Math.min(Math.max(1, requestedPage), totalPages);
	const start = (currentPage - 1) * pageSize;

	return {
		items: items.slice(start, start + pageSize),
		currentPage,
		totalPages,
	};
}

/** Reads `?page=` without trusting it. */
export function parsePageParam(value: string | string[] | undefined): number {
	const raw = Array.isArray(value) ? value[0] : value;
	const parsed = Number.parseInt(raw ?? "1", 10);

	return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}
