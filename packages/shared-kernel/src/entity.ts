/**
 * Entidade — objeto com identidade própria e ciclo de vida. Duas entidades são
 * "a mesma" quando têm o mesmo tipo e o mesmo id, ainda que seus atributos
 * divirjam ao longo do tempo. Contraste com ValueObject, definido pelos
 * atributos.
 */
export abstract class Entity<Id> {
	readonly id: Id;

	protected constructor(id: Id) {
		this.id = id;
	}

	equals(other?: Entity<Id> | null): boolean {
		if (other === null || other === undefined) {
			return false;
		}
		if (this === other) {
			return true;
		}
		if (this.constructor !== other.constructor) {
			return false;
		}
		return this.id === other.id;
	}
}
