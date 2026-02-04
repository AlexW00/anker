import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import type { PluginWithSettings } from "./types";
import {
	ALL_DECK_VIEW_COLUMNS,
	DECK_VIEW_COLUMN_LABELS,
	DEFAULT_BASIC_TEMPLATE,
	DEFAULT_SETTINGS,
} from "./types";

export { DEFAULT_SETTINGS } from "./types";
export type { FlashcardsPluginSettings } from "./types";

export class AnkerSettingTab extends PluginSettingTab {
	plugin: Plugin & PluginWithSettings;

	constructor(app: App, plugin: Plugin & PluginWithSettings) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName("Storage").setHeading();

		new Setting(containerEl)
			.setName("Template folder")
			.setDesc("Folder for flashcard templates")
			.addText((text) =>
				text
					.setPlaceholder("Anker/Templates")
					.setValue(this.plugin.settings.templateFolder)
					.onChange(async (value) => {
						this.plugin.settings.templateFolder = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Attachment folder")
			.setDesc("Folder for pasted images and media")
			.addText((text) =>
				text
					.setPlaceholder("Anker/Attachments")
					.setValue(this.plugin.settings.attachmentFolder)
					.onChange(async (value) => {
						this.plugin.settings.attachmentFolder = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl).setName("Card creation").setHeading();

		new Setting(containerEl)
			.setName("Note name template")
			.setDesc(
				"Template for new flashcard file names. Available: {{date}}, {{time}}, {{timestamp}}",
			)
			.addText((text) =>
				text
					.setPlaceholder("{{timestamp}}")
					.setValue(this.plugin.settings.noteNameTemplate)
					.onChange(async (value) => {
						this.plugin.settings.noteNameTemplate = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Default template content")
			.setDesc(
				"Content used when creating new templates. Use {{ variable }} for fields. Content in HTML comments (<!-- -->) is ignored when parsing variables.",
			)
			.addTextArea((text) => {
				text.setPlaceholder(DEFAULT_BASIC_TEMPLATE)
					.setValue(this.plugin.settings.defaultTemplateContent)
					.onChange(async (value) => {
						this.plugin.settings.defaultTemplateContent = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.rows = 12;
				text.inputEl.cols = 50;
				text.inputEl.addClass("flashcard-settings-template-textarea");
			});

		new Setting(containerEl)
			.setName("Reset default template")
			.setDesc(
				"Reset the default template content to the built-in basic template",
			)
			.addButton((button) =>
				button.setButtonText("Reset").onClick(async () => {
					this.plugin.settings.defaultTemplateContent =
						DEFAULT_BASIC_TEMPLATE;
					await this.plugin.saveSettings();
					this.display();
				}),
			);

		new Setting(containerEl)
			.setName("Open card after creation")
			.setDesc(
				"When enabled, the newly created card will be opened in the editor. Does not apply when creating multiple cards.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.openCardAfterCreation)
					.onChange(async (value) => {
						this.plugin.settings.openCardAfterCreation = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl).setName("Review").setHeading();

		new Setting(containerEl)
			.setName("Show only current side")
			.setDesc(
				"When enabled, only the current side is shown during review. When disabled, all sides up to the current one are shown.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showOnlyCurrentSide)
					.onChange(async (value) => {
						this.plugin.settings.showOnlyCurrentSide = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Auto-regenerate debounce")
			.setDesc(
				"Delay before regenerating cards after edits (0 to disable).",
			)
			.addText((text) =>
				text
					.setPlaceholder("1")
					.setValue(
						String(this.plugin.settings.autoRegenerateDebounce),
					)
					.onChange(async (value) => {
						const num = parseFloat(value);
						if (!isNaN(num) && num >= 0) {
							this.plugin.settings.autoRegenerateDebounce = num;
							await this.plugin.saveSettings();
						}
					}),
			);

		new Setting(containerEl).setName("Scheduling (FSRS)").setHeading();

		new Setting(containerEl)
			.setName("Request retention")
			.setDesc("Target recall probability (0 to 1).")
			.addText((text) =>
				text
					.setPlaceholder(
						String(DEFAULT_SETTINGS.fsrsRequestRetention),
					)
					.setValue(String(this.plugin.settings.fsrsRequestRetention))
					.onChange(async (value) => {
						const num = parseFloat(value);
						if (!isNaN(num) && num > 0 && num <= 1) {
							this.plugin.settings.fsrsRequestRetention = num;
							await this.plugin.saveSettings();
						}
					}),
			);

		new Setting(containerEl)
			.setName("Maximum interval (days)")
			.setDesc("Maximum scheduled interval in days.")
			.addText((text) =>
				text
					.setPlaceholder(
						String(DEFAULT_SETTINGS.fsrsMaximumInterval),
					)
					.setValue(String(this.plugin.settings.fsrsMaximumInterval))
					.onChange(async (value) => {
						const num = parseFloat(value);
						if (!isNaN(num) && num > 0) {
							this.plugin.settings.fsrsMaximumInterval = num;
							await this.plugin.saveSettings();
						}
					}),
			);

		new Setting(containerEl)
			.setName("Enable fuzz")
			.setDesc("Add randomness to long intervals to reduce clumping.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.fsrsEnableFuzz)
					.onChange(async (value) => {
						this.plugin.settings.fsrsEnableFuzz = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Enable short-term learning")
			.setDesc("Use short-term learning steps before long-term review.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.fsrsEnableShortTerm)
					.onChange(async (value) => {
						this.plugin.settings.fsrsEnableShortTerm = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Learning steps")
			.setDesc("Comma-separated list, e.g., 1m, 10m.")
			.addText((text) =>
				text
					.setPlaceholder("1m, 10m")
					.setValue(
						this.formatSteps(
							this.plugin.settings.fsrsLearningSteps,
						),
					)
					.onChange(async (value) => {
						this.plugin.settings.fsrsLearningSteps =
							this.parseSteps(value);
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Relearning steps")
			.setDesc("Comma-separated list, e.g., 10m.")
			.addText((text) =>
				text
					.setPlaceholder("10m")
					.setValue(
						this.formatSteps(
							this.plugin.settings.fsrsRelearningSteps,
						),
					)
					.onChange(async (value) => {
						this.plugin.settings.fsrsRelearningSteps =
							this.parseSteps(value);
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Weights (w)")
			.setDesc(
				"Comma-separated list of numbers. Leave blank to use defaults.",
			)
			.addTextArea((text) => {
				text.setPlaceholder("0.1, 1.2, ...")
					.setValue(this.plugin.settings.fsrsWeights.join(", "))
					.onChange(async (value) => {
						const weights = this.parseWeights(value);
						if (weights) {
							this.plugin.settings.fsrsWeights = weights;
							await this.plugin.saveSettings();
						}
					});
				text.inputEl.rows = 3;
			});

		new Setting(containerEl)
			.setName("Reset FSRS parameters")
			.setDesc("Restore default scheduling parameters.")
			.addButton((button) =>
				button.setButtonText("Reset").onClick(async () => {
					this.plugin.settings.fsrsRequestRetention =
						DEFAULT_SETTINGS.fsrsRequestRetention;
					this.plugin.settings.fsrsMaximumInterval =
						DEFAULT_SETTINGS.fsrsMaximumInterval;
					this.plugin.settings.fsrsEnableFuzz =
						DEFAULT_SETTINGS.fsrsEnableFuzz;
					this.plugin.settings.fsrsEnableShortTerm =
						DEFAULT_SETTINGS.fsrsEnableShortTerm;
					this.plugin.settings.fsrsLearningSteps = [
						...DEFAULT_SETTINGS.fsrsLearningSteps,
					];
					this.plugin.settings.fsrsRelearningSteps = [
						...DEFAULT_SETTINGS.fsrsRelearningSteps,
					];
					this.plugin.settings.fsrsWeights = [
						...DEFAULT_SETTINGS.fsrsWeights,
					];
					await this.plugin.saveSettings();
					this.display();
				}),
			);

		new Setting(containerEl).setName("Deck view").setHeading();

		new Setting(containerEl)
			.setName("Columns")
			.setDesc(
				"Select which columns to display when viewing a deck. Column order is fixed.",
			);

		const columnsContainer = containerEl.createDiv();
		this.renderColumnSettings(columnsContainer);
	}

	/**
	 * Render the column toggle settings with drag-to-reorder support.
	 */
	private renderColumnSettings(container: HTMLElement): void {
		container.empty();

		const selectedColumns = this.plugin.settings.deckViewColumns;

		// Render each column as a toggle in order
		for (const column of ALL_DECK_VIEW_COLUMNS) {
			const isSelected = selectedColumns.includes(column);

			new Setting(container)
				.setName(DECK_VIEW_COLUMN_LABELS[column])
				.addToggle((toggle) =>
					toggle.setValue(isSelected).onChange(async (value) => {
						if (value) {
							// Add column to end of list
							this.plugin.settings.deckViewColumns.push(column);
						} else {
							// Remove column from list
							this.plugin.settings.deckViewColumns =
								this.plugin.settings.deckViewColumns.filter(
									(c) => c !== column,
								);
						}
						await this.plugin.saveSettings();
					}),
				);
		}
	}

	private formatSteps(steps: Array<string | number>): string {
		return steps.map((step) => String(step)).join(", ");
	}

	private parseSteps(value: string): Array<string | number> {
		const parts = value
			.split(",")
			.map((part) => part.trim())
			.filter((part) => part.length > 0);

		return parts.map((part) => {
			const num = Number(part);
			const isNumeric =
				!isNaN(num) && /^-?\d+(?:\.\d+)?$/.test(part);
			return isNumeric ? num : part;
		});
	}

	private parseWeights(value: string): number[] | null {
		const parts = value
			.split(",")
			.map((part) => part.trim())
			.filter((part) => part.length > 0);

		if (parts.length === 0) {
			return [];
		}

		const weights = parts.map((part) => Number(part));
		if (weights.some((num) => isNaN(num))) {
			return null;
		}
		return weights;
	}
}
