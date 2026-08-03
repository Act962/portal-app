import type { Section } from "./types";

/** Editorial sections, in menu order. Slugs are the public URL segments. */
export const SECTIONS: Section[] = [
	{
		slug: "politica",
		name: "Política",
		description:
			"Assembleia, câmaras municipais e bastidores do poder no Piauí.",
	},
	{
		slug: "cidades",
		name: "Cidades",
		description:
			"Obras, mobilidade, serviços públicos e o dia a dia dos municípios.",
	},
	{
		slug: "policia",
		name: "Polícia",
		description: "Segurança pública, operações e ocorrências na região.",
	},
	{
		slug: "economia",
		name: "Economia",
		description: "Negócios, emprego, agricultura e comércio no interior.",
	},
	{
		slug: "esportes",
		name: "Esportes",
		description:
			"Futebol piauiense, competições regionais e atletas da região.",
	},
	{
		slug: "educacao",
		name: "Educação",
		description:
			"Rede estadual e municipal, matrículas, concursos e vestibulares.",
	},
	{
		slug: "saude",
		name: "Saúde",
		description: "Atendimento, campanhas, mutirões e vigilância sanitária.",
	},
	{
		slug: "entretenimento",
		name: "Entretenimento",
		description: "Cultura, festivais, música e agenda de eventos do Piauí.",
	},
];

/** Sections featured as their own block on the home page, in order. */
export const HOME_BLOCK_SECTIONS = ["politica", "cidades"];
