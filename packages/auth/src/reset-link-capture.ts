import { AsyncLocalStorage } from "node:async_hooks";

type Store = { url?: string };

const storage = new AsyncLocalStorage<Store>();

/**
 * Better-Auth não devolve o link de redefinição na resposta do
 * `requestPasswordReset` (por design: a rota pública nunca revela se o e-mail
 * existe nem vaza o token). Para o fluxo em que o ADMIN mesmo dispara o reset
 * e precisa do link para entregar manualmente (sem Mailer configurado),
 * capturamos a URL de dentro do callback `sendResetPassword` usando
 * `AsyncLocalStorage` — escopado à chamada atual, então duas chamadas
 * concorrentes (dois admins resetando ao mesmo tempo) não se cruzam.
 */
export async function captureResetLink<T>(
	fn: () => Promise<T>,
): Promise<{ result: T; url?: string }> {
	const store: Store = {};
	const result = await storage.run(store, fn);
	return { result, url: store.url };
}

/** Chamado de dentro do `sendResetPassword` do Better-Auth. */
export function recordResetLink(url: string): void {
	const store = storage.getStore();
	if (store) {
		store.url = url;
	}
}
