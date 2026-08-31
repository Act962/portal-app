import { AD_SLOT_LABELS, AD_SLOTS } from "@portal-app/advertising";

/**
 * As posições, prontas para um `<Select>`.
 *
 * Mora em arquivo próprio, e não no `campaigns-manager`, porque a lista e o
 * diálogo precisam disto e o manager precisa dos dois — importar de volta do
 * manager fecharia um ciclo, que é o que o `depcruise` recusa (regra
 * `sem-ciclos`). Derivado do DOMÍNIO: acrescentar uma posição lá a faz
 * aparecer aqui sozinha.
 */
export const SLOT_OPTIONS = AD_SLOTS.map((slot) => ({
	value: slot,
	label: AD_SLOT_LABELS[slot],
}));
