"use client";

import { pageCount } from "@portal-app/shared-kernel";
import { Button } from "@portal-app/ui/components/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Rodapé de paginação das listas do painel.
 *
 * Diz onde se está e quanto existe, e não só "próxima": numa tela de arquivo, a
 * pergunta do editor costuma ser "quantas matérias temos?", não "o que vem
 * depois". Por isso o total aparece por extenso.
 *
 * Some sozinho quando tudo cabe numa página — controle de navegação para uma
 * página só é ruído.
 */
export function PaginationBar({
	page,
	perPage,
	total,
	onPageChange,
	unidade = { singular: "item", plural: "itens" },
}: {
	/** 1-based, como a UI conta. */
	page: number;
	perPage: number;
	total: number;
	onPageChange: (page: number) => void;
	unidade?: { singular: string; plural: string };
}) {
	const pages = pageCount(total, perPage);

	if (total === 0) {
		return null;
	}

	const primeiro = (page - 1) * perPage + 1;
	const ultimo = Math.min(page * perPage, total);
	const nome = total === 1 ? unidade.singular : unidade.plural;

	return (
		<div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2.5 text-muted-foreground text-sm">
			<span>
				{pages === 1 ? (
					<>
						{total} {nome}
					</>
				) : (
					<>
						{primeiro}–{ultimo} de {total} {nome}
					</>
				)}
			</span>

			{pages > 1 ? (
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						disabled={page <= 1}
						onClick={() => onPageChange(page - 1)}
					>
						<ChevronLeft className="size-4" />
						Anterior
					</Button>
					<span className="tabular-nums">
						{page} de {pages}
					</span>
					<Button
						variant="outline"
						size="sm"
						disabled={page >= pages}
						onClick={() => onPageChange(page + 1)}
					>
						Próxima
						<ChevronRight className="size-4" />
					</Button>
				</div>
			) : null}
		</div>
	);
}
