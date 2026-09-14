import "@portal-app/env/web";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	typedRoutes: true,
	reactCompiler: true,
	/*
	 * O desenhista dos padrões de arte (spec 09, F3) roda no servidor com um
	 * binário nativo (resvg) e o WASM de layout do Satori. Empacotados pelo
	 * bundler, os dois perdem o caminho do próprio arquivo; carregados do
	 * `node_modules`, funcionam como no teste.
	 */
	serverExternalPackages: ["@resvg/resvg-js", "satori"],
	/*
	 * As fontes dos padrões são achadas no disco em tempo de execução
	 * (`findInNodeModules`), e o rastreador de arquivos do build não enxerga
	 * isso — sem esta lista, o deploy sairia sem os `.woff` e toda arte com
	 * texto quebraria em produção.
	 */
	outputFileTracingIncludes: {
		"/*": ["./node_modules/@fontsource/*/files/*-latin-*.woff"],
	},
};

export default nextConfig;
