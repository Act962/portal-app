import { describe, expect, it } from "vitest";

import {
	InvalidPollTransition,
	OptionLabelRequired,
	OptionNotInPoll,
	OptionsLockedAfterPublish,
	Poll,
	PollNotOpen,
	QuestionRequired,
	TooFewOptions,
} from "../../src/index";

const NOW = new Date("2026-08-07T12:00:00-03:00");

function novo(overrides: Partial<Parameters<typeof Poll.create>[0]> = {}) {
	return Poll.create({
		id: "poll-1",
		question: "Você aprova a nova faixa de ônibus?",
		options: [
			{ id: "o1", label: "Aprovo" },
			{ id: "o2", label: "Desaprovo" },
		],
		...overrides,
	});
}

describe("Poll.create", () => {
	it("nasce como rascunho, sem data de publicação", () => {
		const poll = novo().unwrap();

		expect(poll.status).toBe("RASCUNHO");
		expect(poll.publishedAt).toBeNull();
		expect(poll.isOpen()).toBe(false);
	});

	it("recusa pergunta vazia", () => {
		expect(novo({ question: "   " }).unwrapErr()).toBeInstanceOf(
			QuestionRequired,
		);
	});

	it("recusa menos de duas opções — enquete de uma opção é afirmação", () => {
		expect(
			novo({ options: [{ id: "o1", label: "Só essa" }] }).unwrapErr(),
		).toBeInstanceOf(TooFewOptions);
		expect(novo({ options: [] }).unwrapErr()).toBeInstanceOf(TooFewOptions);
	});

	it("recusa opção com texto vazio", () => {
		expect(
			novo({
				options: [
					{ id: "o1", label: "Aprovo" },
					{ id: "o2", label: "  " },
				],
			}).unwrapErr(),
		).toBeInstanceOf(OptionLabelRequired);
	});

	it("guarda a ordem em que as opções foram informadas", () => {
		const poll = novo({
			options: [
				{ id: "a", label: "Primeira" },
				{ id: "b", label: "Segunda" },
				{ id: "c", label: "Terceira" },
			],
		}).unwrap();

		expect(poll.options.map((option) => option.order)).toEqual([0, 1, 2]);
		expect(poll.options.map((option) => option.id)).toEqual(["a", "b", "c"]);
	});

	it("apara os textos", () => {
		const poll = novo({
			question: "  Pergunta?  ",
			options: [
				{ id: "o1", label: "  Sim " },
				{ id: "o2", label: "Não" },
			],
		}).unwrap();

		expect(poll.question).toBe("Pergunta?");
		expect(poll.options[0]?.label).toBe("Sim");
	});
});

describe("Poll — máquina de estados", () => {
	it("publica a partir do rascunho e registra o instante", () => {
		const poll = novo().unwrap();

		expect(poll.publish(NOW).isOk()).toBe(true);
		expect(poll.status).toBe("PUBLICADA");
		expect(poll.publishedAt).toEqual(NOW);
		expect(poll.isOpen()).toBe(true);
	});

	it("não publica duas vezes", () => {
		const poll = novo().unwrap();
		poll.publish(NOW);

		expect(poll.publish(NOW).unwrapErr()).toBeInstanceOf(InvalidPollTransition);
	});

	it("fecha a partir de publicada", () => {
		const poll = novo().unwrap();
		poll.publish(NOW);

		expect(poll.close().isOk()).toBe(true);
		expect(poll.status).toBe("FECHADA");
		expect(poll.isOpen()).toBe(false);
	});

	it("não fecha um rascunho", () => {
		expect(novo().unwrap().close().unwrapErr()).toBeInstanceOf(
			InvalidPollTransition,
		);
	});

	it("enquete fechada NÃO reabre — misturaria votos de dois momentos", () => {
		const poll = novo().unwrap();
		poll.publish(NOW);
		poll.close();

		expect(poll.publish(NOW).unwrapErr()).toBeInstanceOf(InvalidPollTransition);
	});
});

describe("Poll.update", () => {
	it("edita a pergunta do rascunho", () => {
		const poll = novo().unwrap();

		expect(poll.update({ question: "Outra pergunta?" }).isOk()).toBe(true);
		expect(poll.question).toBe("Outra pergunta?");
	});

	it("troca as opções enquanto é rascunho", () => {
		const poll = novo().unwrap();

		const result = poll.update({
			options: [
				{ id: "n1", label: "A" },
				{ id: "n2", label: "B" },
			],
		});

		expect(result.isOk()).toBe(true);
		expect(poll.options.map((option) => option.label)).toEqual(["A", "B"]);
	});

	it("NÃO troca as opções depois de publicada — o voto perderia o sentido", () => {
		const poll = novo().unwrap();
		poll.publish(NOW);

		const result = poll.update({
			options: [
				{ id: "n1", label: "A" },
				{ id: "n2", label: "B" },
			],
		});

		expect(result.unwrapErr()).toBeInstanceOf(OptionsLockedAfterPublish);
		// E nada foi alterado pela metade.
		expect(poll.options.map((option) => option.label)).toEqual([
			"Aprovo",
			"Desaprovo",
		]);
	});

	it("a pergunta ainda pode ser corrigida depois de publicada (erro de digitação)", () => {
		const poll = novo().unwrap();
		poll.publish(NOW);

		expect(poll.update({ question: "Pergunta corrigida?" }).isOk()).toBe(true);
	});

	it("edição inválida não aplica nada", () => {
		const poll = novo().unwrap();

		expect(poll.update({ question: "  " }).unwrapErr()).toBeInstanceOf(
			QuestionRequired,
		);
		expect(poll.question).toBe("Você aprova a nova faixa de ônibus?");
	});

	// A validação das opções vale na edição do rascunho tanto quanto na criação:
	// é o caminho por onde uma enquete já salva poderia ficar sem opção.
	it("recusa trocar por menos de duas opções", () => {
		const poll = novo().unwrap();

		expect(
			poll.update({ options: [{ id: "n1", label: "Só essa" }] }).unwrapErr(),
		).toBeInstanceOf(TooFewOptions);
		expect(poll.options).toHaveLength(2);
	});

	it("recusa trocar por opção com texto vazio", () => {
		const poll = novo().unwrap();

		expect(
			poll
				.update({
					options: [
						{ id: "n1", label: "Aprovo" },
						{ id: "n2", label: "   " },
					],
				})
				.unwrapErr(),
		).toBeInstanceOf(OptionLabelRequired);
		expect(poll.options.map((option) => option.label)).toEqual([
			"Aprovo",
			"Desaprovo",
		]);
	});
});

describe("Poll.ensureCanReceiveVote", () => {
	it("aceita voto em opção da enquete aberta", () => {
		const poll = novo().unwrap();
		poll.publish(NOW);

		expect(poll.ensureCanReceiveVote("o1").isOk()).toBe(true);
	});

	it("recusa voto em rascunho", () => {
		expect(
			novo().unwrap().ensureCanReceiveVote("o1").unwrapErr(),
		).toBeInstanceOf(PollNotOpen);
	});

	it("recusa voto em enquete fechada", () => {
		const poll = novo().unwrap();
		poll.publish(NOW);
		poll.close();

		expect(poll.ensureCanReceiveVote("o1").unwrapErr()).toBeInstanceOf(
			PollNotOpen,
		);
	});

	it("recusa voto em opção de outra enquete", () => {
		const poll = novo().unwrap();
		poll.publish(NOW);

		expect(
			poll.ensureCanReceiveVote("opcao-alheia").unwrapErr(),
		).toBeInstanceOf(OptionNotInPoll);
	});
});
