import { browser } from "@wdio/globals";
import type { ObsidianAppLike } from "./obsidianTypes";

export const waitForVaultReady = async () => {
	await browser.waitUntil(
		async () => {
			return await browser.executeObsidian(({ app }) => {
				const obsidianApp = app as ObsidianAppLike;
				const files = obsidianApp.vault.getMarkdownFiles();
				if (files.length === 0) return false;

				const plugin = obsidianApp.plugins?.getPlugin?.("anker");
				if (!plugin) return false;

				return files.every((file) =>
					Boolean(obsidianApp.metadataCache.getFileCache(file)),
				);
			});
		},
		{
			timeout: 15000,
			interval: 500,
			timeoutMsg: "Vault files or metadata not ready",
		},
	);
};
