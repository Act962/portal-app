"use client";

import type {
	Link as SiteLinkData,
	SiteSettingsData,
} from "@portal-app/settings";
import { Button } from "@portal-app/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@portal-app/ui/components/card";
import { Input } from "@portal-app/ui/components/input";
import { Label } from "@portal-app/ui/components/label";
import { Skeleton } from "@portal-app/ui/components/skeleton";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@portal-app/ui/components/tabs";
import { Textarea } from "@portal-app/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { ImageField } from "@/components/media/image-field";
import { trpc } from "@/utils/trpc";

/** Exatamente o que `settings.get` devolve — o mesmo tipo do agregado. */
type Settings = SiteSettingsData;

export function SettingsForm() {
	const query = useQuery(trpc.settings.get.queryOptions());

	if (query.isLoading || !query.data) {
		return (
			<div className="flex flex-col gap-4">
				<Skeleton className="h-10 w-96" />
				<Skeleton className="h-72 w-full" />
			</div>
		);
	}

	// Chaveado pelo dado: o estado do formulário nasce do servidor uma vez, sem
	// efeito de sincronização — que é a fonte clássica de campo que "volta
	// sozinho" enquanto se digita.
	return <Form initial={query.data} />;
}

function Form({ initial }: { initial: Settings }) {
	const queryClient = useQueryClient();
	const [draft, setDraft] = useState<Settings>(initial);

	const save = useMutation(
		trpc.settings.update.mutationOptions({
			onSuccess: (data) => {
				setDraft(data);
				queryClient.invalidateQueries({
					queryKey: trpc.settings.get.queryKey(),
				});
				toast.success("Configurações salvas. O portal atualiza em até 1 min.");
			},
			// A mensagem vem do domínio, já em pt-BR e explicando o que consertar.
			onError: (error) => toast.error(error.message),
		}),
	);

	const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
		setDraft((current) => ({ ...current, [key]: value }));

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				save.mutate(draft);
			}}
			className="flex flex-col gap-4"
		>
			<Tabs defaultValue="identidade">
				<TabsList className="mb-4 flex-wrap">
					<TabsTrigger value="identidade">Identidade</TabsTrigger>
					<TabsTrigger value="contato">Contato</TabsTrigger>
					<TabsTrigger value="redes">Redes</TabsTrigger>
					<TabsTrigger value="radio">Rádio</TabsTrigger>
					<TabsTrigger value="rodape">Rodapé</TabsTrigger>
				</TabsList>

				<TabsContent value="identidade">
					<Card>
						<CardHeader>
							<CardTitle>Identidade do veículo</CardTitle>
							<CardDescription>
								Aparece no cabeçalho, no rodapé e no título da aba do navegador.
							</CardDescription>
						</CardHeader>
						<CardContent className="grid gap-4 md:grid-cols-2">
							<Text
								label="Nome"
								value={draft.name}
								onChange={(v) => set("name", v)}
								hint="Como o veículo se chama por extenso."
							/>
							<Text
								label="Nome curto"
								value={draft.shortName}
								onChange={(v) => set("shortName", v)}
								hint="Usado no celular, onde não cabe o nome inteiro."
							/>
							<Text
								label="Chamada"
								value={draft.tagline}
								onChange={(v) => set("tagline", v)}
								hint="A linha sob o nome, no cabeçalho."
							/>
							<Text
								label="Endereço do portal"
								value={draft.url}
								onChange={(v) => set("url", v)}
								hint="Precisa começar com https://. Vai para o Google e para as redes."
							/>
							<Text
								label="Cidade"
								value={draft.city}
								onChange={(v) => set("city", v)}
							/>
							<Text
								label="Estado"
								value={draft.state}
								onChange={(v) => set("state", v)}
							/>
							<div className="md:col-span-2">
								<Area
									label="Descrição"
									value={draft.description}
									onChange={(v) => set("description", v)}
									hint="Uma frase sobre o portal. É o que aparece no Google e ao compartilhar um link."
								/>
							</div>

							<div className="flex flex-col gap-2 md:col-span-2">
								<Label>Logo</Label>
								<ImageField
									mediaId={draft.logoMediaId}
									onChange={(mediaId) => set("logoMediaId", mediaId)}
									pickerTitle="Escolher o logo"
									hint="Sem logo escolhido, o portal usa o arquivo padrão."
								/>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="contato">
					<Card>
						<CardHeader>
							<CardTitle>Contato</CardTitle>
							<CardDescription>
								Aparece no rodapé. Campo em branco some do site — melhor a
								ausência da linha do que um rótulo sem valor ao lado.
							</CardDescription>
						</CardHeader>
						<CardContent className="grid gap-4 md:grid-cols-2">
							<Text
								label="Telefone da redação"
								value={draft.contactNewsroom ?? ""}
								onChange={(v) => set("contactNewsroom", v)}
							/>
							<Text
								label="WhatsApp"
								value={draft.contactWhatsapp ?? ""}
								onChange={(v) => set("contactWhatsapp", v)}
							/>
							<Text
								label="E-mail"
								value={draft.contactEmail ?? ""}
								onChange={(v) => set("contactEmail", v)}
							/>
							<Text
								label="Endereço"
								value={draft.contactAddress ?? ""}
								onChange={(v) => set("contactAddress", v)}
							/>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="redes">
					<Card>
						<CardHeader>
							<CardTitle>Redes sociais</CardTitle>
							<CardDescription>
								Aparecem na barra do topo. Use o endereço da conta do veículo —
								os valores iniciais apontam para as páginas genéricas.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<LinkList
								links={draft.social}
								onChange={(links) => set("social", links)}
								labelPlaceholder="Instagram"
								hrefPlaceholder="https://instagram.com/sua-conta"
							/>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="radio">
					<Card>
						<CardHeader>
							<CardTitle>Rádio</CardTitle>
							<CardDescription>
								A frequência aparece sob o nome do veículo no cabeçalho e no
								rodapé do portal.
							</CardDescription>
						</CardHeader>
						<CardContent className="grid gap-4 md:grid-cols-2">
							<Text
								label="Frequência"
								value={draft.radioFrequency ?? ""}
								onChange={(v) => set("radioFrequency", v)}
								hint="Ex.: 93,9 MHz"
							/>
							<Text
								label="Faixa"
								value={draft.radioBand ?? ""}
								onChange={(v) => set("radioBand", v)}
								hint="Ex.: 93,9 FM"
							/>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="rodape">
					<div className="flex flex-col gap-4">
						<Card>
							<CardHeader>
								<CardTitle>Links institucionais</CardTitle>
								<CardDescription>
									Aparecem no rodapé e no menu.{" "}
									<strong>Sem endereço, viram texto</strong> em vez de link —
									assim ninguém clica em algo que não leva a lugar nenhum.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<LinkList
									links={draft.institutional}
									onChange={(links) => set("institutional", links)}
									labelPlaceholder="Quem somos"
									hrefPlaceholder="/quem-somos ou https://…"
								/>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Rodapé e busca</CardTitle>
							</CardHeader>
							<CardContent className="flex flex-col gap-4">
								<Text
									label="Linha legal"
									value={draft.legal ?? ""}
									onChange={(v) => set("legal", v)}
									hint="A linha cinza no fim da página."
								/>
								<TermList
									terms={draft.popularSearches}
									onChange={(terms) => set("popularSearches", terms)}
								/>
							</CardContent>
						</Card>
					</div>
				</TabsContent>
			</Tabs>

			<div className="flex items-center gap-3">
				<Button type="submit" disabled={save.isPending}>
					{save.isPending ? "Salvando…" : "Salvar configurações"}
				</Button>
				<p className="text-muted-foreground text-xs">
					Vale para o site inteiro. O portal atualiza em até 1 minuto.
				</p>
			</div>
		</form>
	);
}

function Text({
	label,
	value,
	onChange,
	hint,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	hint?: string;
}) {
	const id = useId();

	return (
		<div className="flex flex-col gap-1.5">
			<Label htmlFor={id}>{label}</Label>
			<Input
				id={id}
				value={value}
				onChange={(event) => onChange(event.target.value)}
			/>
			{hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
		</div>
	);
}

function Area({
	label,
	value,
	onChange,
	hint,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	hint?: string;
}) {
	const id = useId();

	return (
		<div className="flex flex-col gap-1.5">
			<Label htmlFor={id}>{label}</Label>
			<Textarea
				id={id}
				rows={3}
				value={value}
				onChange={(event) => onChange(event.target.value)}
			/>
			{hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
		</div>
	);
}

/** Editor das listas de destino (redes e institucionais). */
function LinkList({
	links,
	onChange,
	labelPlaceholder,
	hrefPlaceholder,
}: {
	links: SiteLinkData[];
	onChange: (links: SiteLinkData[]) => void;
	labelPlaceholder: string;
	hrefPlaceholder: string;
}) {
	const replace = (index: number, patch: Partial<SiteLinkData>) =>
		onChange(
			links.map((link, i) => (i === index ? { ...link, ...patch } : link)),
		);

	return (
		<div className="flex flex-col gap-3">
			{links.length === 0 ? (
				<p className="text-muted-foreground text-sm">Nenhum item ainda.</p>
			) : null}

			{links.map((link, index) => (
				<div
					// A posição É a identidade aqui: dois itens podem ter o mesmo rótulo
					// enquanto se digita, e a lista é curta e reordenável.
					key={`${index}-${link.label}`}
					className="flex flex-col gap-2 sm:flex-row"
				>
					<Input
						aria-label="Nome"
						placeholder={labelPlaceholder}
						value={link.label}
						onChange={(event) => replace(index, { label: event.target.value })}
						className="sm:w-56"
					/>
					<Input
						aria-label="Endereço"
						placeholder={hrefPlaceholder}
						value={link.href}
						onChange={(event) => replace(index, { href: event.target.value })}
						className="flex-1"
					/>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label={`Remover ${link.label || "item"}`}
						onClick={() => onChange(links.filter((_, i) => i !== index))}
					>
						<Trash2 className="size-4 text-destructive" />
					</Button>
				</div>
			))}

			<div>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => onChange([...links, { label: "", href: "" }])}
				>
					<Plus className="size-4" />
					Adicionar
				</Button>
			</div>
		</div>
	);
}

/** Termos sugeridos na página de busca. */
function TermList({
	terms,
	onChange,
}: {
	terms: string[];
	onChange: (terms: string[]) => void;
}) {
	const [draft, setDraft] = useState("");

	const add = () => {
		const value = draft.trim();
		if (value && !terms.includes(value)) {
			onChange([...terms, value]);
		}
		setDraft("");
	};

	return (
		<div className="flex flex-col gap-2">
			<Label>Buscas sugeridas</Label>
			<div className="flex flex-wrap gap-2">
				{terms.map((term) => (
					<span
						key={term}
						className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm"
					>
						{term}
						<button
							type="button"
							aria-label={`Remover ${term}`}
							onClick={() => onChange(terms.filter((t) => t !== term))}
							className="text-muted-foreground hover:text-destructive"
						>
							<Trash2 className="size-3" />
						</button>
					</span>
				))}
			</div>
			<div className="flex gap-2">
				<Input
					value={draft}
					placeholder="Adicionar termo"
					onChange={(event) => setDraft(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							// Sem isto o Enter submeteria o formulário inteiro.
							event.preventDefault();
							add();
						}
					}}
					className="sm:w-64"
				/>
				<Button type="button" variant="outline" onClick={add}>
					Adicionar
				</Button>
			</div>
		</div>
	);
}
