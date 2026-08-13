import { AuthorAvatar } from "@/components/people/author-avatar";
import { SocialIcon } from "@/components/social/social-icon";
import type { Author } from "@/data/types";
import type { Network } from "@/lib/social-networks";

/**
 * Cabeçalho da página de autor: foto, nome, cargo, bio, redes e contato. É a
 * peça de E-E-A-T (P10) — dá rosto e credenciais a quem assina, o que o Google
 * usa para aferir autoridade. Autor sem perfil preenchido mostra só nome e
 * cargo padrão.
 */
const SOCIAL_LABELS = {
	twitter: "Twitter",
	instagram: "Instagram",
	linkedin: "LinkedIn",
	website: "Site",
} as const;

type SocialKey = keyof typeof SOCIAL_LABELS;

/**
 * As quatro chaves do perfil já SÃO redes conhecidas — aqui não há adivinhação
 * de rótulo como na barra do topo, porque o domínio só aceita estas quatro.
 * `website` vira o globo.
 */
const SOCIAL_NETWORK: Record<SocialKey, Network> = {
	twitter: "twitter",
	instagram: "instagram",
	linkedin: "linkedin",
	website: "website",
};

export function AuthorProfileCard({ author }: { author: Author }) {
	const socials = Object.entries(author.socials ?? {}).filter(
		(entry): entry is [SocialKey, string] =>
			Boolean(entry[1]) && entry[0] in SOCIAL_LABELS,
	);

	return (
		<div className="-mx-4 mb-4 flex gap-4 bg-brand-deep px-4 py-5 md:mx-0 md:mb-5 md:items-center md:gap-6 md:border-brand-deep md:border-b-[3px] md:bg-transparent md:px-0 md:pt-0 md:pb-5">
			<AuthorAvatar
				photoUrl={author.photoUrl}
				name={author.name}
				className="size-[72px] shrink-0 rounded-full md:size-28"
			/>

			<div className="min-w-0 flex-1">
				<p className="mb-1 font-mono text-[9px] text-on-brand-muted uppercase tracking-[0.16em] md:text-[10px] md:text-meta">
					{author.role}
				</p>

				<h1 className="font-extrabold text-[26px] text-white leading-none tracking-[-0.03em] md:text-[38px] md:text-brand-deep md:tracking-[-0.04em]">
					{author.name}
				</h1>

				{author.bio ? (
					<p className="mt-2 max-w-[70ch] font-serif text-[13.5px] text-on-brand-soft leading-relaxed md:mt-3 md:text-base md:text-ink-muted">
						{author.bio}
					</p>
				) : null}

				{socials.length > 0 || author.email ? (
					<nav
						aria-label={`Contato de ${author.name}`}
						className="mt-3 flex flex-wrap items-center gap-3"
					>
						{socials.map(([key, href]) => (
							<a
								key={key}
								href={href}
								target="_blank"
								rel="me noopener noreferrer"
								// Sem o rótulo visível, o nome acessível é o que sobra — e
								// precisa dizer DE QUEM é o perfil, porque "Instagram" solto
								// numa lista de links não identifica destino nenhum.
								aria-label={`${author.name} no ${SOCIAL_LABELS[key]}`}
								className="text-on-brand-muted transition-colors hover:text-white md:text-meta md:hover:text-brand-red"
							>
								<SocialIcon
									network={SOCIAL_NETWORK[key]}
									className="size-[17px]"
								/>
							</a>
						))}

						{/*
						  O e-mail é o único que não vira só ícone: ele é um endereço que
						  o leitor pode querer COPIAR, não apenas clicar — e um envelope
						  mudo não dá como copiar coisa nenhuma.
						*/}
						{author.email ? (
							<a
								href={`mailto:${author.email}`}
								className="flex items-center gap-1.5 text-on-brand-muted transition-colors hover:text-white md:text-meta md:hover:text-brand-red"
							>
								<SocialIcon network="email" className="size-[15px]" />
								<span className="font-mono text-[10px] md:text-[11px]">
									{author.email}
								</span>
							</a>
						) : null}
					</nav>
				) : null}
			</div>
		</div>
	);
}
