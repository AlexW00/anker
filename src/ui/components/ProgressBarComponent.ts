/**
 * Configuration for the ProgressBarComponent.
 */
export interface ProgressBarOptions {
	/** Whether to show the progress text element. Defaults to true. */
	showText?: boolean;
	/** Additional CSS class for the container. */
	containerClass?: string;
}

/**
 * Reusable progress bar component with show/hide and progress update methods.
 * Uses existing CSS classes: flashcard-progress-bar, flashcard-progress-fill, flashcard-progress-hidden.
 */
export class ProgressBarComponent {
	private containerEl: HTMLElement;
	private barEl: HTMLElement;
	private fillEl: HTMLElement;
	private textEl: HTMLElement | null = null;
	private options: ProgressBarOptions;

	constructor(container: HTMLElement, options: ProgressBarOptions = {}) {
		this.options = options;

		// Create container with optional custom class
		const classes = ["flashcard-progress-hidden"];
		if (options.containerClass) {
			classes.push(options.containerClass);
		}

		this.containerEl = container.createDiv({
			cls: classes.join(" "),
		});

		// Create progress bar structure
		this.barEl = this.containerEl.createDiv({
			cls: "flashcard-progress-bar",
		});

		this.fillEl = this.barEl.createDiv({
			cls: "flashcard-progress-fill",
		});

		// Optional text element
		if (options.showText !== false) {
			this.textEl = this.containerEl.createDiv({
				cls: "flashcard-progress-text",
			});
		}
	}

	/**
	 * Show the progress bar.
	 */
	show(): void {
		this.containerEl.removeClass("flashcard-progress-hidden");
	}

	/**
	 * Hide the progress bar.
	 */
	hide(): void {
		this.containerEl.addClass("flashcard-progress-hidden");
	}

	/**
	 * Set progress using current/total values with optional message.
	 * @param current - Current progress value
	 * @param total - Total value
	 * @param message - Optional message to display
	 */
	setProgress(current: number, total: number, message?: string): void {
		const fraction = total > 0 ? current / total : 0;
		this.setFraction(fraction);

		if (this.textEl && message !== undefined) {
			this.textEl.textContent = message;
		}
	}

	/**
	 * Set progress as a fraction (0-1).
	 * @param fraction - Progress fraction between 0 and 1
	 */
	setFraction(fraction: number): void {
		const clampedFraction = Math.max(0, Math.min(1, fraction));
		this.fillEl.style.width = `${clampedFraction * 100}%`;
	}

	/**
	 * Set only the progress text without changing the bar.
	 */
	setText(message: string): void {
		if (this.textEl) {
			this.textEl.textContent = message;
		}
	}

	/**
	 * Reset progress to 0 and clear text.
	 */
	reset(): void {
		this.setFraction(0);
		if (this.textEl) {
			this.textEl.textContent = "";
		}
	}

	/**
	 * Get the container element.
	 */
	get element(): HTMLElement {
		return this.containerEl;
	}
}
