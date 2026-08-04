import { ValueObject } from "@portal-app/shared-kernel";

export type SocialLinks = {
	twitter?: string;
	instagram?: string;
	linkedin?: string;
	website?: string;
};

type AuthorProfileProps = {
	bio: string;
	photoUrl: string | null;
	title: string;
	socials: SocialLinks;
};

const SOCIAL_KEYS = ["twitter", "instagram", "linkedin", "website"] as const;

/**
 * Perfil público de autor — bio, foto, cargo e redes. Alimenta a página de
 * autor (E-E-A-T do Google), que é construída na Fase 4; aqui ele é modelado e
 * editável. Objeto de valor: imutável e comparado por conteúdo.
 */
export class AuthorProfile extends ValueObject<AuthorProfileProps> {
	private constructor(props: AuthorProfileProps) {
		super(props);
	}

	static create(input: {
		bio?: string;
		photoUrl?: string | null;
		title?: string;
		socials?: SocialLinks;
	}): AuthorProfile {
		return new AuthorProfile({
			bio: (input.bio ?? "").trim(),
			photoUrl: input.photoUrl?.trim() || null,
			title: (input.title ?? "").trim(),
			socials: normalizeSocials(input.socials ?? {}),
		});
	}

	get bio(): string {
		return this.props.bio;
	}

	get photoUrl(): string | null {
		return this.props.photoUrl;
	}

	get title(): string {
		return this.props.title;
	}

	get socials(): SocialLinks {
		return this.props.socials;
	}
}

function normalizeSocials(socials: SocialLinks): SocialLinks {
	const result: SocialLinks = {};
	for (const key of SOCIAL_KEYS) {
		const value = socials[key]?.trim();
		if (value) {
			result[key] = value;
		}
	}
	return result;
}
