"use client";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@portal-app/ui/components/select";
import { cn } from "@portal-app/ui/lib/utils";
import { type ReactNode, useEffect, useId, useState } from "react";

/**
 * Os campos do inspetor do editor: compactos, com o rótulo DENTRO do campo
 * (como nas ferramentas de design), e que só gravam ao concluir — sair do
 * campo, Enter ou as setas —, para cada ajuste virar UM passo de desfazer.
 */

export function Section({
	title,
	action,
	children,
}: {
	title: string;
	action?: ReactNode;
	children: ReactNode;
}) {
	return (
		<section className="flex flex-col gap-2.5 border-b px-3 py-3 last:border-b-0">
			<div className="flex min-h-5 items-center justify-between gap-2">
				<h3 className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wide">
					{title}
				</h3>
				{action}
			</div>
			{children}
		</section>
	);
}

function formatNumber(value: number, precision: number): string {
	return Number.isFinite(value)
		? String(Number(value.toFixed(precision)))
		: "0";
}

export function NumberField({
	label,
	value,
	onCommit,
	min,
	max,
	step = 1,
	precision = 0,
	suffix,
	disabled,
	title,
}: {
	label: ReactNode;
	value: number;
	onCommit: (value: number) => void;
	min?: number;
	max?: number;
	step?: number;
	precision?: number;
	suffix?: string;
	disabled?: boolean;
	title?: string;
}) {
	const id = useId();
	const [draft, setDraft] = useState(formatNumber(value, precision));
	useEffect(() => {
		setDraft(formatNumber(value, precision));
	}, [value, precision]);

	const clamp = (next: number) =>
		Math.min(
			max ?? Number.POSITIVE_INFINITY,
			Math.max(min ?? Number.NEGATIVE_INFINITY, next),
		);
	const round = (next: number) => Number(next.toFixed(precision));
	const commit = (raw: string) => {
		const parsed = Number.parseFloat(raw.replace(",", "."));
		if (!Number.isFinite(parsed)) {
			setDraft(formatNumber(value, precision));
			return;
		}
		const next = round(clamp(parsed));
		setDraft(formatNumber(next, precision));
		if (next !== value) {
			onCommit(next);
		}
	};

	return (
		<label
			htmlFor={id}
			title={title}
			className={cn(
				"flex h-8 min-w-0 items-center gap-1.5 rounded-md border bg-background px-2 focus-within:ring-2 focus-within:ring-ring/40",
				disabled && "opacity-50",
			)}
		>
			<span className="shrink-0 text-[11px] text-muted-foreground">
				{label}
			</span>
			<input
				id={id}
				inputMode="decimal"
				className="min-w-0 flex-1 bg-transparent text-right text-xs tabular-nums outline-none"
				value={draft}
				disabled={disabled}
				onChange={(event) => setDraft(event.target.value)}
				onBlur={(event) => commit(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						commit(draft);
					} else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
						event.preventDefault();
						const direction = event.key === "ArrowUp" ? 1 : -1;
						const next = round(
							clamp(value + direction * step * (event.shiftKey ? 10 : 1)),
						);
						if (next !== value) {
							onCommit(next);
						}
					}
				}}
			/>
			{suffix ? (
				<span className="shrink-0 text-[11px] text-muted-foreground">
					{suffix}
				</span>
			) : null}
		</label>
	);
}

const HEX = /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Cor em hexadecimal, com opacidade opcional (os dois últimos dígitos). */
export function ColorField({
	label,
	value,
	onCommit,
	alpha = false,
	disabled,
}: {
	label?: string;
	value: string;
	onCommit: (value: string) => void;
	alpha?: boolean;
	disabled?: boolean;
}) {
	const id = useId();
	const [draft, setDraft] = useState(value);
	useEffect(() => {
		setDraft(value);
	}, [value]);
	const opacity =
		value.length === 9
			? Math.round((Number.parseInt(value.slice(7), 16) / 255) * 100)
			: 100;
	const withOpacity = (rgb: string, percent: number) =>
		percent >= 100
			? rgb
			: `${rgb}${Math.round((percent / 100) * 255)
					.toString(16)
					.padStart(2, "0")}`;

	return (
		<div className={cn("flex flex-col gap-1", disabled && "opacity-50")}>
			{label ? (
				<label htmlFor={id} className="text-[11px] text-muted-foreground">
					{label}
				</label>
			) : null}
			<div className="flex items-center gap-1.5">
				<span
					className="relative size-8 shrink-0 overflow-hidden rounded-md border bg-[length:8px_8px] bg-[repeating-conic-gradient(#e5e7eb_0_25%,#fff_0_50%)]"
					style={{
						boxShadow: `inset 0 0 0 40px ${HEX.test(value) ? value : "#000"}`,
					}}
				>
					<input
						type="color"
						aria-label={`${label ?? "Cor"} (seletor)`}
						className="absolute inset-0 size-full cursor-pointer opacity-0"
						value={value.slice(0, 7)}
						disabled={disabled}
						onChange={(event) =>
							onCommit(withOpacity(event.target.value, opacity))
						}
					/>
				</span>
				<input
					id={id}
					className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 font-mono text-xs uppercase outline-none focus:ring-2 focus:ring-ring/40"
					value={draft}
					disabled={disabled}
					onChange={(event) => setDraft(event.target.value.trim())}
					onBlur={() => {
						const next = draft.startsWith("#") ? draft : `#${draft}`;
						if (HEX.test(next)) {
							if (next.toLowerCase() !== value.toLowerCase()) {
								onCommit(next.toLowerCase());
							}
						} else {
							setDraft(value);
						}
					}}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							event.currentTarget.blur();
						}
					}}
				/>
				{alpha ? (
					<div className="w-[4.5rem] shrink-0">
						<NumberField
							label="%"
							value={opacity}
							min={0}
							max={100}
							disabled={disabled}
							title="Opacidade da cor"
							onCommit={(percent) =>
								onCommit(withOpacity(value.slice(0, 7), percent))
							}
						/>
					</div>
				) : null}
			</div>
		</div>
	);
}

/** Um controle deslizante com o número ao lado. Grava a cada movimento. */
export function SliderField({
	label,
	value,
	onChange,
	min,
	max,
	step = 1,
	format = (current) => String(current),
	disabled,
}: {
	label: string;
	value: number;
	onChange: (value: number) => void;
	min: number;
	max: number;
	step?: number;
	format?: (value: number) => string;
	disabled?: boolean;
}) {
	const id = useId();
	return (
		<div className={cn("flex items-center gap-2", disabled && "opacity-50")}>
			<label
				htmlFor={id}
				className="w-20 shrink-0 text-[11px] text-muted-foreground"
			>
				{label}
			</label>
			<input
				id={id}
				type="range"
				className="min-w-0 flex-1 accent-sky-500"
				min={min}
				max={max}
				step={step}
				value={value}
				disabled={disabled}
				onChange={(event) => onChange(Number(event.target.value))}
			/>
			<span className="w-10 shrink-0 text-right text-xs tabular-nums">
				{format(value)}
			</span>
		</div>
	);
}

export type SegmentOption<T extends string> = {
	value: T;
	label: string;
	icon?: ReactNode;
};

/** Botões lado a lado, um ativo — alinhamento, modo, encaixe. */
export function Segmented<T extends string>({
	value,
	options,
	onChange,
	disabled,
	iconOnly = false,
	ariaLabel,
}: {
	value: T;
	options: readonly SegmentOption<T>[];
	onChange: (value: T) => void;
	disabled?: boolean;
	iconOnly?: boolean;
	ariaLabel: string;
}) {
	return (
		<div
			role="radiogroup"
			aria-label={ariaLabel}
			className={cn(
				"flex rounded-md border bg-muted/50 p-0.5",
				disabled && "opacity-50",
			)}
		>
			{options.map((option) => {
				const active = option.value === value;
				return (
					// biome-ignore lint/a11y/useSemanticElements: grupo de botões com o visual de alternância
					<button
						key={option.value}
						type="button"
						role="radio"
						aria-checked={active}
						title={option.label}
						disabled={disabled}
						onClick={() => onChange(option.value)}
						className={cn(
							"flex h-7 flex-1 items-center justify-center gap-1 rounded px-1.5 text-xs transition-colors",
							active
								? "bg-background font-medium text-foreground shadow-sm"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						{option.icon}
						{iconOnly && option.icon ? (
							<span className="sr-only">{option.label}</span>
						) : (
							option.label
						)}
					</button>
				);
			})}
		</div>
	);
}

export function SelectField({
	label,
	value,
	options,
	onChange,
	disabled,
}: {
	label?: string;
	value: string;
	options: readonly { value: string; label: string }[];
	onChange: (value: string) => void;
	disabled?: boolean;
}) {
	return (
		<div className="flex min-w-0 flex-col gap-1">
			{label ? (
				<span className="text-[11px] text-muted-foreground">{label}</span>
			) : null}
			<Select
				items={options}
				value={value}
				disabled={disabled}
				onValueChange={(next) => {
					if (next) {
						onChange(next);
					}
				}}
			>
				<SelectTrigger className="h-8 w-full text-xs">
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
		</div>
	);
}

/** Um interruptor com rótulo. */
export function ToggleField({
	label,
	checked,
	onChange,
	disabled,
}: {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			disabled={disabled}
			onClick={() => onChange(!checked)}
			className={cn(
				"flex items-center justify-between gap-2 text-left text-xs",
				disabled && "cursor-not-allowed opacity-50",
			)}
		>
			<span>{label}</span>
			<span
				className={cn(
					"relative h-4 w-7 shrink-0 rounded-full transition-colors",
					checked ? "bg-sky-500" : "bg-muted-foreground/30",
				)}
			>
				<span
					className={cn(
						"absolute top-0.5 size-3 rounded-full bg-white shadow transition-all",
						checked ? "left-3.5" : "left-0.5",
					)}
				/>
			</span>
		</button>
	);
}
