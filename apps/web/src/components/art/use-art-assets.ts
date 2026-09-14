"use client";

import type { LoadedImage, SceneAssets } from "@portal-app/art-scene";
import { type ArtDesign, mediaIdsOf, photoElementOf } from "@portal-app/social";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { trpc } from "@/utils/trpc";

const CENTER = { x: 0.5, y: 0.5 };

/** Uma imagem por endereço, baixada uma vez por sessão. */
const cache = new Map<string, Promise<HTMLImageElement>>();

function loadImage(url: string): Promise<HTMLImageElement> {
	let pending = cache.get(url);
	if (!pending) {
		pending = new Promise((resolve, reject) => {
			const image = new Image();
			image.decoding = "async";
			image.onload = () => resolve(image);
			image.onerror = () => {
				cache.delete(url);
				reject(new Error(`Não foi possível carregar ${url}`));
			};
			image.src = url;
		});
		cache.set(url, pending);
	}
	return pending;
}

/**
 * A foto e as molduras do desenho, carregadas para o canvas — com o ponto focal
 * da foto, que o servidor também usa para enquadrar.
 *
 * Sem `crossOrigin`: o editor só mostra, não exporta o canvas. Pedir CORS a um
 * armazenamento que não o configura faria a imagem simplesmente não carregar.
 */
export function useArtAssets(
	design: ArtDesign,
	photoMediaId: string | null,
): { assets: SceneAssets; loading: boolean } {
	const wantsPhoto = photoElementOf(design) !== null && photoMediaId !== null;
	const ids = [
		...new Set([
			...(wantsPhoto && photoMediaId ? [photoMediaId] : []),
			...mediaIdsOf(design).filter((id) => id !== ""),
		]),
	].sort();

	const library = useQuery({
		...trpc.media.library.queryOptions({ ids, perPage: 100 }),
		enabled: ids.length > 0,
	});

	const [images, setImages] = useState<Record<string, LoadedImage>>({});

	useEffect(() => {
		let active = true;
		for (const item of library.data?.items ?? []) {
			loadImage(item.url)
				.then((image) => {
					if (active) {
						setImages((current) =>
							current[item.id]?.image === image
								? current
								: {
										...current,
										[item.id]: {
											image,
											width: image.naturalWidth,
											height: image.naturalHeight,
										},
									},
						);
					}
				})
				.catch(() => {
					// Imagem que não carrega fica de fora: o editor mostra a caixa
					// tracejada, e o servidor, sem ela, a pula do mesmo jeito.
				});
		}
		return () => {
			active = false;
		};
	}, [library.data]);

	const idsKey = ids.join(",");
	// biome-ignore lint/correctness/useExhaustiveDependencies: a chave dos ids resume a lista
	const assets = useMemo<SceneAssets>(() => {
		const photoItem = library.data?.items.find(
			(item) => item.id === photoMediaId,
		);
		const photo = wantsPhoto && photoMediaId ? images[photoMediaId] : undefined;
		return {
			photo: photo
				? { ...photo, focal: photoItem?.focalPoint ?? CENTER }
				: null,
			images: Object.fromEntries(
				mediaIdsOf(design)
					.map((id) => [id, images[id]] as const)
					.filter((entry): entry is readonly [string, LoadedImage] =>
						Boolean(entry[1]),
					),
			),
		};
	}, [images, library.data, photoMediaId, wantsPhoto, idsKey]);

	const loading =
		(ids.length > 0 && library.isPending) ||
		ids.some(
			(id) => !images[id] && library.data?.items.some((i) => i.id === id),
		);
	return { assets, loading };
}
