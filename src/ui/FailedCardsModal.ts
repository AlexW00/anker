import { App, Modal } from "obsidian";
import type { TFile } from "obsidian";
import { FileListComponent } from "./components";

/**
 * Represents a failed card with its file and error message.
 * file can be null if the file was not found.
 */
export interface FailedCard {
	file: TFile | null;
	error: string;
	/** Path to the file (useful when file is null) */
	path?: string;
}

/**
 * Modal that displays a list of cards that failed to regenerate.
 * Each card is shown as a clickable link that opens the card file.
 */
export class FailedCardsModal extends Modal {
	private failedCards: FailedCard[];

	constructor(app: App, failedCards: FailedCard[]) {
		super(app);
		this.failedCards = failedCards;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("flashcard-failed-modal");

		contentEl.createEl("h2", { text: "Failed cards" });
		contentEl.createEl("p", {
			text: `The following ${this.failedCards.length} card${this.failedCards.length === 1 ? "" : "s"} failed to regenerate. Click to view the error in the note's frontmatter.`,
		});

		// Convert failed cards to FileListItem format
		const items = this.failedCards.map(({ file, error, path }) => {
			const displayName = file
				? file.basename
				: (path?.split("/").pop()?.replace(/\.md$/, "") ?? "Unknown");

			// Truncate error for display
			const truncatedError =
				error.length > 80 ? error.slice(0, 77) + "..." : error;

			return {
				file,
				displayName,
				secondaryText: truncatedError,
				path,
			};
		});

		new FileListComponent(
			this.app,
			contentEl,
			{
				items,
				containerClass: "flashcard-failed-list",
				closeModalOnClick: true,
			},
			() => this.close(),
		);
	}

	onClose() {
		this.contentEl.empty();
	}
}
