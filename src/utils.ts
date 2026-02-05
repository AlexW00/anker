/**
 * Generate a UUID v4 string.
 *
 * Uses Math.random() — not cryptographically secure, but sufficient
 * for generating unique flashcard identifiers within a personal vault.
 */
export function generateUUID(): string {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}
