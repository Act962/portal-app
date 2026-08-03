/**
 * Emits a schema.org payload as JSON-LD.
 *
 * Uses a text child rather than `dangerouslySetInnerHTML`; the `<` escape
 * keeps a stray sequence in the data from ever closing the script tag early.
 */
export function JsonLd({ schema }: { schema: object }) {
	return (
		<script type="application/ld+json">
			{JSON.stringify(schema).replace(/</g, "\\u003c")}
		</script>
	);
}
