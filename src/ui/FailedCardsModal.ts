import { App, Modal } from "obsidian";
import type { TFile } from "obsidian";

/**
 * Represents a failed card with its file and error message.
 */
export interface FailedCard {
	file: TFile;
	error: string;
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

		const list = contentEl.createEl("ul", {
			cls: "flashcard-failed-list",
		});

		for (const { file, error } of this.failedCards) {
			const item = list.createEl("li");
			const link = item.createEl("a", {
				text: file.basename,
				cls: "flashcard-failed-link",
				href: "#",
			});
			link.addEventListener("click", (event) => {
				event.preventDefault();
				this.close();
				void this.app.workspace.getLeaf().openFile(file);
			});

			// Show truncated error as hint
			const truncatedError =
				error.length > 80 ? error.slice(0, 77) + "..." : error;
			item.createSpan({
				text: ` — ${truncatedError}`,
				cls: "flashcard-failed-error-hint",
			});
		}
	}

	onClose() {
		this.contentEl.empty();
	}
}
