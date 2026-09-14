"use client";

import {
	type ArtDesign,
	type ArtElement,
	type Fill,
	type Shadow,
	type Stroke,
	SYSTEM_VARIABLES,
	TEMPLATE_FONT_FAMILIES,
	TEMPLATE_FONTS,
	TEXT_MODES,
	type TemplateFontFamily,
	type TextElement,
	type TextMode,
	type TextStyle,
} from "@portal-app/social";
import { Button } from "@portal-app/ui/components/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@portal-app/ui/components/popover";
import { useQuery } from "@tanstack/react-query";
import {
	AlignCenter,
	AlignLeft,
	AlignRight,
	AlignVerticalJustifyCenter,
	AlignVerticalJustifyEnd,
	AlignVerticalJustifyStart,
	Braces,
	Eye,
	EyeOff,
	Lock,
	LockOpen,
	Plus,
	Trash2,
} from "lucide-react";
import type { RefObject } from "react";

import { AssetImage } from "@/components/media/asset-image";
import { trpc } from "@/utils/trpc";

import {
	KIND_LABEL,
	MODE_HINT,
	MODE_LABEL,
	WEIGHT_LABEL,
	withFontFamily,
} from "./editor-model";
import {
	ColorField,
	NumberField,
	Section,
	Segmented,
	SelectField,
	SliderField,
	ToggleField,
} from "./fields";
import { KIND_ICON } from "./layers-panel";

export type ElementPatch = (
	id: string,
	change: (element: ArtElement) => ArtElement,
	/** Mudanças seguidas com a mesma chave viram UM passo de desfazer. */
	coalesceKey?: string,
) => void;

/** O inspetor de UM elemento selecionado (spec 10, F4). */
export function ElementInspector({
	element,
	design,
	disabled,
	onPatch,
	onPickImage,
	contentRef,
	onInsertToken,
}: {
	element: ArtElement;
	design: ArtDesign;
	disabled: boolean;
	onPatch: ElementPatch;
	onPickImage: (id: string) => void;
	contentRef: RefObject<HTMLTextAreaElement | null>;
	onInsertToken: (key: string) => void;
}) {
	const patch = (change: (current: ArtElement) => ArtElement, key?: string) =>
		onPatch(element.id, change, key ? `${element.id}:${key}` : undefined);
	const Icon = KIND_ICON[element.kind];

	return (
		<div className="flex flex-col">
			<Section title="Camada">
				<div className="flex items-center gap-2">
					<Icon className="size-4 shrink-0 text-muted-foreground" />
					<input
						aria-label="Nome da camada"
						className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring/40"
						placeholder={KIND_LABEL[element.kind]}
						value={element.name}
						disabled={disabled}
						onChange={(event) =>
							patch(
								(current) => ({
									...current,
									name: event.target.value.slice(0, 60),
								}),
								"name",
							)
						}
					/>
					<Button
						variant="ghost"
						size="icon"
						className="size-8"
						aria-label={element.visible ? "Ocultar" : "Mostrar"}
						title={element.visible ? "Ocultar" : "Mostrar"}
						disabled={disabled}
						onClick={() =>
							patch((current) => ({ ...current, visible: !current.visible }))
						}
					>
						{element.visible ? (
							<Eye className="size-4" />
						) : (
							<EyeOff className="size-4" />
						)}
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="size-8"
						aria-label={element.locked ? "Destravar" : "Travar"}
						title={element.locked ? "Destravar" : "Travar"}
						disabled={disabled}
						onClick={() =>
							patch((current) => ({ ...current, locked: !current.locked }))
						}
					>
						{element.locked ? (
							<Lock className="size-4" />
						) : (
							<LockOpen className="size-4" />
						)}
					</Button>
				</div>
			</Section>

			<Section title="Posição e tamanho">
				<div className="grid grid-cols-2 gap-1.5">
					<NumberField
						label="X"
						value={element.x}
						disabled={disabled}
						onCommit={(x) => patch((current) => ({ ...current, x }))}
					/>
					<NumberField
						label="Y"
						value={element.y}
						disabled={disabled}
						onCommit={(y) => patch((current) => ({ ...current, y }))}
					/>
					<NumberField
						label="L"
						title="Largura"
						value={element.width}
						min={1}
						disabled={disabled}
						onCommit={(width) => patch((current) => ({ ...current, width }))}
					/>
					<NumberField
						label="A"
						title="Altura"
						value={element.height}
						min={1}
						disabled={disabled}
						onCommit={(height) => patch((current) => ({ ...current, height }))}
					/>
					<NumberField
						label="Giro"
						value={element.rotation}
						min={-180}
						max={180}
						precision={1}
						suffix="°"
						disabled={disabled}
						onCommit={(rotation) =>
							patch((current) => ({ ...current, rotation }))
						}
					/>
				</div>
				<SliderField
					label="Opacidade"
					value={Math.round(element.opacity * 100)}
					min={0}
					max={100}
					format={(value) => `${value}%`}
					disabled={disabled}
					onChange={(percent) =>
						patch(
							(current) => ({ ...current, opacity: percent / 100 }),
							"opacity",
						)
					}
				/>
			</Section>

			{element.kind === "TEXT" ? (
				<TextInspector
					element={element}
					design={design}
					disabled={disabled}
					patch={patch}
					contentRef={contentRef}
					onInsertToken={onInsertToken}
				/>
			) : null}

			{element.kind === "RECT" || element.kind === "ELLIPSE" ? (
				<>
					<Section title="Preenchimento">
						<FillEditor
							fill={element.fill}
							disabled={disabled}
							onChange={(fill, key) =>
								patch(
									(current) =>
										current.kind === "RECT" || current.kind === "ELLIPSE"
											? { ...current, fill }
											: current,
									key,
								)
							}
						/>
						{element.kind === "RECT" ? (
							<NumberField
								label="Cantos"
								value={element.cornerRadius}
								min={0}
								disabled={disabled}
								onCommit={(cornerRadius) =>
									patch((current) =>
										current.kind === "RECT"
											? { ...current, cornerRadius }
											: current,
									)
								}
							/>
						) : null}
					</Section>
					<StrokeSection
						stroke={element.stroke}
						disabled={disabled}
						onChange={(stroke, key) =>
							patch(
								(current) =>
									current.kind === "RECT" || current.kind === "ELLIPSE"
										? { ...current, stroke }
										: current,
								key,
							)
						}
					/>
					<ShadowSection
						shadow={element.shadow}
						disabled={disabled}
						onChange={(shadow, key) =>
							patch(
								(current) =>
									current.kind === "RECT" || current.kind === "ELLIPSE"
										? { ...current, shadow }
										: current,
								key,
							)
						}
					/>
				</>
			) : null}

			{element.kind === "LINE" ? (
				<Section title="Traço">
					<ColorField
						value={element.stroke.color}
						alpha
						disabled={disabled}
						onCommit={(color) =>
							patch(
								(current) =>
									current.kind === "LINE"
										? { ...current, stroke: { ...current.stroke, color } }
										: current,
								"stroke-color",
							)
						}
					/>
					<NumberField
						label="Espessura"
						value={element.stroke.width}
						min={1}
						max={200}
						disabled={disabled}
						onCommit={(width) =>
							patch((current) =>
								current.kind === "LINE"
									? { ...current, stroke: { ...current.stroke, width } }
									: current,
							)
						}
					/>
				</Section>
			) : null}

			{element.kind === "IMAGE" ? (
				<Section title="Imagem">
					<ImageThumb mediaId={element.mediaId} />
					<Button
						variant="outline"
						size="sm"
						disabled={disabled}
						onClick={() => onPickImage(element.id)}
					>
						Trocar imagem
					</Button>
					<Segmented
						ariaLabel="Encaixe da imagem"
						value={element.fit}
						disabled={disabled}
						options={[
							{ value: "stretch", label: "Esticar" },
							{ value: "cover", label: "Preencher" },
							{ value: "contain", label: "Caber" },
						]}
						onChange={(fit) =>
							patch((current) =>
								current.kind === "IMAGE" ? { ...current, fit } : current,
							)
						}
					/>
					<NumberField
						label="Cantos"
						value={element.cornerRadius}
						min={0}
						disabled={disabled}
						onCommit={(cornerRadius) =>
							patch((current) =>
								current.kind === "IMAGE"
									? { ...current, cornerRadius }
									: current,
							)
						}
					/>
					<p className="text-muted-foreground text-xs">
						Para molduras, use PNG com transparência e deixe em "Esticar" do
						tamanho do quadro: o transparente mostra a foto por baixo.
					</p>
				</Section>
			) : null}

			{element.kind === "PHOTO" ? (
				<>
					<Section title="Foto da matéria">
						<p className="text-muted-foreground text-xs">
							Aqui entra a capa de cada post, enquadrada pelo ponto focal da
							foto. Teste com uma foto de exemplo nas configurações do padrão.
						</p>
						<NumberField
							label="Cantos"
							value={element.cornerRadius}
							min={0}
							disabled={disabled}
							onCommit={(cornerRadius) =>
								patch((current) =>
									current.kind === "PHOTO"
										? { ...current, cornerRadius }
										: current,
								)
							}
						/>
					</Section>
					<StrokeSection
						stroke={element.stroke}
						disabled={disabled}
						onChange={(stroke, key) =>
							patch(
								(current) =>
									current.kind === "PHOTO" ? { ...current, stroke } : current,
								key,
							)
						}
					/>
				</>
			) : null}
		</div>
	);
}

// ── texto ──────────────────────────────────────────────────────────────────

function TextInspector({
	element,
	design,
	disabled,
	patch,
	contentRef,
	onInsertToken,
}: {
	element: TextElement;
	design: ArtDesign;
	disabled: boolean;
	patch: (change: (current: ArtElement) => ArtElement, key?: string) => void;
	contentRef: RefObject<HTMLTextAreaElement | null>;
	onInsertToken: (key: string) => void;
}) {
	const { style } = element;
	const font = TEMPLATE_FONTS[style.fontFamily];
	const patchText = (
		change: (current: TextElement) => TextElement,
		key?: string,
	) =>
		patch(
			(current) => (current.kind === "TEXT" ? change(current) : current),
			key,
		);
	const patchStyle = (
		change: (current: TextStyle) => TextStyle,
		key?: string,
	) =>
		patchText((current) => ({ ...current, style: change(current.style) }), key);

	return (
		<>
			<Section
				title="Conteúdo"
				action={
					element.mode !== "STATIC" ? (
						<InsertVariable
							design={design}
							disabled={disabled}
							onInsert={onInsertToken}
						/>
					) : null
				}
			>
				<Segmented<TextMode>
					ariaLabel="Modo do texto"
					value={element.mode}
					disabled={disabled}
					options={TEXT_MODES.map((mode) => ({
						value: mode,
						label: MODE_LABEL[mode].split(" ")[0] ?? MODE_LABEL[mode],
					}))}
					onChange={(mode) =>
						patchText((current) => ({
							...current,
							mode,
							fieldLabel:
								mode === "EDITABLE" && current.fieldLabel.trim() === ""
									? current.name.trim() || "Texto da arte"
									: current.fieldLabel,
						}))
					}
				/>
				<p className="text-muted-foreground text-xs">
					{MODE_HINT[element.mode]}
				</p>
				<textarea
					ref={contentRef}
					aria-label="Texto da caixa"
					rows={3}
					className="w-full resize-y rounded-md border bg-background px-2 py-1.5 font-mono text-xs outline-none focus:ring-2 focus:ring-ring/40"
					value={element.content}
					disabled={disabled}
					placeholder={
						element.mode === "STATIC"
							? "MATÉRIA COMPLETA NOS STORIES"
							: "{{titulo}}"
					}
					onChange={(event) =>
						patchText(
							(current) => ({ ...current, content: event.target.value }),
							"content",
						)
					}
				/>
				{element.mode === "EDITABLE" ? (
					<div className="flex flex-col gap-1">
						<span className="text-[11px] text-muted-foreground">
							Nome do campo no post
						</span>
						<input
							aria-label="Nome do campo no post"
							className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring/40"
							value={element.fieldLabel}
							disabled={disabled}
							onChange={(event) =>
								patchText(
									(current) => ({
										...current,
										fieldLabel: event.target.value.slice(0, 40),
									}),
									"fieldLabel",
								)
							}
						/>
					</div>
				) : null}
			</Section>

			<Section title="Tipografia">
				<SelectField
					value={style.fontFamily}
					disabled={disabled}
					options={TEMPLATE_FONT_FAMILIES.map((family) => ({
						value: family,
						label: family,
					}))}
					onChange={(family) =>
						patchStyle((current) =>
							withFontFamily(current, family as TemplateFontFamily),
						)
					}
				/>
				<div className="grid grid-cols-[1fr_auto] gap-1.5">
					<SelectField
						value={String(style.fontWeight)}
						disabled={disabled}
						options={font.weights.map((weight) => ({
							value: String(weight),
							label: `${WEIGHT_LABEL[weight] ?? weight} · ${weight}`,
						}))}
						onChange={(weight) =>
							patchStyle((current) => ({
								...current,
								fontWeight: Number(weight),
							}))
						}
					/>
					<div className="flex gap-1">
						<StyleToggle
							label="Itálico"
							active={style.italic}
							disabled={disabled || !font.italic}
							onClick={() =>
								patchStyle((current) => ({
									...current,
									italic: !current.italic,
								}))
							}
						>
							<span className="font-serif italic">I</span>
						</StyleToggle>
						<StyleToggle
							label="Caixa-alta"
							active={style.uppercase}
							disabled={disabled}
							onClick={() =>
								patchStyle((current) => ({
									...current,
									uppercase: !current.uppercase,
								}))
							}
						>
							<span className="font-semibold text-[10px]">AA</span>
						</StyleToggle>
					</div>
				</div>
				<div className="grid grid-cols-2 gap-1.5">
					<NumberField
						label="Tamanho"
						value={style.fontSize}
						min={8}
						max={400}
						disabled={disabled}
						onCommit={(fontSize) =>
							patchStyle((current) => ({
								...current,
								fontSize,
								minFontSize: Math.min(current.minFontSize, fontSize),
							}))
						}
					/>
					<NumberField
						label="Mínimo"
						title="O texto encolhe até este tamanho para caber"
						value={style.minFontSize}
						min={8}
						max={style.fontSize}
						disabled={disabled}
						onCommit={(minFontSize) =>
							patchStyle((current) => ({ ...current, minFontSize }))
						}
					/>
					<NumberField
						label="Linhas"
						title="Máximo de linhas"
						value={style.maxLines}
						min={1}
						max={12}
						disabled={disabled}
						onCommit={(maxLines) =>
							patchStyle((current) => ({ ...current, maxLines }))
						}
					/>
					<NumberField
						label="Entrelinha"
						value={style.lineHeight}
						min={0.6}
						max={3}
						step={0.05}
						precision={2}
						disabled={disabled}
						onCommit={(lineHeight) =>
							patchStyle((current) => ({ ...current, lineHeight }))
						}
					/>
					<NumberField
						label="Letras"
						title="Espaço entre letras"
						value={style.letterSpacing}
						min={-20}
						max={100}
						step={0.5}
						precision={1}
						disabled={disabled}
						onCommit={(letterSpacing) =>
							patchStyle((current) => ({ ...current, letterSpacing }))
						}
					/>
				</div>
				<ColorField
					label="Cor"
					value={style.color}
					alpha
					disabled={disabled}
					onCommit={(color) =>
						patchStyle((current) => ({ ...current, color }), "text-color")
					}
				/>
				<div className="grid grid-cols-2 gap-1.5">
					<Segmented<TextStyle["align"]>
						ariaLabel="Alinhamento horizontal"
						iconOnly
						value={style.align}
						disabled={disabled}
						options={[
							{
								value: "left",
								label: "À esquerda",
								icon: <AlignLeft className="size-3.5" />,
							},
							{
								value: "center",
								label: "Ao centro",
								icon: <AlignCenter className="size-3.5" />,
							},
							{
								value: "right",
								label: "À direita",
								icon: <AlignRight className="size-3.5" />,
							},
						]}
						onChange={(align) =>
							patchStyle((current) => ({ ...current, align }))
						}
					/>
					<Segmented<TextStyle["verticalAlign"]>
						ariaLabel="Alinhamento vertical"
						iconOnly
						value={style.verticalAlign}
						disabled={disabled}
						options={[
							{
								value: "top",
								label: "Em cima",
								icon: <AlignVerticalJustifyStart className="size-3.5" />,
							},
							{
								value: "middle",
								label: "No meio",
								icon: <AlignVerticalJustifyCenter className="size-3.5" />,
							},
							{
								value: "bottom",
								label: "Embaixo",
								icon: <AlignVerticalJustifyEnd className="size-3.5" />,
							},
						]}
						onChange={(verticalAlign) =>
							patchStyle((current) => ({ ...current, verticalAlign }))
						}
					/>
				</div>
				<p className="text-muted-foreground text-xs">
					Texto longo encolhe do tamanho até o mínimo. Se nem assim couber, sai
					cortado com reticências — e o editor avisa.
				</p>
			</Section>

			<Section title="Fundo do texto">
				<Segmented<"none" | "hug" | "box">
					ariaLabel="Fundo do texto"
					value={style.background?.shape ?? "none"}
					disabled={disabled}
					options={[
						{ value: "none", label: "Nenhum" },
						{ value: "hug", label: "Pílula" },
						{ value: "box", label: "Caixa" },
					]}
					onChange={(shape) =>
						patchStyle((current) => ({
							...current,
							background:
								shape === "none"
									? null
									: {
											color: current.background?.color ?? "#ffffff",
											radius: current.background?.radius ?? 999,
											paddingX: current.background?.paddingX ?? 24,
											paddingY: current.background?.paddingY ?? 10,
											shape,
										},
						}))
					}
				/>
				{style.background ? (
					<>
						<ColorField
							value={style.background.color}
							alpha
							disabled={disabled}
							onCommit={(color) =>
								patchStyle(
									(current) =>
										current.background
											? {
													...current,
													background: { ...current.background, color },
												}
											: current,
									"background-color",
								)
							}
						/>
						<div className="grid grid-cols-3 gap-1.5">
							{(
								[
									["radius", "Cantos"],
									["paddingX", "Lados"],
									["paddingY", "Alto"],
								] as const
							).map(([field, label]) => (
								<NumberField
									key={field}
									label={label}
									value={style.background?.[field] ?? 0}
									min={0}
									disabled={disabled}
									onCommit={(value) =>
										patchStyle((current) =>
											current.background
												? {
														...current,
														background: {
															...current.background,
															[field]: value,
														},
													}
												: current,
										)
									}
								/>
							))}
						</div>
					</>
				) : null}
			</Section>

			<StrokeSection
				title="Contorno das letras"
				stroke={style.stroke}
				disabled={disabled}
				onChange={(stroke, key) =>
					patchStyle((current) => ({ ...current, stroke }), key)
				}
			/>
			<ShadowSection
				shadow={style.shadow}
				disabled={disabled}
				onChange={(shadow, key) =>
					patchStyle((current) => ({ ...current, shadow }), key)
				}
			/>
		</>
	);
}

function InsertVariable({
	design,
	disabled,
	onInsert,
}: {
	design: ArtDesign;
	disabled: boolean;
	onInsert: (key: string) => void;
}) {
	const options = [
		...SYSTEM_VARIABLES.map((variable) => ({
			key: variable.key,
			label: variable.label,
			group: "Da matéria",
		})),
		...design.variables.map((variable) => ({
			key: variable.key,
			label: variable.label,
			group: "Do padrão",
		})),
	];
	return (
		<Popover>
			<PopoverTrigger
				render={
					<Button
						variant="outline"
						size="sm"
						className="h-6 gap-1 px-2 text-xs"
						disabled={disabled}
					/>
				}
			>
				<Braces className="size-3.5" />
				Variável
			</PopoverTrigger>
			<PopoverContent className="w-64 p-1">
				{["Da matéria", "Do padrão"].map((group) => {
					const items = options.filter((option) => option.group === group);
					return items.length > 0 ? (
						<div key={group} className="py-1">
							<p className="px-2 pb-1 font-semibold text-[10px] text-muted-foreground uppercase">
								{group}
							</p>
							{items.map((option) => (
								<button
									key={option.key}
									type="button"
									className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
									onClick={() => onInsert(option.key)}
								>
									<span className="truncate">{option.label}</span>
									<code className="font-mono text-[10px] text-muted-foreground">
										{`{{${option.key}}}`}
									</code>
								</button>
							))}
						</div>
					) : null;
				})}
			</PopoverContent>
		</Popover>
	);
}

function StyleToggle({
	label,
	active,
	disabled,
	onClick,
	children,
}: {
	label: string;
	active: boolean;
	disabled: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			aria-pressed={active}
			title={label}
			disabled={disabled}
			onClick={onClick}
			className={`flex size-8 items-center justify-center rounded-md border text-xs ${active ? "border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300" : "bg-background"} ${disabled ? "opacity-40" : ""}`}
		>
			{children}
		</button>
	);
}

// ── preenchimento, contorno e sombra ───────────────────────────────────────

function FillEditor({
	fill,
	disabled,
	onChange,
}: {
	fill: Fill;
	disabled: boolean;
	onChange: (fill: Fill, key?: string) => void;
}) {
	return (
		<div className="flex flex-col gap-2">
			<Segmented<Fill["type"]>
				ariaLabel="Tipo de preenchimento"
				value={fill.type}
				disabled={disabled}
				options={[
					{ value: "solid", label: "Cor sólida" },
					{ value: "linear", label: "Degradê" },
				]}
				onChange={(type) =>
					onChange(
						type === "solid"
							? {
									type,
									color:
										fill.type === "linear"
											? (fill.stops.at(-1)?.color ?? "#000000")
											: fill.color,
								}
							: {
									type,
									angle: 90,
									stops: [
										{ offset: 0, color: "#00000000" },
										{
											offset: 1,
											color: fill.type === "solid" ? fill.color : "#000000",
										},
									],
								},
					)
				}
			/>
			{fill.type === "solid" ? (
				<ColorField
					value={fill.color}
					alpha
					disabled={disabled}
					onCommit={(color) => onChange({ type: "solid", color }, "fill-color")}
				/>
			) : (
				<>
					<div
						aria-hidden
						className="h-6 rounded border bg-[length:8px_8px] bg-[repeating-conic-gradient(#e5e7eb_0_25%,#fff_0_50%)]"
						style={{
							backgroundImage: `linear-gradient(${fill.angle + 90}deg, ${fill.stops
								.map((stop) => `${stop.color} ${stop.offset * 100}%`)
								.join(
									", ",
								)}), repeating-conic-gradient(#e5e7eb 0 25%, #fff 0 50%)`,
							backgroundSize: "auto, 8px 8px",
						}}
					/>
					<div className="grid grid-cols-2 gap-1.5">
						<NumberField
							label="Ângulo"
							value={fill.angle}
							min={-360}
							max={360}
							suffix="°"
							disabled={disabled}
							onCommit={(angle) => onChange({ ...fill, angle })}
						/>
						<Button
							variant="outline"
							size="sm"
							className="h-8 text-xs"
							disabled={disabled}
							onClick={() =>
								onChange({
									...fill,
									stops: [...fill.stops]
										.reverse()
										.map((stop) => ({ ...stop, offset: 1 - stop.offset })),
								})
							}
						>
							Inverter
						</Button>
					</div>
					{fill.stops.map((stop, index) => (
						<div
							// A posição é a identidade da parada: reordenar não existe.
							key={index}
							className="grid grid-cols-[1fr_4.5rem_auto] items-end gap-1.5"
						>
							<ColorField
								value={stop.color}
								alpha
								disabled={disabled}
								onCommit={(color) =>
									onChange(
										{
											...fill,
											stops: fill.stops.map((item, position) =>
												position === index ? { ...item, color } : item,
											),
										},
										`stop-${index}`,
									)
								}
							/>
							<NumberField
								label="@"
								value={Math.round(stop.offset * 100)}
								min={0}
								max={100}
								suffix="%"
								disabled={disabled}
								onCommit={(percent) =>
									onChange({
										...fill,
										stops: fill.stops
											.map((item, position) =>
												position === index
													? { ...item, offset: percent / 100 }
													: item,
											)
											.sort((a, b) => a.offset - b.offset),
									})
								}
							/>
							<Button
								variant="ghost"
								size="icon"
								className="size-8"
								aria-label="Remover cor"
								disabled={disabled || fill.stops.length <= 2}
								onClick={() =>
									onChange({
										...fill,
										stops: fill.stops.filter(
											(_, position) => position !== index,
										),
									})
								}
							>
								<Trash2 className="size-3.5" />
							</Button>
						</div>
					))}
					<Button
						variant="ghost"
						size="sm"
						className="h-7 self-start text-xs"
						disabled={disabled || fill.stops.length >= 5}
						onClick={() =>
							onChange({
								...fill,
								stops: [...fill.stops, { offset: 1, color: "#ffffff" }],
							})
						}
					>
						<Plus className="size-3.5" />
						Cor
					</Button>
				</>
			)}
		</div>
	);
}

function StrokeSection({
	title = "Contorno",
	stroke,
	disabled,
	onChange,
}: {
	title?: string;
	stroke: Stroke | null;
	disabled: boolean;
	onChange: (stroke: Stroke | null, key?: string) => void;
}) {
	return (
		<Section
			title={title}
			action={
				<ToggleField
					label=""
					checked={stroke !== null}
					disabled={disabled}
					onChange={(on) =>
						onChange(on ? { color: "#000000", width: 4 } : null)
					}
				/>
			}
		>
			{stroke ? (
				<div className="grid grid-cols-[1fr_6rem] items-end gap-1.5">
					<ColorField
						value={stroke.color}
						alpha
						disabled={disabled}
						onCommit={(color) => onChange({ ...stroke, color }, "stroke-color")}
					/>
					<NumberField
						label="Esp."
						value={stroke.width}
						min={0}
						max={200}
						disabled={disabled}
						onCommit={(width) => onChange({ ...stroke, width })}
					/>
				</div>
			) : null}
		</Section>
	);
}

function ShadowSection({
	shadow,
	disabled,
	onChange,
}: {
	shadow: Shadow | null;
	disabled: boolean;
	onChange: (shadow: Shadow | null, key?: string) => void;
}) {
	return (
		<Section
			title="Sombra"
			action={
				<ToggleField
					label=""
					checked={shadow !== null}
					disabled={disabled}
					onChange={(on) =>
						onChange(
							on
								? {
										color: "#000000",
										blur: 16,
										offsetX: 0,
										offsetY: 6,
										opacity: 0.4,
									}
								: null,
						)
					}
				/>
			}
		>
			{shadow ? (
				<>
					<ColorField
						value={shadow.color}
						disabled={disabled}
						onCommit={(color) => onChange({ ...shadow, color }, "shadow-color")}
					/>
					<div className="grid grid-cols-3 gap-1.5">
						<NumberField
							label="Desf."
							value={shadow.blur}
							min={0}
							max={200}
							disabled={disabled}
							onCommit={(blur) => onChange({ ...shadow, blur })}
						/>
						<NumberField
							label="X"
							value={shadow.offsetX}
							disabled={disabled}
							onCommit={(offsetX) => onChange({ ...shadow, offsetX })}
						/>
						<NumberField
							label="Y"
							value={shadow.offsetY}
							disabled={disabled}
							onCommit={(offsetY) => onChange({ ...shadow, offsetY })}
						/>
					</div>
					<SliderField
						label="Intensidade"
						value={Math.round(shadow.opacity * 100)}
						min={0}
						max={100}
						format={(value) => `${value}%`}
						disabled={disabled}
						onChange={(percent) =>
							onChange({ ...shadow, opacity: percent / 100 }, "shadow-opacity")
						}
					/>
				</>
			) : null}
		</Section>
	);
}

function ImageThumb({ mediaId }: { mediaId: string }) {
	const asset = useQuery({
		...trpc.media.get.queryOptions({ id: mediaId }),
		enabled: mediaId !== "",
	});
	return (
		<div className="flex h-24 items-center justify-center overflow-hidden rounded-md border bg-[length:12px_12px] bg-[repeating-conic-gradient(#e5e7eb_0_25%,#fff_0_50%)]">
			{asset.data ? (
				<AssetImage
					src={asset.data.url}
					alt={asset.data.altText ?? ""}
					className="max-h-full object-contain"
				/>
			) : (
				<span className="text-muted-foreground text-xs">Sem imagem</span>
			)}
		</div>
	);
}
