import { App, TFile, prepareFuzzySearch } from "obsidian";

/**
 * Provides [[ link suggestions for a textarea element.
 * When user types [[, shows a popover with fuzzy-matched file suggestions.
 */
export class TextareaSuggest {
	private app: App;
	private textarea: HTMLTextAreaElement;
	private suggestEl: HTMLElement | null = null;
	private suggestions: TFile[] = [];
	private selectedIndex = 0;
	private isOpen = false;

	constructor(app: App, textarea: HTMLTextAreaElement) {
		this.app = app;
		this.textarea = textarea;

		this.textarea.addEventListener("input", this.onInput.bind(this));
		this.textarea.addEventListener("keydown", this.onKeydown.bind(this));
		this.textarea.addEventListener("blur", this.onBlur.bind(this));
		this.textarea.addEventListener(
			"scroll",
			this.updatePosition.bind(this),
		);
	}

	/**
	 * Clean up event listeners and close popover.
	 */
	destroy(): void {
		this.close();
		// Note: Event listeners are automatically cleaned up when textarea is removed from DOM
	}

	private onInput(): void {
		const value = this.textarea.value;
		const cursorPos = this.textarea.selectionStart;

		// Find [[ before cursor that isn't closed yet
		const beforeCursor = value.substring(0, cursorPos);
		const linkMatch = beforeCursor.match(/\[\[([^[]*?)$/);

		if (linkMatch) {
			const query = linkMatch[1] ?? "";
			this.showSuggestions(query);
		} else {
			this.close();
		}
	}

	private showSuggestions(query: string): void {
		const files = this.app.vault.getFiles();

		if (!query) {
			// Show first 10 files if no query
			this.suggestions = files.slice(0, 10);
		} else {
			const fuzzy = prepareFuzzySearch(query);
			this.suggestions = files
				.map((file) => ({ file, match: fuzzy(file.basename) }))
				.filter((item) => item.match)
				.sort((a, b) => (b.match?.score ?? 0) - (a.match?.score ?? 0))
				.slice(0, 10)
				.map((item) => item.file);
		}

		if (this.suggestions.length === 0) {
			this.close();
			return;
		}

		this.selectedIndex = 0;
		this.isOpen = true;
		this.renderSuggestions();
	}

	private renderSuggestions(): void {
		// Create popover if it doesn't exist
		if (!this.suggestEl) {
			this.suggestEl = document.createElement("div");
			this.suggestEl.addClass("flashcard-suggest-container");
			this.suggestEl.addClass("suggestion-container");
			document.body.appendChild(this.suggestEl);
		}

		this.suggestEl.empty();

		this.suggestions.forEach((file, idx) => {
			const item = this.suggestEl!.createEl("div", {
				cls:
					"suggestion-item" +
					(idx === this.selectedIndex ? " is-selected" : ""),
			});

			item.createEl("div", {
				text: file.basename,
				cls: "suggestion-title",
			});

			if (file.parent && file.parent.path !== "/") {
				item.createEl("div", {
					text: file.parent.path,
					cls: "suggestion-note",
				});
			}

			item.addEventListener("mousedown", (e) => {
				e.preventDefault();
				this.selectSuggestion(file);
			});

			item.addEventListener("mouseenter", () => {
				this.selectedIndex = idx;
				this.updateSelectedClass();
			});
		});

		this.updatePosition();
	}

	private updatePosition(): void {
		if (!this.suggestEl || !this.isOpen) return;

		const rect = this.textarea.getBoundingClientRect();

		// Position below the textarea
		this.suggestEl.setCssProps({
			"--flashcard-suggest-left": `${rect.left}px`,
			"--flashcard-suggest-top": `${rect.bottom + 4}px`,
			"--flashcard-suggest-width": `${rect.width}px`,
		});
	}

	private updateSelectedClass(): void {
		if (!this.suggestEl) return;

		const items = this.suggestEl.querySelectorAll(".suggestion-item");
		items.forEach((item, idx) => {
			item.toggleClass("is-selected", idx === this.selectedIndex);
		});
	}

	private onKeydown(e: KeyboardEvent): void {
		if (!this.isOpen || !this.suggestEl) return;

		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				this.selectedIndex = Math.min(
					this.selectedIndex + 1,
					this.suggestions.length - 1,
				);
				this.updateSelectedClass();
				break;
			case "ArrowUp":
				e.preventDefault();
				this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
				this.updateSelectedClass();
				break;
			case "Enter":
			case "Tab": {
				const selected = this.suggestions[this.selectedIndex];
				if (selected) {
					e.preventDefault();
					this.selectSuggestion(selected);
				}
				break;
			}
			case "Escape":
				e.preventDefault();
				this.close();
				break;
		}
	}

	private selectSuggestion(file: TFile): void {
		const value = this.textarea.value;
		const cursorPos = this.textarea.selectionStart;
		const beforeCursor = value.substring(0, cursorPos);

		// Replace [[ + query with [[filename]]
		const newBefore = beforeCursor.replace(/\[\[[^[]*?$/, `[[${file.basename}]]`);
		this.textarea.value = newBefore + value.substring(cursorPos);
		this.textarea.selectionStart = this.textarea.selectionEnd =
			newBefore.length;

		// Trigger input event so the modal updates its field value
		this.textarea.dispatchEvent(new Event("input", { bubbles: true }));

		this.close();
		this.textarea.focus();
	}

	private onBlur(): void {
		// Delay close to allow click on suggestion
		setTimeout(() => {
			if (!this.suggestEl?.contains(document.activeElement)) {
				this.close();
			}
		}, 150);
	}

	private close(): void {
		this.suggestEl?.remove();
		this.suggestEl = null;
		this.selectedIndex = 0;
		this.isOpen = false;
	}
}
