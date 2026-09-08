import { listSections } from "@portal-app/taxonomy";
import { revalidatePath } from "next/cache";

import { sectionDeps } from "./taxonomy";

/**
 * Invalidação do cache do portal público a cada mutação editorial.
 *
 * **Por que isto existe.** A página da matéria (`/[section]/[slug]`) é a única
 * do portal que sai do build como SSG — `generateStaticParams` a pré-renderiza
 * e o `revalidate = 60` do grupo `(site)` a mantém em ISR. Home, editoria,
 * últimas e busca são dinâmicas (`ƒ` na tabela do build), então elas já
 * mostravam a edição no mesmo instante. A matéria, não: medido num `next start`
 * contra este mesmo banco, um parágrafo acrescentado levou **mais de 70
 * segundos e três recargas** para aparecer — os 60s da janela mais o
 * stale-while-revalidate, que serve a versão VELHA à requisição que dispara a
 * regeneração.
 *
 * Para quem escreve, isso não se lê como cache: lê-se como "salvei e o portal
 * não mudou". Era a queixa da redação, e a causa não era o editor nem o
 * salvamento — os dois estavam certos o tempo todo.
 *
 * O passo estava previsto no comentário do `(site)/layout.tsx` e em
 * `docs/pendencias.md`: trocar a espera pelo relógio por invalidação POR
 * EVENTO. É o que este módulo faz.
 *
 * **Só o endereço afetado.** `revalidatePath("/[section]/[slug]", "page")`
 * derrubaria o cache de TODAS as matérias, e o autosave dispara a cada pausa de
 * um segundo na digitação — o portal inteiro seria regenerado enquanto alguém
 * escreve. Aqui se invalida o caminho concreto daquela matéria.
 *
 * Falha aqui NÃO derruba a mutação: a matéria já está salva no banco, e perder
 * o texto por causa de um cache seria trocar um problema pequeno por um grande.
 * No pior caso o portal volta a demorar o minuto de sempre.
 */
export async function revalidateArticlePaths(
	article: { slug: string; sectionId: string | null },
	/** O endereço ANTERIOR, quando o slug ou a editoria mudaram: sem isto a
	 * página velha continuaria no ar em cache até a janela vencer. */
	previous?: { slug: string; sectionId: string | null } | null,
): Promise<void> {
	try {
		const paths = new Set<string>();
		for (const target of [article, previous]) {
			if (target) {
				paths.add(await articlePath(target));
			}
		}
		for (const path of paths) {
			revalidatePath(path);
		}
	} catch (error) {
		console.warn(
			"[portal-cache] não consegui invalidar a página da matéria; ela entra no ar pelo revalidate de 60s:",
			error,
		);
	}
}

/**
 * O endereço público da matéria.
 *
 * Mesma regra do read model do portal (`data/read-model.ts`): matéria sem
 * editoria cai em `geral`. As duas precisam concordar — invalidar um caminho
 * que a página não usa é o mesmo que não invalidar nada.
 */
async function articlePath(article: {
	slug: string;
	sectionId: string | null;
}): Promise<string> {
	if (!article.sectionId) {
		return `/geral/${article.slug}`;
	}
	const sections = await listSections(sectionDeps);
	const section = sections.find((item) => item.id === article.sectionId);
	return `/${section?.slug ?? "geral"}/${article.slug}`;
}
