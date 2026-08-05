import type { Author } from "@/data/types";

/**
 * Cabeçalho da página de autor: foto, nome, cargo, bio e redes. É a peça de
 * E-E-A-T (P10) — dá rosto e credenciais a quem assina, o que o Google usa para
 * aferir autoridade. Autor sem perfil preenchido mostra só nome e cargo padrão.
 */
const SOCIAL_LABELS = {
	twitter: "Twitter",
	instagram: "Instagram",
	linkedin: "LinkedIn",
	website: "Site",
} as const;

export function AuthorProfileCard({ author }: { author: Author }) {
	const socials = Object.entries(author.socials ?? {}).filter(([, href]) =>
		Boolean(href),
	);

	return (
		<div className="-mx-4 mb-4 flex gap-4 bg-brand-navy px-4 py-5 md:mx-0 md:mb-5 md:items-center md:gap-6 md:border-brand-navy md:border-b-[3px] md:bg-transparent md:px-0 md:pt-0 md:pb-5">
			{author.photoUrl ? (
				// A otimização por host (next/image + remotePatterns) entra na Etapa 7;
				// aqui a foto do perfil é servida direta do S3/R2.
				<img
					src={author.photoUrl}
					alt={author.name}
					width={112}
					height={112}
					className="size-[72px] shrink-0 rounded-full object-cover md:size-28"
				/>
			) : (
				<div
					aria-hidden
					className="hatch-light size-[72px] shrink-0 rounded-full md:size-28"
				/>
			)}

			<div className="min-w-0 flex-1">
				<p className="mb-1 font-mono text-[9px] text-on-navy-muted uppercase tracking-[0.16em] md:text-[10px] md:text-meta">
					{author.role}
				</p>

				<h1 className="font-extrabold text-[26px] text-white leading-none tracking-[-0.03em] md:text-[38px] md:text-brand-navy md:tracking-[-0.04em]">
					{author.name}
				</h1>

				{author.bio ? (
					<p className="mt-2 max-w-[70ch] font-serif text-[#b9c8d8] text-[13.5px] leading-relaxed md:mt-3 md:text-base md:text-ink-muted">
						{author.bio}
					</p>
				) : null}

				{socials.length > 0 ? (
					<nav
						aria-label={`Redes de ${author.name}`}
						className="mt-3 flex flex-wrap items-center gap-2"
					>
						{socials.map(([key, href]) => (
							<a
								key={key}
								href={href}
								target="_blank"
								rel="me noopener noreferrer"
								className="font-mono text-[10px] text-on-navy-muted uppercase tracking-[0.12em] underline-offset-2 hover:text-white hover:underline md:text-meta md:hover:text-brand-red"
							>
								{SOCIAL_LABELS[key as keyof typeof SOCIAL_LABELS]}
							</a>
						))}
					</nav>
				) : null}
			</div>
		</div>
	);
}
