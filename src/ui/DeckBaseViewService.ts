import { App, Notice, TFile, stringifyYaml } from "obsidian";
import type { DeckViewColumn, FlashcardsPluginSettings } from "../types";
import { DECK_VIEW_COLUMN_LABELS } from "../types";

export class DeckBaseViewService {
	private app: App;
	private settings: FlashcardsPluginSettings;

	constructor(app: App, settings: FlashcardsPluginSettings) {
		this.app = app;
		this.settings = settings;
	}

	updateSettings(settings: FlashcardsPluginSettings): void {
		this.settings = settings;
	}

	/**
	 * Opens a Base view for the deck showing all flashcards.
	 * Recreates the .base file to keep config up to date.
	 */
	async openDeckBaseView(deckPath: string, deckName: string): Promise<void> {
		const baseFilePath = `${deckPath}/${deckName}.base`;

		// Recreate the base file each time to ensure the config is up to date
		const baseFile = this.app.vault.getAbstractFileByPath(baseFilePath);
		if (baseFile instanceof TFile) {
			try {
				await this.app.fileManager.trashFile(baseFile);
			} catch (error) {
				new Notice(
					`Failed to refresh deck view: ${(error as Error).message}`,
				);
				return;
			}
		}

		const baseConfig = this.buildBaseConfig(deckPath, this.settings);

		try {
			await this.app.vault.create(
				baseFilePath,
				stringifyYaml(baseConfig),
			);
		} catch (error) {
			new Notice(
				`Failed to create deck view: ${(error as Error).message}`,
			);
			return;
		}

		await this.app.workspace.openLinkText(baseFilePath, "", false);
	}

	/**
	 * Build the base config for a deck view based on plugin settings.
	 */
	private buildBaseConfig(
		deckPath: string,
		settings: FlashcardsPluginSettings,
	): Record<string, unknown> {
		const columns = settings.deckViewColumns;

		const formulaDefs: Record<string, string> = {
			state: 'if(review.state == 0, "New", if(review.state == 1, "Learning", if(review.state == 2, "Review", "Relearning")))',
			due: "review.due",
			stability: "review.stability",
			difficulty: "review.difficulty",
			reps: "review.reps",
			lapses: "review.lapses",
			last_review: "review.last_review",
			scheduled_days: "review.scheduled_days",
			elapsed_days: "review.elapsed_days",
		};

		const formulas: Record<string, string> = {};
		for (const col of columns) {
			if (col !== "file.name" && col !== "template" && formulaDefs[col]) {
				formulas[col] = formulaDefs[col];
			}
		}

		const properties: Record<string, { displayName: string }> = {};
		for (const col of columns) {
			const isFormula = col !== "file.name" && col !== "template";
			const key = isFormula ? `formula.${col}` : col;

			properties[key] = {
				displayName: DECK_VIEW_COLUMN_LABELS[col],
			};
		}

		const order: string[] = columns.map((col: DeckViewColumn) => {
			if (col === "file.name") return "file.name";
			if (col === "template") return "template";
			return `formula.${col}`;
		});

		return {
			filters: {
				and: [`file.inFolder("${deckPath}")`, 'type == "flashcard"'],
			},
			formulas,
			properties,
			views: [
				{
					type: "table",
					name: "All Cards",
					order,
				},
			],
		};
	}
}
