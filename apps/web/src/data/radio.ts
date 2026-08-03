import type { LiveShow, Program, TrackLogEntry } from "./types";

export const LIVE_SHOW: LiveShow = {
	name: "Manhã 7 Cidades",
	host: "Léo Martins",
	schedule: "06h às 09h · de segunda a sábado",
	listeners: 1200,
};

export const SCHEDULE: Program[] = [
	{
		id: "manha-7-cidades",
		hour: "06h",
		name: "Manhã 7 Cidades",
		host: "Léo Martins",
		status: "on-air",
	},
	{
		id: "giro-de-noticias",
		hour: "09h",
		name: "Giro de Notícias",
		host: "Redação 7 Cidades",
	},
	{
		id: "almoco-sertanejo",
		hour: "12h",
		name: "Almoço Sertanejo",
		host: "Cida Pereira",
	},
	{
		id: "tarde-show",
		hour: "15h",
		name: "Tarde Show",
		host: "Rafa Lima",
	},
	{
		id: "piaui-em-debate",
		hour: "18h",
		name: "Piauí em Debate",
		host: "Marcos Andrade",
		status: "live",
	},
];

export const TRACK_LOG: TrackLogEntry[] = [
	{ at: "agora", title: "Bloco musical — sertanejo" },
	{ at: "07:42", title: "Recado dos ouvintes" },
	{ at: "07:20", title: "Boletim de trânsito" },
];
