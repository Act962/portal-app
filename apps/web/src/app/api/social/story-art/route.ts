import { socialDeps } from "@portal-app/api/social";
import { resolveStaff } from "@portal-app/api/staff";
import { can } from "@portal-app/identity";
import { getPost, isSocialDestination } from "@portal-app/social";
import { type NextRequest, NextResponse } from "next/server";

/**
 * A arte pronta de uma entrega manual (spec 11, D6), para quem vai publicar
 * pelo app baixar ou compartilhar.
 *
 * Passa pelo servidor, e não é um link direto para o armazenamento, por dois
 * motivos: só quem tem `social:publish` baixa (D12), e o compartilhar do celular
 * precisa do ARQUIVO — buscá-lo na mesma origem evita depender de CORS no
 * bucket.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
	const { staff } = await resolveStaff(request.headers);
	if (!staff || !can(staff, "social:publish")) {
		return new NextResponse("Sem permissão.", { status: 403 });
	}

	const postId = request.nextUrl.searchParams.get("post") ?? "";
	const destination = request.nextUrl.searchParams.get("destination") ?? "";
	if (!isSocialDestination(destination)) {
		return new NextResponse("Destino inválido.", { status: 400 });
	}

	const post = await getPost(postId, socialDeps);
	const imageUrl = post?.deliveryFor(destination)?.preparedImageUrl;
	if (!imageUrl) {
		return new NextResponse("A arte ainda não está pronta.", { status: 404 });
	}

	const image = await fetch(imageUrl);
	if (!image.ok) {
		return new NextResponse("A arte não está mais no armazenamento.", {
			status: 404,
		});
	}
	return new NextResponse(await image.arrayBuffer(), {
		headers: {
			"content-type": image.headers.get("content-type") ?? "image/jpeg",
			"content-disposition": `attachment; filename="story-${postId.slice(0, 8)}.jpg"`,
			"cache-control": "private, no-store",
		},
	});
}
