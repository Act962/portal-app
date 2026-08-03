import { SectionHeader } from "@portal-app/ui/components/section-header";

import { ScheduleList } from "@/components/radio/schedule-list";

export function ScheduleCard() {
	return (
		// Full-bleed tinted band on mobile, bordered card in the desktop rail.
		<section className="-mx-4 bg-surface-alt px-4 py-5 md:mx-0 md:rounded-card md:border md:border-hairline md:bg-surface md:p-4">
			<SectionHeader
				title="Programação"
				variant="rule"
				className="mb-3 pb-0 text-sm"
			/>
			<ScheduleList />
		</section>
	);
}
