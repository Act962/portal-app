/**
 * A foto de quem assina, com o espaço reservado quando não há.
 *
 * Existe porque a mesma regra estava escrita em três lugares e um deles estava
 * ERRADO: a assinatura da matéria (`article-header`) tinha o quadro hachurado
 * fixo no HTML, sem condição nenhuma, então nunca mostrava foto — mesmo com o
 * `author.photoUrl` chegando preenchido na prop ao lado. Não dava erro e não
 * dava aviso; só não aparecia.
 *
 * Um `<span>` no lugar do `<div>` porque um dos três usos fica dentro de um
 * `<a>` que só tem elementos inline dentro.
 *
 * A otimização por host (`next/image` + `remotePatterns`) segue pendente; aqui
 * a foto é servida direta do S3/R2, como no resto do portal.
 */
export function AuthorAvatar({
	photoUrl,
	name,
	className,
}: {
	photoUrl?: string | null;
	/** Só entra no `alt` quando há foto — o espaço reservado é decorativo. */
	name: string;
	/** Tamanho e formato ficam com quem chama: são três recortes diferentes. */
	className: string;
}) {
	if (!photoUrl) {
		return <span aria-hidden className={`hatch-light block ${className}`} />;
	}

	return (
		<img src={photoUrl} alt={name} className={`object-cover ${className}`} />
	);
}
