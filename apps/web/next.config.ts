import "@portal-app/env/web";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	typedRoutes: true,
	reactCompiler: true,
	/*
	 * O desenhista dos padrões de arte (spec 10, D1) roda no servidor com o
	 * Konva sobre o skia-canvas, um binário nativo. Empacotado, o skia perde o
	 * caminho do próprio `.node`; e o Konva precisa ser UMA instância só, a
	 * mesma que o backend do skia configura — carregados do `node_modules`, os
	 * dois funcionam como no teste.
	 */
	/*
	 * O `ffmpeg-static` exporta o CAMINHO de um binário, não código. Empacotado,
	 * o caminho passa a apontar para dentro do bundle, onde o executável não
	 * está — e a montagem do vídeo (spec 12) morre com "ENOENT" em produção.
	 */
	serverExternalPackages: ["skia-canvas", "konva", "ffmpeg-static"],
	/*
	 * As fontes dos padrões são achadas no disco em tempo de execução
	 * (`findInNodeModules`), e o rastreador de arquivos do build não enxerga
	 * isso — sem esta lista, o deploy sairia sem os `.woff` e toda arte com
	 * texto quebraria em produção.
	 */
	/*
	 * O `sharp` carrega a `libvips` por um `.so` que o rastreador não segue: sem
	 * as pastas do Linux abaixo, o deploy saiu sem `libvips-cpp.so` e todo o
	 * servidor respondeu 500. A versão do `sharp` é a MESMA do Next (0.34), para
	 * haver uma instalação só no `node_modules`.
	 */
	outputFileTracingIncludes: {
		"/*": [
			"./node_modules/@fontsource/*/files/*-latin-*.woff",
			"../../node_modules/.pnpm/@img+sharp-linux-x64@*/node_modules/@img/sharp-linux-x64/**",
			"../../node_modules/.pnpm/@img+sharp-libvips-linux-x64@*/node_modules/@img/sharp-libvips-linux-x64/**",
			/*
			 * O binário do ffmpeg, pelo mesmo motivo das fontes: quem o resolve é
			 * o `ffmpeg-static` em tempo de execução, e o rastreador não segue um
			 * caminho que só existe depois do `require`.
			 */
			"../../node_modules/.pnpm/ffmpeg-static@*/node_modules/ffmpeg-static/ffmpeg",
		],
	},
};

export default nextConfig;
