import { browser, expect } from "@wdio/globals";
import type { ElementArray } from "webdriverio";
import { obsidianPage } from "wdio-obsidian-service";
import { waitForVaultReady } from "../helpers/waitForVaultReady";
import type {
	ObsidianAppLike,
	AnkerPluginLike,
} from "../helpers/obsidianTypes";

/**
 * Extended plugin interface for settings tests.
 */
interface AnkerPluginSettingsLike extends AnkerPluginLike {
	settings: {
		templateFolder: string;
		attachmentFolder: string;
		defaultImportFolder: string;
		noteNameTemplate: string;
		openCardAfterCreation: boolean;
		showOnlyCurrentSide: boolean;
		autoRegenerateDebounce: number;
		fsrsRequestRetention: number;
		fsrsMaximumInterval: number;
		fsrsEnableFuzz: boolean;
		fsrsEnableShortTerm: boolean;
		fsrsLearningSteps: Array<string | number>;
		fsrsRelearningSteps: Array<string | number>;
		deckViewColumns: string[];
	};
}

describe("Settings", function () {
	/**
	 * Open the Obsidian settings modal and navigate to the Anker plugin tab.
	 */
	const openPluginSettings = async () => {
		// Open settings via command palette command or keyboard shortcut
		await browser.executeObsidian(({ app }) => {
			// Use the internal API to open settings
			const setting = (
				app as unknown as { setting: { open: () => void } }
			).setting;
			setting.open();
		});

		// Wait for settings modal to appear
		const settingsModal = browser.$(".mod-settings");
		await settingsModal.waitForExist({ timeout: 5000 });

		// Click on "Community plugins" in the left sidebar to expand plugin list
		// Then click on the Anker plugin settings
		const pluginTab = browser.$('.vertical-tab-nav-item[data-id="anker"]');

		// If not found directly, look for it via text
		if (!(await pluginTab.isExisting())) {
			// Try to find the tab by text content matching "Anker"
			// eslint-disable-next-line @typescript-eslint/await-thenable
			const tabItems = (await browser.$$(
				".vertical-tab-nav-item",
			)) as unknown as ElementArray;
			for (let i = 0; i < tabItems.length; i++) {
				const tab = tabItems[i];
				if (!tab) continue;
				const text = await tab.getText();
				if (text.toLowerCase().includes("anker")) {
					await tab.click();
					await browser.pause(300);
					return;
				}
			}
			throw new Error("Could not find Anker settings tab");
		}

		await pluginTab.click();
		await browser.pause(300);
	};

	/**
	 * Close the settings modal.
	 */
	const closeSettings = async () => {
		await browser.keys(["Escape"]);
		await browser.pause(200);
	};

	/**
	 * Get the current plugin settings.
	 */
	const getPluginSettings = async () => {
		return await browser.executeObsidian(({ app }) => {
			const obsidianApp = app as ObsidianAppLike;
			const plugin = obsidianApp.plugins?.getPlugin?.(
				"anker",
			) as AnkerPluginSettingsLike | null;
			if (!plugin) return null;
			return { ...plugin.settings };
		});
	};

	/**
	 * Find a setting by its name and return the container element.
	 */
	const findSettingByName = async (name: string) => {
		// eslint-disable-next-line @typescript-eslint/await-thenable
		const settings = (await browser.$$(
			".setting-item",
		)) as unknown as ElementArray;
		for (let i = 0; i < settings.length; i++) {
			const setting = settings[i];
			if (!setting) continue;
			const nameEl = setting.$(".setting-item-name");
			if (await nameEl.isExisting()) {
				const text = await nameEl.getText();
				if (text.toLowerCase() === name.toLowerCase()) {
					return setting;
				}
			}
		}
		return null;
	};

	/**
	 * Edit a text setting by name.
	 */
	const editTextSetting = async (name: string, value: string) => {
		const setting = await findSettingByName(name);
		if (!setting) throw new Error(`Setting "${name}" not found`);

		const input = setting.$("input[type='text']");
		if (!(await input.isExisting())) {
			throw new Error(`Text input for setting "${name}" not found`);
		}

		await input.click();
		// Clear existing value
		await browser.keys(["Meta", "a"]);
		await browser.keys(["Backspace"]);
		// Type new value
		await input.setValue(value);
		// Trigger blur to save
		await browser.keys(["Tab"]);
		await browser.pause(200);
	};

	/**
	 * Toggle a setting by name.
	 */
	const toggleSetting = async (name: string) => {
		const setting = await findSettingByName(name);
		if (!setting) throw new Error(`Setting "${name}" not found`);

		const toggle = setting.$(".checkbox-container");
		if (!(await toggle.isExisting())) {
			throw new Error(`Toggle for setting "${name}" not found`);
		}

		await toggle.click();
		await browser.pause(200);
	};

	before(async function () {
		await obsidianPage.resetVault();
		await waitForVaultReady();
	});

	after(async function () {
		// Close settings if still open
		const settingsModal = browser.$(".mod-settings");
		if (await settingsModal.isExisting()) {
			await closeSettings();
		}
	});

	describe("Storage settings", function () {
		before(async function () {
			await openPluginSettings();
		});

		after(async function () {
			await closeSettings();
		});

		it("can edit template folder", async function () {
			const testValue = "test/templates/folder";
			await editTextSetting("Template folder", testValue);

			const settings = await getPluginSettings();
			expect(settings?.templateFolder).toBe(testValue);
		});

		it("can edit attachment folder", async function () {
			const testValue = "test/attachments";
			await editTextSetting("Attachment folder", testValue);

			const settings = await getPluginSettings();
			expect(settings?.attachmentFolder).toBe(testValue);
		});

		it("can edit default import folder", async function () {
			const testValue = "test/imports";
			await editTextSetting("Default import folder", testValue);

			const settings = await getPluginSettings();
			expect(settings?.defaultImportFolder).toBe(testValue);
		});
	});

	describe("Card creation settings", function () {
		before(async function () {
			await openPluginSettings();
		});

		after(async function () {
			await closeSettings();
		});

		it("can edit note name template", async function () {
			const testValue = "{{date}}-{{time}}";
			await editTextSetting("Note name template", testValue);

			const settings = await getPluginSettings();
			expect(settings?.noteNameTemplate).toBe(testValue);
		});

		it("can toggle open card after creation", async function () {
			const initialSettings = await getPluginSettings();
			const initialValue = initialSettings?.openCardAfterCreation;

			await toggleSetting("Open card after creation");

			const settings = await getPluginSettings();
			expect(settings?.openCardAfterCreation).toBe(!initialValue);
		});
	});

	describe("Review settings", function () {
		before(async function () {
			await openPluginSettings();
		});

		after(async function () {
			await closeSettings();
		});

		it("can toggle show only current side", async function () {
			const initialSettings = await getPluginSettings();
			const initialValue = initialSettings?.showOnlyCurrentSide;

			await toggleSetting("Show only current side");

			const settings = await getPluginSettings();
			expect(settings?.showOnlyCurrentSide).toBe(!initialValue);
		});

		it("can edit auto-regenerate debounce", async function () {
			const testValue = "5";
			await editTextSetting("Auto-regenerate debounce", testValue);

			const settings = await getPluginSettings();
			expect(settings?.autoRegenerateDebounce).toBe(5);
		});
	});

	describe("FSRS scheduling settings", function () {
		before(async function () {
			await openPluginSettings();
		});

		after(async function () {
			await closeSettings();
		});

		it("can edit request retention", async function () {
			const testValue = "0.85";
			await editTextSetting("Request retention", testValue);

			const settings = await getPluginSettings();
			expect(settings?.fsrsRequestRetention).toBe(0.85);
		});

		it("can edit maximum interval", async function () {
			const testValue = "180";
			await editTextSetting("Maximum interval (days)", testValue);

			const settings = await getPluginSettings();
			expect(settings?.fsrsMaximumInterval).toBe(180);
		});

		it("can toggle enable fuzz", async function () {
			const initialSettings = await getPluginSettings();
			const initialValue = initialSettings?.fsrsEnableFuzz;

			await toggleSetting("Enable fuzz");

			const settings = await getPluginSettings();
			expect(settings?.fsrsEnableFuzz).toBe(!initialValue);
		});

		it("can toggle enable short-term learning", async function () {
			const initialSettings = await getPluginSettings();
			const initialValue = initialSettings?.fsrsEnableShortTerm;

			await toggleSetting("Enable short-term learning");

			const settings = await getPluginSettings();
			expect(settings?.fsrsEnableShortTerm).toBe(!initialValue);
		});

		it("can edit learning steps", async function () {
			const testValue = "1m, 5m, 15m";
			await editTextSetting("Learning steps", testValue);

			const settings = await getPluginSettings();
			// Learning steps are parsed as array
			expect(settings?.fsrsLearningSteps).toEqual(["1m", "5m", "15m"]);
		});

		it("can edit relearning steps", async function () {
			const testValue = "5m, 30m";
			await editTextSetting("Relearning steps", testValue);

			const settings = await getPluginSettings();
			expect(settings?.fsrsRelearningSteps).toEqual(["5m", "30m"]);
		});
	});

	describe("Deck view column settings", function () {
		before(async function () {
			await openPluginSettings();
		});

		after(async function () {
			await closeSettings();
		});

		it("can toggle deck view columns", async function () {
			// Get initial columns
			const initialSettings = await getPluginSettings();
			const hadStability =
				initialSettings?.deckViewColumns.includes("stability");

			// Find and toggle the stability column
			await toggleSetting("Stability");

			const settings = await getPluginSettings();
			const hasStability =
				settings?.deckViewColumns.includes("stability");

			// Should have toggled
			expect(hasStability).toBe(!hadStability);
		});
	});
});
