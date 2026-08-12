/**
 * Contato público de um colunista: as redes e o e-mail que saem no perfil.
 *
 * As quatro chaves são as MESMAS do `AuthorProfile` do `identity`, e isso é
 * deliberado: a página `/autor/{slug}` mostra um perfil só, montado ora do
 * StaffMember ora deste registro. Chaves diferentes obrigariam a tela a saber
 * de onde o perfil veio — que é exatamente o acoplamento que a página não tem
 * hoje e não deve ganhar.
 *
 * A duplicação do tipo é o preço de `contextos-isolados` (este pacote não
 * importa `identity`), e é o lado barato da troca: são quatro chaves estáveis,
 * e o teste que as compara vive na raiz de composição, onde os dois se
 * encontram.
 */
export type SocialLinks = {
	twitter?: string;
	instagram?: string;
	linkedin?: string;
	website?: string;
};

const SOCIAL_KEYS = ["twitter", "instagram", "linkedin", "website"] as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Descarta chave vazia em vez de guardar `""`. O portal decide se mostra a
 * seção de redes por `Object.keys(socials).length`, então uma chave presente
 * com valor vazio renderizaria um link para lugar nenhum.
 */
export function normalizeSocials(socials: SocialLinks): SocialLinks {
	const result: SocialLinks = {};
	for (const key of SOCIAL_KEYS) {
		const value = socials[key]?.trim();
		if (value) {
			result[key] = value;
		}
	}
	return result;
}

/** Mesma normalização do convite: minúsculas e aparado. */
export function normalizeEmail(raw: string): string {
	return raw.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
	return EMAIL.test(email);
}
