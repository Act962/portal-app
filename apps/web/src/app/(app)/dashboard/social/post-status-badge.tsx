import type { PostStatus } from "@portal-app/social";
import { Badge } from "@portal-app/ui/components/badge";

import { POST_STATUS_CLASSES, POST_STATUS_LABELS } from "./social-labels";

export function PostStatusBadge({ status }: { status: PostStatus }) {
	return (
		<Badge variant="secondary" className={POST_STATUS_CLASSES[status]}>
			{POST_STATUS_LABELS[status]}
		</Badge>
	);
}
