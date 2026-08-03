import type { Poll } from "./types";

export const WEEKLY_POLL: Poll = {
	question: "Você aprova a nova faixa de ônibus na avenida principal?",
	totalVotes: 1203,
	options: [
		{ id: "aprovo", label: "Aprovo", percentage: 48 },
		{
			id: "aprovo-com-ressalvas",
			label: "Aprovo com ressalvas",
			percentage: 31,
		},
		{ id: "desaprovo", label: "Desaprovo", percentage: 21 },
	],
};
