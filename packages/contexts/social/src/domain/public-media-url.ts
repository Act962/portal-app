/**
 * A Meta consegue baixar esta imagem?
 *
 * A Meta não recebe arquivo: ela BAIXA a imagem da URL informada (spec 08,
 * §6.5). Uma URL de rede interna — o MinIO de desenvolvimento em
 * `localhost:9000`, um IP de rede local — é recusada lá do outro lado com um
 * erro genérico de download, depois de a chamada ter saído e consumido
 * tentativa.
 *
 * Esta função responde antes, em português e sem rede: é uma checagem de
 * FORMATO do endereço, não de alcance. Um domínio público que esteja fora do ar
 * passa por aqui e falha na Meta — o que é certo, porque essa falha é
 * passageira e esta não é.
 *
 * Devolve o motivo, ou `null` quando o endereço é público.
 */
export function mediaUrlProblem(url: string): string | null {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return "o endereço da imagem não é válido";
	}
	if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
		return "o endereço da imagem não é válido";
	}
	const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
	if (isInternalHost(host)) {
		return `a imagem está em um endereço interno (${host}), que a Meta não consegue acessar pela internet`;
	}
	return null;
}

function isInternalHost(host: string): boolean {
	if (
		host === "localhost" ||
		host.endsWith(".localhost") ||
		host.endsWith(".local") ||
		host.endsWith(".internal") ||
		host === "::1" ||
		host === "0.0.0.0"
	) {
		return true;
	}

	const octets = host.split(".");
	if (
		octets.length !== 4 ||
		!octets.every((octet) => /^\d{1,3}$/.test(octet))
	) {
		return false;
	}
	const a = Number(octets[0]);
	const b = Number(octets[1]);
	return (
		a === 127 ||
		a === 10 ||
		a === 0 ||
		(a === 192 && b === 168) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 169 && b === 254)
	);
}
