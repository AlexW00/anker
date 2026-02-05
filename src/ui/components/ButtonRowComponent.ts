import { ButtonComponent } from "obsidian";

/**
 * Configuration for a checkbox toggle in the button row.
 */
export interface CheckboxConfig {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	tooltip?: string;
}

/**
 * Configuration for the ButtonRowComponent.
 */
export interface ButtonRowOptions {
	/** Text for the cancel/left button. Defaults to "Cancel". */
	cancelText?: string;
	/** Callback when cancel button is clicked. */
	onCancel?: () => void;
	/** Text for the submit/right CTA button. */
	submitText?: string;
	/** Callback when submit button is clicked. */
	onSubmit?: () => void;
	/** Whether submit button should be styled as CTA. Defaults to true. */
	submitCta?: boolean;
	/** Whether submit button should be initially disabled. */
	submitDisabled?: boolean;
	/** Checkboxes to display in the right button group. */
	checkboxes?: CheckboxConfig[];
}

/**
 * Reusable button row component with left (cancel) and right (submit + checkboxes) groups.
 * Provides methods to update button state, text, and loading indicator.
 */
export class ButtonRowComponent {
	private containerEl: HTMLElement;
	private cancelButton: ButtonComponent | null = null;
	private submitButton: ButtonComponent | null = null;
	private checkboxInputs: Map<string, HTMLInputElement> = new Map();
	private options: ButtonRowOptions;

	constructor(container: HTMLElement, options: ButtonRowOptions) {
		this.options = options;
		this.containerEl = container.createDiv({
			cls: "flashcard-modal-buttons",
		});
		this.render();
	}

	private render(): void {
		const leftButtons = this.containerEl.createDiv({
			cls: "flashcard-buttons-left",
		});

		const rightButtons = this.containerEl.createDiv({
			cls: "flashcard-buttons-right",
		});

		// Cancel button (left side)
		if (this.options.onCancel || this.options.cancelText) {
			this.cancelButton = new ButtonComponent(leftButtons)
				.setButtonText(this.options.cancelText ?? "Cancel")
				.onClick(() => this.options.onCancel?.());
		}

		// Checkboxes (right side, before submit button)
		if (this.options.checkboxes) {
			for (const config of this.options.checkboxes) {
				const label = rightButtons.createEl("label", {
					cls: "flashcard-checkbox-toggle",
					attr: config.tooltip ? { title: config.tooltip } : {},
				});

				const input = label.createEl("input", { type: "checkbox" });
				input.checked = config.checked;
				input.addEventListener("change", () => {
					config.onChange(input.checked);
				});

				label.createSpan({ text: config.label });
				this.checkboxInputs.set(config.label, input);
			}
		}

		// Submit button (right side)
		if (this.options.onSubmit || this.options.submitText) {
			this.submitButton = new ButtonComponent(rightButtons)
				.setButtonText(this.options.submitText ?? "Submit")
				.onClick(() => this.options.onSubmit?.());

			if (this.options.submitCta !== false) {
				this.submitButton.setCta();
			}

			if (this.options.submitDisabled) {
				this.submitButton.setDisabled(true);
			}
		}
	}

	/**
	 * Set whether the submit button is disabled.
	 */
	setSubmitDisabled(disabled: boolean): void {
		this.submitButton?.setDisabled(disabled);
	}

	/**
	 * Set the submit button text.
	 */
	setSubmitText(text: string): void {
		this.submitButton?.setButtonText(text);
	}

	/**
	 * Set the cancel button text.
	 */
	setCancelText(text: string): void {
		this.cancelButton?.setButtonText(text);
	}

	/**
	 * Set loading state on the submit button (shows spinner).
	 */
	setSubmitLoading(loading: boolean): void {
		if (this.submitButton?.buttonEl) {
			this.submitButton.buttonEl.toggleClass(
				"flashcard-button-loading",
				loading,
			);
		}
	}

	/**
	 * Set whether the cancel button is disabled.
	 */
	setCancelDisabled(disabled: boolean): void {
		this.cancelButton?.setDisabled(disabled);
	}

	/**
	 * Get a checkbox input by its label.
	 */
	getCheckbox(label: string): HTMLInputElement | undefined {
		return this.checkboxInputs.get(label);
	}

	/**
	 * Set a checkbox's checked state by its label.
	 */
	setCheckboxChecked(label: string, checked: boolean): void {
		const input = this.checkboxInputs.get(label);
		if (input) {
			input.checked = checked;
		}
	}

	/**
	 * Set whether a checkbox is disabled.
	 */
	setCheckboxDisabled(label: string, disabled: boolean): void {
		const input = this.checkboxInputs.get(label);
		if (input) {
			input.disabled = disabled;
		}
	}

	/**
	 * Get the container element.
	 */
	get element(): HTMLElement {
		return this.containerEl;
	}
}
