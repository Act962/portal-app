"use client";

import {
	DESTINATION_LABEL,
	formatsFor,
	type SocialDestination,
} from "@portal-app/social";
import { Button, buttonVariants } from "@portal-app/ui/components/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@portal-app/ui/components/select";
import { cn } from "@portal-app/ui/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Palette, Plus } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { trpc } from "@/utils/trpc";

import { templatesFor } from "../post-art-model";

export const NO_TEMPLATE = "__sem-padrao__";

/**
 * A escolha do padrão de um destino — e, quando não há padrão que sirva, a
 * SAÍDA do beco.
 *
 * Este componente existe por causa de um defeito de usabilidade real: com
 * nenhum padrão 9:16 cadastrado, a lista do Reels sobrava com "Sem padrão" e
 * mais nada. A tela não estava errada — o armário é que estava vazio —, mas ela
 * também não dizia isso nem oferecia o caminho, e quem abriu não tinha como
 * saber que precisava criar um padrão em outra tela, no formato certo, e voltar.
 *
 * Agora a falta é explicada e o botão cria o padrão já no formato do destino.
 */
export function TemplateChoice({
	destination,
	value,
	fallbackName,
	canDesign,
	disabled,
	onChange,
}: {
	destination: SocialDestination;
	/** O id do padrão escolhido, ou `null` para "sem padrão". */
	value: string | null;
	/** O nome da cópia guardada, quando o padrão saiu da lista (arquivado). */
	fallbackName?: string | null;
	/** Quem desenha padrões (`social:manage`) — só a essa pessoa se oferece criar. */
	canDesign: boolean;
	disabled?: boolean;
	onChange: (templateId: string | null) => void;
}) {
	const router = useRouter();
	const templates = useQuery(trpc.social.templates.list.queryOptions());
	const choices = templatesFor(destination, templates.data ?? []);
	const format = formatsFor(destination)[0] ?? "9:16";

	const create = useMutation(
		trpc.social.templates.create.mutationOptions({
			onSuccess: (template) => {
				// Leva direto ao editor do padrão recém-criado: criar um padrão vazio
				// e deixar a pessoa procurá-lo na lista seria devolvê-la ao beco.
				router.push(
					`/dashboard/social/padroes/${template.id}` as Route,
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const options = [
		{ value: NO_TEMPLATE, label: "Sem padrão — vídeo cru" },
		...choices.map((template) => ({
			value: template.id,
			label: template.defaultFor.includes(destination)
				? `${template.name} (padrão)`
				: template.name,
		})),
	];
	if (value && !choices.some((template) => template.id === value)) {
		options.push({ value, label: fallbackName ?? "Padrão guardado no post" });
	}

	return (
		<div className="flex flex-col gap-2">
			{/*
			  `items` NÃO é opcional aqui, e o componente avisa: o `<SelectValue>`
			  resolve o rótulo por ele, não pelos `<SelectItem>` — que só existem
			  no DOM depois de o popup abrir. Sem ele, o gatilho mostrava o id cru
			  do padrão no lugar do nome.
			*/}
			<Select
				items={options}
				value={value ?? NO_TEMPLATE}
				disabled={disabled}
				onValueChange={(next) => {
					if (next) {
						onChange(next === NO_TEMPLATE ? null : next);
					}
				}}
			>
				<SelectTrigger className="w-full">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{options.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			{templates.isSuccess && choices.length === 0 ? (
				<div className="flex flex-col gap-2 rounded-md border border-dashed p-3">
					<p className="text-muted-foreground text-xs">
						Nenhum padrão <strong>{format}</strong> cadastrado — e{" "}
						{DESTINATION_LABEL[destination]} só aceita esse formato. Sem um
						padrão, o vídeo sai enquadrado, sem arte.
					</p>
					<div className="flex flex-wrap gap-2">
						{/* Criar padrão é de quem DESENHA (`social:manage`). A quem só
						    publica, oferecer o botão seria prometer um 403. */}
						{canDesign ? (
							<Button
								type="button"
								size="sm"
								disabled={disabled || create.isPending}
								onClick={() =>
									create.mutate({
										name: `Padrão ${format} — ${DESTINATION_LABEL[destination]}`,
										format,
									})
								}
							>
								<Plus className="size-4" />
								Criar padrão {format}
							</Button>
						) : null}
						<Link
							href="/dashboard/social?tab=padroes"
							className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
						>
							<Palette className="size-4" />
							Ver os padrões
						</Link>
					</div>
				</div>
			) : null}
		</div>
	);
}
