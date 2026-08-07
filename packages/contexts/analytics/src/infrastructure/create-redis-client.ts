import { Redis } from "ioredis";

/**
 * Cliente Redis com falha RÁPIDA. Sem isto, o `ioredis` fica tentando
 * reconectar indefinidamente quando o Redis está fora do ar — e como toda
 * leitura do contador passa por `safely()` (degrada para "mais recentes",
 * N03), o que se quer é a promessa rejeitar em segundos, não travar a
 * página esperando uma reconexão que talvez nunca venha.
 */
export function createRedisClient(url: string): Redis {
	return new Redis(url, {
		lazyConnect: true,
		connectTimeout: 2000,
		maxRetriesPerRequest: 1,
		retryStrategy: () => null,
	});
}
