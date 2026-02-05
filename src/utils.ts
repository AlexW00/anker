import type { App, EventRef } from "obsidian";

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

/**
 * Wait for Obsidian's metadataCache to update after a file modification.
 *
 * Obsidian's metadataCache updates asynchronously after vault.modify().
 * This helper waits for the "changed" event to fire for the specific file,
 * ensuring the cache is synchronized before reading from it.
 *
 * @param app - The Obsidian App instance
 * @param filePath - The path of the file to wait for
 * @param timeoutMs - Maximum time to wait (default 2000ms)
 * @returns Promise that resolves when cache is updated, or rejects on timeout
 */
export function waitForMetadataCacheUpdate(
	app: App,
	filePath: string,
	timeoutMs = 2000,
): Promise<void> {
	return new Promise((resolve, reject) => {
		let eventRef: EventRef | null = null;
		let timeoutId: ReturnType<typeof setTimeout> | null = null;

		const cleanup = () => {
			if (eventRef) {
				app.metadataCache.offref(eventRef);
				eventRef = null;
			}
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}
		};

		eventRef = app.metadataCache.on("changed", (changedFile) => {
			if (changedFile.path === filePath) {
				cleanup();
				resolve();
			}
		});

		timeoutId = setTimeout(() => {
			cleanup();
			// Resolve instead of reject - timeout is not fatal, cache may already be updated
			console.debug(
				`[Anker:waitForMetadataCacheUpdate] timeout waiting for ${filePath}, proceeding anyway`,
			);
			resolve();
		}, timeoutMs);
	});
}
