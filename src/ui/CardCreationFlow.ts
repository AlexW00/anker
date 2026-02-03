import { App, Notice } from "obsidian";
import type { FlashcardTemplate, FlashcardsPluginSettings } from "../types";
import type { CardService } from "../flashcards/CardService";
import type { DeckService } from "../flashcards/DeckService";
import type { TemplateService } from "../flashcards/TemplateService";
import { CardCreationModal } from "./CardCreationModal";

/**
 * Callback invoked after a card is created.
 */
export interface CardCreationCallbacks {
	/** Called after the dashboard should refresh (if applicable) */
	onRefresh?: () => Promise<void>;
}

/**
 * Opens the card creation modal directly, with deck/template selection embedded in the modal.
 * This is the main entry point for creating flashcards.
 */
export function showCardCreationModal(
	app: App,
	cardService: CardService,
	deckService: DeckService,
	templateService: TemplateService,
	settings: FlashcardsPluginSettings,
	saveSettings: () => Promise<void>,
	callbacks?: CardCreationCallbacks,
	/** Optional initial deck path override */
	initialDeckPath?: string,
	/** Optional initial template override */
	initialTemplate?: FlashcardTemplate,
): void {
	new CardCreationModal({
		app,
		deckService,
		templateService,
		settings,
		initialDeckPath,
		initialTemplate,
		onSubmit: (fields, deckPath, templatePath, createAnother) => {
			void cardService
				.createCard(
					deckPath,
					templatePath,
					fields,
					settings.noteNameTemplate,
				)
				.then(async (file) => {
					new Notice("Card created!");

					// Update last used deck and template
					settings.lastUsedDeck = deckPath;
					settings.lastUsedTemplate = templatePath;
					await saveSettings();

					// Refresh dashboard if callback provided
					if (callbacks?.onRefresh) {
						await callbacks.onRefresh();
					}

					if (!createAnother && settings.openCardAfterCreation) {
						await app.workspace.getLeaf().openFile(file);
					}
				})
				.catch((error: Error) => {
					new Notice(`Failed to create card: ${error.message}`);
				});
		},
	}).open();
}
