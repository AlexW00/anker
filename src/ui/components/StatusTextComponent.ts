/**
 * Reusable status text component that shows/hides with animation.
 * Uses the `is-visible` class to control visibility.
 */
export class StatusTextComponent {
	private containerEl: HTMLElement;

	constructor(container: HTMLElement, additionalClass?: string) {
		const classes = ["flashcard-modal-status-text"];
		if (additionalClass) {
			classes.push(additionalClass);
		}

		this.containerEl = container.createDiv({
			cls: classes.join(" "),
		});
	}

	/**
	 * Set the status text. If text is non-empty, the element becomes visible.
	 * If text is empty, the element is hidden.
	 */
	setText(text: string): void {
		this.containerEl.textContent = text;
		this.containerEl.toggleClass("is-visible", text.length > 0);
	}

	/**
	 * Clear the status text and hide the element.
	 */
	clear(): void {
		this.setText("");
	}

	/**
	 * Get the container element.
	 */
	get element(): HTMLElement {
		return this.containerEl;
	}
}
