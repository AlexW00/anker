import { App, FuzzySuggestModal } from "obsidian";
import type { Deck, FlashcardFrontmatter } from "../types";
import { DeckService } from "../flashcards/DeckService";

type FailedCardsScopeOption =
	| { type: "deck"; path: string; display: string }
	| { type: "all"; display: string }
	| { type: "template"; display: string };

export type FailedCardsScopeResult =
	| { type: "deck"; path: string }
	| { type: "all" }
	| { type: "template" };

/**
 * Modal for selecting which scope to show failed cards for.
 */
export class FailedCardsScopeModal extends FuzzySuggestModal<FailedCardsScopeOption> {
	private deckService: DeckService;
	private decks: Deck[];
	private onChoose: (scope: FailedCardsScopeResult) => void;

	constructor(
		app: App,
		deckService: DeckService,
		onChoose: (scope: FailedCardsScopeResult) => void,
	) {
		super(app);
		this.deckService = deckService;
		this.decks = deckService.discoverDecks();
		this.onChoose = onChoose;
		this.setPlaceholder("Select a deck or option...");
	}

	/**
	 * Count failed cards in a deck (cards with _error in frontmatter).
	 */
	private countFailedCards(deckPath: string): number {
		const cards = this.deckService.getFlashcardsInFolder(deckPath);
		return cards.filter((card) => {
			const fm = card.frontmatter as unknown as Record<string, unknown>;
			const error = fm._error;
			return (
				error !== undefined &&
				error !== null &&
				String(error).trim() !== ""
			);
		}).length;
	}

	getItems(): FailedCardsScopeOption[] {
		const deckOptions: FailedCardsScopeOption[] = this.decks.map((deck) => {
			const failedCount = this.countFailedCards(deck.path);
			const failedText =
				failedCount === 0
					? "0 failed cards"
					: failedCount === 1
						? "1 failed card"
						: `${failedCount} failed cards`;
			return {
				type: "deck",
				path: deck.path,
				display: `${deck.path} (${failedText})`,
			};
		});

		return [
			...deckOptions,
			{ type: "all", display: "All decks" },
			{ type: "template", display: "Choose a template..." },
		];
	}

	getItemText(item: FailedCardsScopeOption): string {
		return item.display;
	}

	onChooseItem(
		item: FailedCardsScopeOption,
		_evt: MouseEvent | KeyboardEvent,
	): void {
		if (item.type === "deck") {
			this.onChoose({ type: "deck", path: item.path });
			return;
		}
		this.onChoose({ type: item.type });
	}
}
