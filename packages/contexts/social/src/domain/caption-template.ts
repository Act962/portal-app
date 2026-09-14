/**
 * Os dados da matéria que o modelo de legenda sabe usar.
 *
 * É um objeto SIMPLES, e não o agregado `Article`: fosse o agregado, este
 * contexto importaria o editorial e a regra `contextos-isolados` cairia. Quem
 * preenche isto é a raiz de composição, que enxerga os dois lados.
 */
export type CaptionContext = {
	headline: string;
	standfirst: string | null;
	sectionName: string | null;
	authorName: string | null;
	tags: readonly string[];
	url: string | null;
	siteName: string;
};

/**
 * Os campos que a redação pode escrever entre chaves no modelo. A tela de
 * configuração lista estes nomes — nunca uma lista digitada à mão em outro
 * arquivo, que é como as duas divergem.
 */
export const CAPTION_PLACEHOLDERS = [
	"titulo",
	"linha-fina",
	"editoria",
	"autor",
	"link",
	"tags",
	"veiculo",
] as const;

export type CaptionPlaceholder = (typeof CAPTION_PLACEHOLDERS)[number];

/**
 * O modelo padrão da legenda. **Um só, para as duas redes** — e é o que torna
 * o D6 ("uma legenda, aprovada uma vez") verdade em vez de slogan.
 *
 * Ele não inclui `{link}` de propósito: no Instagram a URL da legenda **não é
 * clicável**, e gastar 60 caracteres com um endereço que ninguém consegue tocar
 * ensina o leitor a ignorar o fim da legenda. O Facebook, onde o link funciona,
 * o recebe assim mesmo — `SocialPost.captionFor("FACEBOOK")` o acrescenta no
 * envio, sem que exista uma segunda legenda para alguém aprovar.
 *
 * `{link}` continua sendo um campo válido para quem escrever um modelo à mão.
 */
export const DEFAULT_CAPTION_TEMPLATE =
	"{titulo}\n\n{linha-fina}\n\n📲 Matéria completa no link da bio.\n\n{tags}";

/**
 * Monta a legenda a partir do modelo e dos dados da matéria.
 *
 * Função PURA: mesmo modelo e mesmos dados, mesma legenda. Nada de relógio, de
 * `Math.random()` nem de acesso a banco — é o que permite testá-la com uma
 * tabela de casos e é o que a regra de testes do projeto exige de toda lógica
 * nova.
 *
 * **Campo vazio não deixa buraco.** Matéria sem linha-fina é rotina, e um
 * modelo com `{linha-fina}` no meio produziria duas quebras de linha seguidas —
 * uma lacuna que, no feed, parece descuido. A limpeza no fim colapsa isso.
 *
 * **Placeholder desconhecido fica visível.** `{titullo}` escrito errado
 * permanece na legenda em vez de sumir, porque existe uma etapa de aprovação
 * humana (D1): a pessoa vê o erro na prévia e conserta. Apagar em silêncio
 * transformaria um erro de digitação numa legenda faltando o título, que é bem
 * pior e ninguém notaria a tempo.
 */
export function renderCaption(
	template: string,
	context: CaptionContext,
): string {
	const values: Record<CaptionPlaceholder, string> = {
		titulo: context.headline.trim(),
		"linha-fina": context.standfirst?.trim() ?? "",
		editoria: context.sectionName?.trim() ?? "",
		autor: context.authorName?.trim() ?? "",
		link: context.url?.trim() ?? "",
		tags: toHashtags(context.tags).join(" "),
		veiculo: context.siteName.trim(),
	};

	const filled = template.replace(/\{([a-z-]+)\}/g, (match, name: string) =>
		isPlaceholder(name) ? values[name] : match,
	);

	return tidy(filled);
}

/**
 * Transforma tags editoriais em hashtags.
 *
 * Acento sai (`#eleições` funciona no Instagram, mas quebra a busca e a
 * comparação entre plataformas), espaço vira junção em maiúscula
 * (`saúde pública` → `#SaudePublica`, que é legível, ao contrário de
 * `#saudepublica`), e o que sobrar sem letra nenhuma é descartado em vez de
 * virar um `#` solto.
 */
export function toHashtags(tags: readonly string[]): readonly string[] {
	const seen = new Set<string>();
	const hashtags: string[] = [];

	for (const tag of tags) {
		const words = tag
			.normalize("NFD")
			// `\p{M}` são as marcas de combinação que o NFD separou da letra — o
			// acento em si. Escrito como propriedade Unicode, e não como faixa
			// literal, para o regex continuar legível em qualquer editor.
			.replace(/\p{M}/gu, "")
			.split(/[^a-zA-Z0-9]+/)
			.filter((word) => word !== "");

		if (words.length === 0) {
			continue;
		}

		const hashtag = `#${words.map(capitalize).join("")}`;
		const key = hashtag.toLowerCase();
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		hashtags.push(hashtag);
	}

	return hashtags;
}

function capitalize(word: string): string {
	return word.charAt(0).toUpperCase() + word.slice(1);
}

function isPlaceholder(name: string): name is CaptionPlaceholder {
	return (CAPTION_PLACEHOLDERS as readonly string[]).includes(name);
}

/**
 * Limpa o que os campos vazios deixaram para trás: espaços no fim das linhas,
 * três ou mais quebras seguidas viram duas (uma linha em branco, que é o
 * parágrafo do feed), e as bordas são aparadas.
 */
function tidy(text: string): string {
	return text
		.replace(/[^\S\n]+$/gm, "")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}
