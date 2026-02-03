import { App, Notice, TFile, stringifyYaml } from "obsidian";
import type { DeckViewColumn, FlashcardsPluginSettings } from "../types";
import { DECK_VIEW_COLUMN_LABELS } from "../types";

/**
 * Filter type for deck base views.
 * - "all": Show all cards
 * - "new": Show only new cards (state = 0)
 * - "learn": Show learn cards (state = 1)
 * - "relearn": Show relearn cards (state = 3)
 * - "review": Show review cards that are due (state = 2 and due <= now)
 */
export type StateFilter = "all" | "new" | "learn" | "relearn" | "review";

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
	 * Opens a Base view for the deck showing flashcards.
	 * Recreates the .base file to keep config up to date.
	 * @param deckPath - Path to the deck folder
	 * @param deckName - Display name of the deck
	 * @param stateFilter - Optional filter for card state (default: "all")
	 */
	async openDeckBaseView(
		deckPath: string,
		_deckName: string,
		stateFilter: StateFilter = "all",
	): Promise<void> {
		const suffix = stateFilter === "all" ? "" : `-${stateFilter}`;
		const baseFilePath = `${deckPath}/flashcards${suffix}.base`;

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

		const baseConfig = this.buildBaseConfig(
			deckPath,
			this.settings,
			stateFilter,
		);

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
		stateFilter: StateFilter,
	): Record<string, unknown> {
		const columns = settings.deckViewColumns;

		const formulaDefs: Record<string, string> = {
			state: 'if(review.state == 0, "New", if(review.state == 1, "Learn", if(review.state == 2, "Review", "Relearn")))',
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
			// Built-in columns don't need formulas
			const isBuiltIn =
				col === "file.name" ||
				col === "file.ctime" ||
				col === "file.mtime" ||
				col === "template";
			if (!isBuiltIn && formulaDefs[col]) {
				formulas[col] = formulaDefs[col];
			}
		}

		const properties: Record<string, { displayName: string }> = {};
		for (const col of columns) {
			// Built-in columns use their property name directly
			const isBuiltIn =
				col === "file.name" ||
				col === "file.ctime" ||
				col === "file.mtime" ||
				col === "template";
			const key = isBuiltIn ? col : `formula.${col}`;

			properties[key] = {
				displayName: DECK_VIEW_COLUMN_LABELS[col],
			};
		}

		const order: string[] = columns.map((col: DeckViewColumn) => {
			// Built-in columns use their property name directly
			const isBuiltIn =
				col === "file.name" ||
				col === "file.ctime" ||
				col === "file.mtime" ||
				col === "template";
			return isBuiltIn ? col : `formula.${col}`;
		});

		// Build filters based on state filter
		const baseFilters: string[] = [
			`file.inFolder("${deckPath}")`,
			'type == "flashcard"',
		];

		const viewName = this.getViewName(stateFilter);

		switch (stateFilter) {
			case "new":
				baseFilters.push("review.state == 0");
				break;
			case "learn":
				// Learn (1)
				baseFilters.push("review.state == 1");
				break;
			case "relearn":
				// Relearn (3)
				baseFilters.push("review.state == 3");
				break;
			case "review":
				// Review state (2) and due date <= now
				baseFilters.push("review.state == 2");
				baseFilters.push("review.due <= now()");
				break;
			// "all" - no additional filters
		}

		return {
			filters: {
				and: baseFilters,
			},
			formulas,
			properties,
			views: [
				{
					type: "table",
					name: viewName,
					order,
				},
			],
		};
	}

	/**
	 * Get human-readable view name for a state filter.
	 */
	private getViewName(stateFilter: StateFilter): string {
		switch (stateFilter) {
			case "new":
				return "New Cards";
			case "learn":
				return "Learn Cards";
			case "relearn":
				return "Relearn Cards";
			case "review":
				return "Review Cards";
			default:
				return "All Cards";
		}
	}
}
