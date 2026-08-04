"use client";
import { useQuery } from "@tanstack/react-query";

import { trpc } from "@/utils/trpc";

export default function Dashboard() {
	// Passa pelo `staffProcedure`: prova, na rede, a sessão + o StaffMember ativo.
	const me = useQuery(trpc.identity.me.queryOptions());

	return <p>Identidade via API — papel: {me.data?.role}</p>;
}
