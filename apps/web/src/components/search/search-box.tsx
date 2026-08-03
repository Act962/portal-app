import { Search } from "lucide-react";

/**
 * Plain GET form pointed at `/busca`, so search works with JavaScript
 * disabled and the query stays shareable in the URL.
 */
export function SearchBox({ defaultValue = "" }: { defaultValue?: string }) {
	return (
		// <search> is the semantic landmark; the form inside carries the behaviour.
		<search>
			<form
				action="/busca"
				method="get"
				className="mb-5 flex items-center gap-2.5 rounded-control border-[1.5px] border-brand-navy p-3 md:mb-stack md:gap-3 md:border-2 md:p-3.5"
			>
				<Search size={18} className="shrink-0 text-brand-navy" aria-hidden />

				<label htmlFor="site-search" className="sr-only">
					Buscar no portal
				</label>
				<input
					id="site-search"
					name="q"
					type="search"
					defaultValue={defaultValue}
					placeholder="Buscar notícias, programas, cidades…"
					className="min-w-0 flex-1 text-ink text-sm placeholder:text-meta focus-visible:outline-none md:text-[17px]"
				/>

				<button
					type="submit"
					className="shrink-0 rounded-control bg-brand-navy px-4 py-2.5 font-bold text-[12.5px] text-white uppercase tracking-[0.06em] hover:bg-brand-navy-hover"
				>
					Buscar
				</button>
			</form>
		</search>
	);
}
