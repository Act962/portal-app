/**
 * ValueObject — definido pelos seus atributos, sem identidade. Dois VOs são
 * iguais quando todos os atributos são iguais (igualdade estrutural). Imutável
 * por convenção: os `props` são congelados na construção e não há setter.
 */
export abstract class ValueObject<Props extends object> {
	protected readonly props: Props;

	protected constructor(props: Props) {
		this.props = Object.freeze({ ...props });
	}

	equals(other?: ValueObject<Props> | null): boolean {
		if (other === null || other === undefined) {
			return false;
		}
		if (this.constructor !== other.constructor) {
			return false;
		}
		// Igualdade estrutural. Instâncias da mesma classe constroem `props` na
		// mesma ordem de chaves, então a serialização é estável e comparável.
		return JSON.stringify(this.props) === JSON.stringify(other.props);
	}
}
