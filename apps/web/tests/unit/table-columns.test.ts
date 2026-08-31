import { describe, expect, it } from "vitest";

import {
	type ColumnSpec,
	clampWidth,
	defaultWidths,
	hasCustomWidths,
	pinnedKeys,
	pinnedOffsets,
	readStoredWidths,
	resizeColumn,
	STACK,
	serializeWidths,
	stackLevel,
	tableMinWidth,
} from "@/lib/table-columns";

/**
 * A aritmética das colunas. Testada de verdade porque o modo de falhar dela é
 * MUDO: largura fora do limite não quebra tipo nem build — produz uma coluna
 * inagarrável, ou uma congelada que cobre a vizinha durante a rolagem. Coisas
 * que só aparecem no navegador, rolando, com a janela num tamanho específico.
 */

const SPECS: ColumnSpec[] = [
	{ key: "sel", width: 44, minWidth: 44, pinned: true },
	{
		key: "titulo",
		width: 380,
		minWidth: 180,
		maxWidth: 720,
		resizable: true,
		pinned: true,
	},
	{ key: "status", width: 140, minWidth: 100, resizable: true },
	{ key: "editoria", width: 180, minWidth: 120, resizable: true },
];

describe("clampWidth", () => {
	it("respeita o mínimo — é ele que deixa desfazer o arrasto", () => {
		expect(clampWidth(SPECS[1] as ColumnSpec, 20)).toBe(180);
	});

	it("respeita o máximo declarado", () => {
		expect(clampWidth(SPECS[1] as ColumnSpec, 5000)).toBe(720);
	});

	it("aplica um teto padrão a quem não declarou", () => {
		expect(clampWidth(SPECS[2] as ColumnSpec, 5000)).toBe(720);
	});

	it("arredonda — meio pixel de arrasto não vira meio pixel de coluna", () => {
		expect(clampWidth(SPECS[2] as ColumnSpec, 140.6)).toBe(141);
	});

	it("NaN e Infinity caem no padrão, e não no CSS", () => {
		// Propagar NaN para a largura faz o navegador tratar como "automática", e
		// a tabela inteira se rearranja sozinha — pior do que ignorar o arrasto.
		expect(clampWidth(SPECS[2] as ColumnSpec, Number.NaN)).toBe(140);
		expect(clampWidth(SPECS[2] as ColumnSpec, Number.POSITIVE_INFINITY)).toBe(
			140,
		);
	});
});

describe("resizeColumn", () => {
	const widths = defaultWidths(SPECS);

	it("muda a coluna pedida, e só ela", () => {
		const next = resizeColumn(widths, SPECS, "titulo", 500);
		expect(next.titulo).toBe(500);
		expect(next.status).toBe(140);
	});

	it("coluna não redimensionável ignora o pedido", () => {
		expect(resizeColumn(widths, SPECS, "sel", 300)).toBe(widths);
	});

	it("coluna desconhecida não cria chave nova", () => {
		const next = resizeColumn(widths, SPECS, "inexistente", 300);
		expect(next).toBe(widths);
		expect(next).not.toHaveProperty("inexistente");
	});

	it("devolve o MESMO objeto quando nada muda", () => {
		// Identidade preservada é o que impede um `setState` por pixel de arrasto
		// de re-renderizar a tabela inteira à toa.
		expect(resizeColumn(widths, SPECS, "titulo", 380)).toBe(widths);
		expect(resizeColumn(widths, SPECS, "titulo", 10)).not.toBe(widths);
	});

	it("não muta o objeto recebido", () => {
		resizeColumn(widths, SPECS, "titulo", 500);
		expect(widths.titulo).toBe(380);
	});
});

describe("pinnedKeys", () => {
	it("pega a sequência inicial de congeladas", () => {
		expect(pinnedKeys(SPECS)).toEqual(["sel", "titulo"]);
	});

	it("corta no primeiro furo — congelar coluna do meio abriria um buraco", () => {
		const furada: ColumnSpec[] = [
			{ key: "a", width: 50, minWidth: 50, pinned: true },
			{ key: "b", width: 50, minWidth: 50 },
			{ key: "c", width: 50, minWidth: 50, pinned: true },
		];
		expect(pinnedKeys(furada)).toEqual(["a"]);
	});

	it("nenhuma congelada devolve vazio", () => {
		expect(pinnedKeys([{ key: "a", width: 50, minWidth: 50 }])).toEqual([]);
	});
});

describe("pinnedOffsets", () => {
	it("a primeira gruda em 0 e a segunda na largura da primeira", () => {
		expect(pinnedOffsets(SPECS, defaultWidths(SPECS))).toEqual({
			sel: 0,
			titulo: 44,
		});
	});

	it("acompanha a largura ATUAL, não a de fábrica", () => {
		// Se o offset ficasse preso no padrão, redimensionar a primeira congelada
		// faria a segunda cobrir a vizinha durante a rolagem.
		const widths = { ...defaultWidths(SPECS), sel: 60 };
		expect(pinnedOffsets(SPECS, widths).titulo).toBe(60);
	});

	it("não calcula offset para coluna que rola", () => {
		expect(pinnedOffsets(SPECS, defaultWidths(SPECS))).not.toHaveProperty(
			"status",
		);
	});
});

describe("tableMinWidth", () => {
	it("é a soma das colunas — sem ela não existe rolagem horizontal", () => {
		expect(tableMinWidth(SPECS, defaultWidths(SPECS))).toBe(
			44 + 380 + 140 + 180,
		);
	});

	it("acompanha o redimensionamento", () => {
		const widths = resizeColumn(defaultWidths(SPECS), SPECS, "titulo", 500);
		expect(tableMinWidth(SPECS, widths)).toBe(44 + 500 + 140 + 180);
	});
});

describe("readStoredWidths", () => {
	it("sem nada guardado, devolve o padrão", () => {
		expect(readStoredWidths(null, SPECS)).toEqual(defaultWidths(SPECS));
	});

	it("restaura o que foi guardado", () => {
		expect(readStoredWidths('{"titulo":500}', SPECS).titulo).toBe(500);
	});

	it("JSON quebrado não derruba a tela", () => {
		expect(readStoredWidths("{isto não é json", SPECS)).toEqual(
			defaultWidths(SPECS),
		);
	});

	it("array e escalar são recusados como se fossem lixo", () => {
		expect(readStoredWidths("[1,2,3]", SPECS)).toEqual(defaultWidths(SPECS));
		expect(readStoredWidths('"400"', SPECS)).toEqual(defaultWidths(SPECS));
	});

	it("largura guardada por versão ANTIGA é limitada ao mínimo de hoje", () => {
		// O caso real: o mínimo do título subiu de 80 para 180 numa versão nova.
		// Confiar no disco recriaria, para quem já usou a tela, exatamente o
		// layout que o mínimo novo existe para impedir.
		expect(readStoredWidths('{"titulo":80}', SPECS).titulo).toBe(180);
	});

	it("coluna que não existe mais é descartada", () => {
		const widths = readStoredWidths('{"colunaAntiga":300}', SPECS);
		expect(widths).not.toHaveProperty("colunaAntiga");
		expect(widths).toEqual(defaultWidths(SPECS));
	});

	it("valor não numérico é ignorado, e o resto do objeto ainda vale", () => {
		const widths = readStoredWidths('{"titulo":"largo","status":200}', SPECS);
		expect(widths.titulo).toBe(380);
		expect(widths.status).toBe(200);
	});

	it("largura de coluna FIXA guardada é ignorada", () => {
		// A largura da caixinha é decisão do código; restaurá-la do disco
		// recriaria um layout que a versão nova já corrigiu.
		expect(readStoredWidths('{"sel":300}', SPECS).sel).toBe(44);
	});
});

describe("serializeWidths", () => {
	it("guarda só o que é redimensionável", () => {
		const saved = JSON.parse(serializeWidths(SPECS, defaultWidths(SPECS)));
		expect(Object.keys(saved).sort()).toEqual(["editoria", "status", "titulo"]);
	});

	it("o que é guardado volta igual", () => {
		const widths = resizeColumn(defaultWidths(SPECS), SPECS, "titulo", 500);
		const devolta = readStoredWidths(serializeWidths(SPECS, widths), SPECS);
		expect(devolta).toEqual(widths);
	});
});

describe("hasCustomWidths", () => {
	it("padrão de fábrica não tem o que restaurar", () => {
		expect(hasCustomWidths(SPECS, defaultWidths(SPECS))).toBe(false);
	});

	it("uma coluna fora do padrão já habilita o restaurar", () => {
		const widths = resizeColumn(defaultWidths(SPECS), SPECS, "status", 200);
		expect(hasCustomWidths(SPECS, widths)).toBe(true);
	});
});

describe("ordem de empilhamento", () => {
	it("cabeçalho congelado ACIMA da alça, e a alça acima da célula do corpo", () => {
		// A invariante que já quebrou: alça e cabeçalho congelado empatados em
		// `z-20`. Empate não é empate — decide a ordem no DOM, e a alça de uma
		// coluna já fora da vista pintava por cima do cabeçalho congelado.
		expect(stackLevel(STACK.pinnedHeader)).toBeGreaterThan(
			stackLevel(STACK.resizeHandle),
		);
		expect(stackLevel(STACK.resizeHandle)).toBeGreaterThan(
			stackLevel(STACK.pinnedCell),
		);
	});
});
