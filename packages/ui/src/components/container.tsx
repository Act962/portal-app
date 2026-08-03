import { cn } from "@portal-app/ui/lib/utils";

/**
 * Page gutter. Every full-width band (header, footer, content) wraps its
 * children in this so the content edges line up down the whole page.
 */
function Container({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn("mx-auto w-full max-w-page px-4 md:px-5", className)}
			{...props}
		/>
	);
}

export { Container };
