"use client";

import {
	type ArtDesign,
	SYSTEM_VARIABLE_KEYS,
	SYSTEM_VARIABLES,
	type TemplateVariable,
	VARIABLE_KEY,
} from "@portal-app/social";
import { Button } from "@portal-app/ui/components/button";
import { cn } from "@portal-app/ui/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

import {
	addVariable,
	removeVariable,
	updateVariable,
	variableUsage,
} from "./editor-model";
import { Section, ToggleField } from "./fields";

/**
 * As variáveis do padrão (spec 10, D2). As da matéria vêm prontas; as do
 * padrão, o designer cria — e cada uma que alguma caixa usar vira um campo que
 * a redação preenche no post.
 */
export function VariablesPanel({
	design,
	canDesign,
	canInsert,
	onInsert,
	onChange,
}: {
	design: ArtDesign;
	canDesign: boolean;
	/** Há uma caixa de texto selecionada para receber o marcador? */
	canInsert: boolean;
	onInsert: (key: string) => void;
	onChange: (next: ArtDesign) => void;
}) {
	return (
		<div className="flex flex-col">
			<Section title="Da matéria">
				<p className="text-muted-foreground text-xs">
					Preenchidas sozinhas em cada post.{" "}
					{canInsert
						? "Clique para inserir no texto selecionado."
						: "Selecione uma caixa de texto para inserir."}
				</p>
				<ul className="flex flex-col gap-1">
					{SYSTEM_VARIABLES.map((variable) => (
						<li key={variable.key}>
							<TokenButton
								label={variable.label}
								tokenKey={variable.key}
								disabled={!canInsert || !canDesign}
								onClick={() => onInsert(variable.key)}
							/>
						</li>
					))}
				</ul>
			</Section>

			<Section
				title="Do padrão"
				action={
					canDesign ? (
						<Button
							variant="ghost"
							size="sm"
							className="h-6 px-2 text-xs"
							onClick={() => onChange(addVariable(design).design)}
						>
							<Plus className="size-3.5" />
							Nova
						</Button>
					) : null
				}
			>
				{design.variables.length === 0 ? (
					<p className="text-muted-foreground text-xs">
						Crie variáveis para os textos que mudam a cada post e não vêm da
						matéria — a chamada do botão, o nome de um evento. A redação
						preenche no post.
					</p>
				) : (
					<ul className="flex flex-col gap-2">
						{design.variables.map((variable) => (
							<li key={variable.key}>
								<VariableCard
									design={design}
									variable={variable}
									canDesign={canDesign}
									canInsert={canInsert}
									onInsert={onInsert}
									onChange={onChange}
								/>
							</li>
						))}
					</ul>
				)}
			</Section>
		</div>
	);
}

function TokenButton({
	label,
	tokenKey,
	disabled,
	onClick,
}: {
	label: string;
	tokenKey: string;
	disabled: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			disabled={disabled}
			onClick={onClick}
			title={disabled ? undefined : `Inserir {{${tokenKey}}}`}
			className={cn(
				"flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left text-xs",
				disabled
					? "cursor-default opacity-70"
					: "hover:border-sky-500/60 hover:bg-sky-500/5",
			)}
		>
			<span className="truncate">{label}</span>
			<code className="shrink-0 rounded bg-muted px-1 font-mono text-[10px]">
				{`{{${tokenKey}}}`}
			</code>
		</button>
	);
}

function VariableCard({
	design,
	variable,
	canDesign,
	canInsert,
	onInsert,
	onChange,
}: {
	design: ArtDesign;
	variable: TemplateVariable;
	canDesign: boolean;
	canInsert: boolean;
	onInsert: (key: string) => void;
	onChange: (next: ArtDesign) => void;
}) {
	const labelId = useId();
	const keyId = useId();
	const valueId = useId();
	const [label, setLabel] = useState(variable.label);
	const [key, setKey] = useState(variable.key);
	const [value, setValue] = useState(variable.defaultValue);
	useEffect(() => {
		setLabel(variable.label);
		setKey(variable.key);
		setValue(variable.defaultValue);
	}, [variable]);
	const usage = variableUsage(design, variable.key);

	const commitKey = () => {
		const next = key.trim();
		if (next === variable.key) {
			return;
		}
		const taken =
			SYSTEM_VARIABLE_KEYS.includes(next) ||
			design.variables.some((item) => item.key === next);
		if (!VARIABLE_KEY.test(next) || taken) {
			toast.error(
				taken
					? `A chave {{${next}}} já existe.`
					: "A chave usa só letras minúsculas, números e _, começando por letra.",
			);
			setKey(variable.key);
			return;
		}
		onChange(updateVariable(design, variable.key, { key: next }));
	};

	const inputClass =
		"h-8 w-full rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring/40";

	return (
		<div className="flex flex-col gap-2 rounded-md border p-2">
			<div className="grid grid-cols-2 gap-1.5">
				<div className="flex flex-col gap-1">
					<label
						htmlFor={labelId}
						className="text-[11px] text-muted-foreground"
					>
						Nome do campo
					</label>
					<input
						id={labelId}
						className={inputClass}
						value={label}
						disabled={!canDesign}
						onChange={(event) => setLabel(event.target.value)}
						onBlur={() =>
							label !== variable.label &&
							onChange(updateVariable(design, variable.key, { label }))
						}
					/>
				</div>
				<div className="flex flex-col gap-1">
					<label htmlFor={keyId} className="text-[11px] text-muted-foreground">
						Chave
					</label>
					<input
						id={keyId}
						className={cn(inputClass, "font-mono")}
						value={key}
						disabled={!canDesign}
						onChange={(event) => setKey(event.target.value)}
						onBlur={commitKey}
					/>
				</div>
			</div>
			<div className="flex flex-col gap-1">
				<label htmlFor={valueId} className="text-[11px] text-muted-foreground">
					Valor padrão
				</label>
				{variable.multiline ? (
					<textarea
						id={valueId}
						rows={2}
						className={cn(inputClass, "h-auto py-1.5")}
						value={value}
						disabled={!canDesign}
						onChange={(event) => setValue(event.target.value)}
						onBlur={() =>
							value !== variable.defaultValue &&
							onChange(
								updateVariable(design, variable.key, { defaultValue: value }),
							)
						}
					/>
				) : (
					<input
						id={valueId}
						className={inputClass}
						value={value}
						disabled={!canDesign}
						onChange={(event) => setValue(event.target.value)}
						onBlur={() =>
							value !== variable.defaultValue &&
							onChange(
								updateVariable(design, variable.key, { defaultValue: value }),
							)
						}
					/>
				)}
			</div>
			<ToggleField
				label="Aceita várias linhas"
				checked={variable.multiline}
				disabled={!canDesign}
				onChange={(multiline) =>
					onChange(updateVariable(design, variable.key, { multiline }))
				}
			/>
			<div className="flex items-center justify-between gap-2">
				<span className="text-[11px] text-muted-foreground">
					{usage === 0
						? "Ainda não usada"
						: `Usada em ${usage} caixa${usage > 1 ? "s" : ""}`}
				</span>
				<div className="flex gap-1">
					<Button
						variant="outline"
						size="sm"
						className="h-6 px-2 text-xs"
						disabled={!canInsert || !canDesign}
						onClick={() => onInsert(variable.key)}
					>
						Inserir
					</Button>
					<Button
						variant="ghost"
						size="sm"
						className="h-6 px-1.5"
						aria-label={`Apagar a variável ${variable.key}`}
						disabled={!canDesign}
						onClick={() => {
							onChange(removeVariable(design, variable.key));
							if (usage > 0) {
								toast.warning(
									`{{${variable.key}}} ainda aparece em ${usage} caixa${usage > 1 ? "s" : ""} — corrija antes de salvar.`,
								);
							}
						}}
					>
						<Trash2 className="size-3.5" />
					</Button>
				</div>
			</div>
		</div>
	);
}
