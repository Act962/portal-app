"use client";

import {
	AD_SLOT_LABELS,
	type AdSlot,
	MAX_WEIGHT,
	MIN_WEIGHT,
} from "@portal-app/advertising";
import { Button } from "@portal-app/ui/components/button";
import { Checkbox } from "@portal-app/ui/components/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@portal-app/ui/components/dialog";
import { Input } from "@portal-app/ui/components/input";
import { Label } from "@portal-app/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@portal-app/ui/components/select";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { ImageField } from "@/components/media/image-field";
import { trpc } from "@/utils/trpc";

import { SLOT_OPTIONS } from "./slot-options";

/** O formulário em memória. Datas como texto `YYYY-MM-DD` porque é o que o
 * `<input type="date">` fala; a conversão para `Date` acontece no envio. */
type Form = {
	name: string;
	advertiser: string;
	slot: AdSlot;
	destinationUrl: string;
	startsAt: string;
	endsAt: string;
	weight: number;
	sectionIds: string[];
	mediaId: string | null;
	altText: string;
};

const EMPTY: Form = {
	name: "",
	advertiser: "",
	slot: "sidebar",
	destinationUrl: "",
	startsAt: "",
	endsAt: "",
	weight: 1,
	sectionIds: [],
	mediaId: null,
	altText: "",
};

/** `YYYY-MM-DD` de uma data, em horário LOCAL — é o que a pessoa digitou e o
 * que ela espera reler. Usar `toISOString()` aqui adiantaria ou atrasaria um
 * dia para quem está a oeste de Greenwich, que é o nosso caso. */
function toDateInput(value: string | Date | null): string {
	if (!value) {
		return "";
	}
	const date = new Date(value);
	const month = `${date.getMonth() + 1}`.padStart(2, "0");
	const day = `${date.getDate()}`.padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

export function CampaignDialog({
	open,
	campaignId,
	onOpenChange,
	onSaved,
}: {
	open: boolean;
	/** `null` = criando. */
	campaignId: string | null;
	onOpenChange: (open: boolean) => void;
	onSaved: () => Promise<void> | void;
}) {
	const [form, setForm] = useState<Form>(EMPTY);
	const nameId = useId();
	const advertiserId = useId();
	const urlId = useId();
	const startId = useId();
	const endId = useId();
	const weightId = useId();

	const sections = useQuery(trpc.taxonomy.sections.list.queryOptions());
	const existing = useQuery({
		...trpc.advertising.campaigns.get.queryOptions({ id: campaignId ?? "" }),
		enabled: open && campaignId !== null,
	});

	useEffect(() => {
		if (!open) {
			return;
		}
		if (!campaignId) {
			setForm(EMPTY);
			return;
		}
		const data = existing.data;
		if (data) {
			setForm({
				name: data.name,
				advertiser: data.advertiser,
				slot: data.slot,
				destinationUrl: data.destinationUrl,
				startsAt: toDateInput(data.startsAt),
				endsAt: toDateInput(data.endsAt),
				weight: data.weight,
				sectionIds: [...data.sectionIds],
				mediaId: data.creative?.mediaId ?? null,
				altText: data.creative?.altText ?? "",
			});
		}
	}, [open, campaignId, existing.data]);

	// Duas mutações separadas, e não um ternário dentro do `useMutation`: os
	// dois procedimentos têm ENTRADAS diferentes (o `update` exige `id`), e um
	// ternário obrigaria um cast que apagaria justamente essa diferença.
	const onDone = (message: string) => async () => {
		toast.success(message);
		await onSaved();
		onOpenChange(false);
	};
	const onFail = (error: { message: string }) => toast.error(error.message);

	const create = useMutation(
		trpc.advertising.campaigns.create.mutationOptions({
			onSuccess: onDone("Campanha criada como rascunho. Ative para ir ao ar."),
			onError: onFail,
		}),
	);
	const update = useMutation(
		trpc.advertising.campaigns.update.mutationOptions({
			onSuccess: onDone("Campanha salva."),
			onError: onFail,
		}),
	);
	const saving = create.isPending || update.isPending;

	const submit = () => {
		const payload = {
			name: form.name.trim(),
			advertiser: form.advertiser.trim(),
			slot: form.slot,
			destinationUrl: form.destinationUrl.trim(),
			// A data do `<input type="date">` é "meia-noite local". `new Date("2026-09-01")`
			// leria como UTC e anteciparia o início em três horas para o Piauí — a
			// campanha entraria no ar no dia anterior.
			startsAt: new Date(`${form.startsAt}T00:00:00`),
			endsAt: form.endsAt ? new Date(`${form.endsAt}T00:00:00`) : null,
			weight: form.weight,
			sectionIds: form.sectionIds,
			creative: form.mediaId
				? { mediaId: form.mediaId, altText: form.altText.trim() }
				: null,
		};
		if (campaignId) {
			update.mutate({ id: campaignId, ...payload });
		} else {
			create.mutate(payload);
		}
	};

	const canSubmit =
		form.name.trim() !== "" &&
		form.advertiser.trim() !== "" &&
		form.destinationUrl.trim() !== "" &&
		form.startsAt !== "" &&
		!saving;

	const toggleSection = (id: string) => {
		setForm((current) => ({
			...current,
			sectionIds: current.sectionIds.includes(id)
				? current.sectionIds.filter((value) => value !== id)
				: [...current.sectionIds, id],
		}));
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle>
						{campaignId ? "Editar campanha" : "Nova campanha"}
					</DialogTitle>
					<DialogDescription>
						A campanha nasce como rascunho. Ela só vai ao ar depois de ativada,
						e só dentro do período contratado.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-4 py-2">
					<div className="grid gap-4 sm:grid-cols-2">
						<div>
							<Label htmlFor={advertiserId}>Anunciante *</Label>
							<Input
								id={advertiserId}
								value={form.advertiser}
								onChange={(event) =>
									setForm({ ...form, advertiser: event.target.value })
								}
								placeholder="Loja do Zé"
								className="mt-1.5"
							/>
						</div>
						<div>
							<Label htmlFor={nameId}>Nome da campanha *</Label>
							<Input
								id={nameId}
								value={form.name}
								onChange={(event) =>
									setForm({ ...form, name: event.target.value })
								}
								placeholder="Verão 2026"
								className="mt-1.5"
							/>
							<p className="mt-1 text-muted-foreground text-xs">
								Interno — é como a equipe vai achar esta campanha na lista.
							</p>
						</div>
					</div>

					<div>
						<Label htmlFor={urlId}>Link de destino *</Label>
						<Input
							id={urlId}
							value={form.destinationUrl}
							onChange={(event) =>
								setForm({ ...form, destinationUrl: event.target.value })
							}
							placeholder="https://lojadoze.com.br/promocao"
							className="mt-1.5"
						/>
						<p className="mt-1 text-muted-foreground text-xs">
							Precisa começar com https://. Para onde o leitor vai ao clicar.
						</p>
					</div>

					<div>
						<Label>Imagem do anúncio *</Label>
						<div className="mt-1.5">
							<ImageField
								mediaId={form.mediaId}
								onChange={(mediaId) => setForm({ ...form, mediaId })}
								pickerTitle="Escolher a arte do anúncio"
								hint="Sem imagem a campanha não pode ir ao ar."
							/>
						</div>
					</div>

					<div>
						<Label htmlFor="alt-anuncio">Texto alternativo da imagem *</Label>
						<Input
							id="alt-anuncio"
							value={form.altText}
							onChange={(event) =>
								setForm({ ...form, altText: event.target.value })
							}
							placeholder="Loja do Zé — 30% de desconto em toda a loja"
							className="mt-1.5"
						/>
						<p className="mt-1 text-muted-foreground text-xs">
							É o que um leitor cego ouve no lugar do anúncio. Sem ele a
							campanha não sobe.
						</p>
					</div>

					<div className="grid gap-4 sm:grid-cols-3">
						<div>
							<Label>Posição *</Label>
							<Select
								items={SLOT_OPTIONS}
								value={form.slot}
								onValueChange={(value) =>
									setForm({ ...form, slot: (value ?? "sidebar") as AdSlot })
								}
							>
								<SelectTrigger className="mt-1.5 w-full">
									<SelectValue placeholder="Posição" />
								</SelectTrigger>
								<SelectContent>
									{SLOT_OPTIONS.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<p className="mt-1 text-muted-foreground text-xs">
								{AD_SLOT_LABELS[form.slot]}
							</p>
						</div>
						<div>
							<Label htmlFor={startId}>Início *</Label>
							<Input
								id={startId}
								type="date"
								value={form.startsAt}
								onChange={(event) =>
									setForm({ ...form, startsAt: event.target.value })
								}
								className="mt-1.5"
							/>
						</div>
						<div>
							<Label htmlFor={endId}>Término</Label>
							<Input
								id={endId}
								type="date"
								value={form.endsAt}
								onChange={(event) =>
									setForm({ ...form, endsAt: event.target.value })
								}
								className="mt-1.5"
							/>
							<p className="mt-1 text-muted-foreground text-xs">
								Em branco = sem fim combinado.
							</p>
						</div>
					</div>

					<div>
						<Label htmlFor={weightId}>Peso no rodízio</Label>
						<Input
							id={weightId}
							type="number"
							min={MIN_WEIGHT}
							max={MAX_WEIGHT}
							value={form.weight}
							onChange={(event) =>
								setForm({
									...form,
									weight: Number(event.target.value) || MIN_WEIGHT,
								})
							}
							className="mt-1.5 w-24"
						/>
						<p className="mt-1 text-muted-foreground text-xs">
							Quando há mais de uma campanha na mesma posição, elas se revezam.
							Peso {MIN_WEIGHT} a {MAX_WEIGHT} — peso 3 aparece três vezes mais
							que peso 1.
						</p>
					</div>

					<div>
						<Label>Editorias</Label>
						<p className="mt-1 mb-2 text-muted-foreground text-xs">
							Sem nenhuma marcada, a campanha aparece no portal inteiro.
							Marcando, ela só aparece nessas editorias — e ganha prioridade
							sobre as campanhas globais ali.
						</p>
						<div className="flex flex-wrap gap-3 rounded-md border p-3">
							{(sections.data ?? []).map((section) => (
								<div key={section.id} className="flex items-center gap-2">
									<Checkbox
										id={`editoria-${section.id}`}
										checked={form.sectionIds.includes(section.id)}
										onCheckedChange={() => toggleSection(section.id)}
									/>
									<Label
										htmlFor={`editoria-${section.id}`}
										className="cursor-pointer font-normal text-sm"
									>
										{section.name}
									</Label>
								</div>
							))}
						</div>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancelar
					</Button>
					<Button disabled={!canSubmit} onClick={submit}>
						{saving ? "Salvando…" : "Salvar"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
