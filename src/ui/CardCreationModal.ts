import {
	App,
	ButtonComponent,
	DropdownComponent,
	Modal,
	Notice,
	setIcon,
} from "obsidian";
import type { Deck, FlashcardTemplate } from "../types";
import { TextareaSuggest } from "./TextareaSuggest";
import type { DeckService } from "../flashcards/DeckService";
import type { TemplateService } from "../flashcards/TemplateService";

/**
 * MIME type accept strings for all media types combined.
 */
const ALL_MEDIA_ACCEPT = "image/*,video/*,audio/*";

/**
 * Generate a UUID v4 string.
 */
function generateUUID(): string {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

/**
 * Options for the CardCreationModal.
 */
export interface CardCreationModalOptions {
	app: App;
	deckService: DeckService;
	templateService: TemplateService;
	templateFolder: string;
	attachmentFolder: string;
	lastUsedDeck?: string;
	lastUsedTemplate?: string;
	onSubmit: (
		fields: Record<string, string>,
		deckPath: string,
		templatePath: string,
		createAnother: boolean,
	) => void;
	/** Initial deck path (optional, uses last used or first available) */
	initialDeckPath?: string;
	/** Initial template (optional, uses last used or first available) */
	initialTemplate?: FlashcardTemplate;
}

/**
 * Modal for creating a flashcard with a dynamic form based on template variables.
 * Includes inline deck/template switching, media toolbar, and paste handling.
 */
export class CardCreationModal extends Modal {
	private deckService: DeckService;
	private templateService: TemplateService;
	private templateFolder: string;
	private attachmentFolder: string;
	private lastUsedDeck?: string;
	private lastUsedTemplate?: string;
	private onSubmit: CardCreationModalOptions["onSubmit"];

	private currentDeckPath: string;
	private currentTemplate: FlashcardTemplate;
	private availableDecks: Deck[] = [];
	private availableTemplates: FlashcardTemplate[] = [];
	private fields: Record<string, string> = {};
	private activeTextarea: HTMLTextAreaElement | null = null;
	private textareaSuggests: TextareaSuggest[] = [];

	constructor(options: CardCreationModalOptions) {
		super(options.app);
		this.deckService = options.deckService;
		this.templateService = options.templateService;
		this.templateFolder = options.templateFolder;
		this.attachmentFolder = options.attachmentFolder;
		this.lastUsedDeck = options.lastUsedDeck;
		this.lastUsedTemplate = options.lastUsedTemplate;
		this.onSubmit = options.onSubmit;

		// Will be set in onOpen after loading available options
		this.currentDeckPath = options.initialDeckPath ?? "";
		this.currentTemplate =
			options.initialTemplate ?? ({} as FlashcardTemplate);
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("flashcard-creation-modal");

		// Clean up old suggests
		this.textareaSuggests.forEach((s) => s.destroy());
		this.textareaSuggests = [];

		// Load available decks and templates
		this.availableDecks = this.deckService.discoverDecks();
		this.availableTemplates = await this.templateService.getTemplates(
			this.templateFolder,
		);

		// Handle no templates case
		if (this.availableTemplates.length === 0) {
			new Notice(
				`No templates found in "${this.templateFolder}". Please create a template first.`,
			);
			this.close();
			return;
		}

		// Determine initial deck path
		if (!this.currentDeckPath) {
			// Priority: last used deck -> first available deck -> vault root
			if (
				this.lastUsedDeck &&
				this.availableDecks.some(
					(d) => d.path === this.lastUsedDeck,
				)
			) {
				this.currentDeckPath = this.lastUsedDeck;
			} else if (this.availableDecks.length > 0) {
				this.currentDeckPath = this.availableDecks[0]?.path ?? "/";
			} else {
				this.currentDeckPath = "/";
			}
		}

		// Determine initial template
		if (!this.currentTemplate.path) {
			// Priority: last used template -> first available template
			const lastTemplate = this.availableTemplates.find(
				(t) => t.path === this.lastUsedTemplate,
			);
			this.currentTemplate =
				lastTemplate ??
				this.availableTemplates[0] ??
				({} as FlashcardTemplate);
		}

		// Initialize fields for current template
		this.initializeFields();

		this.renderContent();
	}

	private initializeFields() {
		// Preserve existing field values when switching templates (for common field names)
		const oldFields = { ...this.fields };
		this.fields = {};

		for (const variable of this.currentTemplate.variables) {
			// Keep value if field existed before, otherwise use default
			this.fields[variable.name] =
				oldFields[variable.name] ?? variable.defaultValue ?? "";
		}
	}

	private renderContent() {
		const { contentEl } = this;
		contentEl.empty();

		// Header row: "New [Template] Card in Deck [Deck]"
		const headerRow = contentEl.createDiv({
			cls: "flashcard-modal-header-row",
		});

		headerRow.createSpan({
			text: "New ",
			cls: "flashcard-modal-header-text",
		});

		// Template selector
		this.createInlineDropdown(
			headerRow,
			this.availableTemplates.map((t) => ({
				label: t.name,
				value: t.path,
			})),
			this.currentTemplate.path,
			(selectedPath) => {
				const newTemplate = this.availableTemplates.find(
					(t) => t.path === selectedPath,
				);
				if (
					newTemplate &&
					newTemplate.path !== this.currentTemplate.path
				) {
					this.currentTemplate = newTemplate;
					this.initializeFields();
					this.renderContent();
				}
			},
		);

		headerRow.createSpan({
			text: " Card in Deck ",
			cls: "flashcard-modal-header-text",
		});

		// Deck selector
		const deckOptions = this.availableDecks.map((d) => ({
			label: this.getDeckDisplayLabel(d.path),
			value: d.path,
		}));
		// Add vault root option only if there are no decks
		if (deckOptions.length === 0) {
			deckOptions.push({ label: "(Vault root)", value: "/" });
		}

		this.createInlineDropdown(
			headerRow,
			deckOptions,
			this.currentDeckPath,
			(selectedPath) => {
				this.currentDeckPath = selectedPath;
				this.renderContent();
			},
		);

		contentEl.createDiv({ cls: "flashcard-modal-header-separator" });

		// Dynamic form fields
		for (const variable of this.currentTemplate.variables) {
			const fieldRow = contentEl.createDiv({
				cls: "flashcard-field-row",
			});

			// Field label (left side)
			fieldRow.createEl("label", {
				text: this.formatFieldName(variable.name),
				cls: "flashcard-field-label-inline",
			});

			// Textarea container (right side)
			const textareaContainer = fieldRow.createDiv({
				cls: "flashcard-textarea-container",
			});

			// Textarea
			const textarea = textareaContainer.createEl("textarea", {
				cls: "flashcard-textarea-full-width",
				attr: {
					placeholder: `Enter ${variable.name}...`,
					rows: "4",
				},
			});
			textarea.value = this.fields[variable.name] ?? "";

			textarea.addEventListener("input", () => {
				this.fields[variable.name] = textarea.value;
			});

			textarea.addEventListener("focus", () => {
				this.activeTextarea = textarea;
			});

			// Paste handler for media
			textarea.addEventListener("paste", (e) => {
				void this.handlePaste(e, textarea, variable.name);
			});

			// Add [[ link suggestions
			const suggest = new TextareaSuggest(this.app, textarea);
			this.textareaSuggests.push(suggest);

			// Single attachment button (bottom-right corner)
			const attachBtn = textareaContainer.createDiv({
				cls: "flashcard-attach-btn",
			});
			setIcon(attachBtn, "paperclip");
			attachBtn.setAttribute(
				"aria-label",
				"Attach media (image, video, audio)",
			);
			attachBtn.addEventListener("click", () => {
				this.openFilePicker(variable.name);
			});
		}

		// Button container
		const buttonContainer = contentEl.createDiv({
			cls: "flashcard-modal-buttons-v2",
		});

		// Cancel button (left side)
		const leftButtons = buttonContainer.createDiv({
			cls: "flashcard-buttons-left",
		});
		new ButtonComponent(leftButtons)
			.setButtonText("Cancel")
			.onClick(() => this.close());

		// Create buttons (right side)
		const rightButtons = buttonContainer.createDiv({
			cls: "flashcard-buttons-right",
		});

		new ButtonComponent(rightButtons)
			.setButtonText("Create & add another")
			.onClick(() => {
				this.submitCard(true);
			});

		new ButtonComponent(rightButtons)
			.setButtonText("Create")
			.setCta()
			.onClick(() => {
				this.submitCard(false);
			});

		// Focus first field
		const firstInput = contentEl.querySelector("textarea");
		if (firstInput) {
			firstInput.focus();
			this.activeTextarea = firstInput;
		}
	}

	private submitCard(createAnother: boolean) {
		if (createAnother) {
			this.onSubmit(
				{ ...this.fields },
				this.currentDeckPath,
				this.currentTemplate.path,
				true,
			);
			// Clear fields for next card
			for (const variable of this.currentTemplate.variables) {
				this.fields[variable.name] = "";
			}
			this.renderContent();
		} else {
			this.close();
			this.onSubmit(
				this.fields,
				this.currentDeckPath,
				this.currentTemplate.path,
				false,
			);
		}
	}

	private getDeckDisplayLabel(path: string): string {
		if (path === "/" || path === "") return "(Vault root)";
		const normalized = path
			.split("/")
			.filter(Boolean)
			.map((segment) => this.stripFolderPrefix(segment));
		const fullLabel = normalized.join(" / ");
		if (fullLabel.length <= 40 || normalized.length <= 3) {
			return fullLabel;
		}
		return `${normalized[0]} / … / ${normalized[normalized.length - 1]}`;
	}

	private stripFolderPrefix(segment: string): string {
		return segment.replace(/^folder\s+/i, "");
	}

	/**
	 * Create an inline dropdown using Obsidian's DropdownComponent.
	 */
	private createInlineDropdown(
		container: HTMLElement,
		options: { label: string; value: string }[],
		currentValue: string,
		onChange: (value: string) => void,
	): void {
		const dropdown = new DropdownComponent(container);
		dropdown.selectEl.addClass("flashcard-inline-dropdown");
		options.forEach((option) => {
			dropdown.addOption(option.value, option.label);
		});
		dropdown.setValue(currentValue);
		dropdown.onChange((value) => onChange(value));
	}

	onClose() {
		// Clean up suggests
		this.textareaSuggests.forEach((s) => s.destroy());
		this.textareaSuggests = [];

		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Open a native file picker to select media file (image, video, or audio).
	 */
	private openFilePicker(fieldName: string): void {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ALL_MEDIA_ACCEPT;
		input.addClass("flashcard-hidden-input");

		input.addEventListener("change", () => {
			const file = input.files?.[0];
			if (!file) return;

			void this.saveFileToVault(file, fieldName)
				.catch((error) => {
					console.error("Failed to save file:", error);
					new Notice("Failed to save file");
				})
				.finally(() => {
					input.remove();
				});
		});

		document.body.appendChild(input);
		input.click();
	}

	/**
	 * Save a file from the user's system to the vault attachments folder.
	 */
	private async saveFileToVault(
		file: File,
		fieldName: string,
	): Promise<void> {
		const buffer = await file.arrayBuffer();
		const extension = file.name.split(".").pop() || "bin";
		const filename = `${generateUUID()}.${extension}`;
		const attachmentFolder = this.attachmentFolder;
		const path = `${attachmentFolder}/${filename}`;

		// Ensure attachment folder exists
		await this.ensureFolderExists(attachmentFolder);

		// Create the file in vault
		const vaultFile = await this.app.vault.createBinary(path, buffer);

		// Insert embed syntax
		const textarea = this.getTextareaForField(fieldName);
		if (textarea) {
			const embed = `![[${vaultFile.name}]]`;
			this.insertAtCursor(textarea, embed);
			this.fields[fieldName] = textarea.value;
		}

		new Notice(`File saved: ${vaultFile.name}`);
	}

	/**
	 * Get the textarea element for a given field name.
	 */
	private getTextareaForField(fieldName: string): HTMLTextAreaElement | null {
		const rows = this.contentEl.querySelectorAll(".flashcard-field-row");
		const index = this.currentTemplate.variables.findIndex(
			(v) => v.name === fieldName,
		);
		if (index >= 0 && rows[index]) {
			return rows[index].querySelector("textarea");
		}
		return null;
	}

	/**
	 * Handle paste events to detect and save pasted media files.
	 */
	private async handlePaste(
		event: ClipboardEvent,
		textarea: HTMLTextAreaElement,
		fieldName: string,
	): Promise<void> {
		const items = event.clipboardData?.items;
		if (!items) return;

		for (const item of Array.from(items)) {
			const blob = item.getAsFile();
			const mimeType = item.type || blob?.type || "";

			// Handle images, videos, and audio
			if (
				mimeType.startsWith("image/") ||
				mimeType.startsWith("video/") ||
				mimeType.startsWith("audio/")
			) {
				event.preventDefault();
				if (!blob) continue;

				try {
					const buffer = await blob.arrayBuffer();
					const extension = this.getExtensionForPaste(blob, mimeType);
					const filename = `${generateUUID()}.${extension}`;
					const attachmentFolder = this.attachmentFolder;
					const path = `${attachmentFolder}/${filename}`;

					// Ensure attachment folder exists
					await this.ensureFolderExists(attachmentFolder);

					// Create the file in vault
					const file = await this.app.vault.createBinary(
						path,
						buffer,
					);

					// Insert embed syntax at cursor
					const embed = `![[${file.name}]]`;
					this.insertAtCursor(textarea, embed);
					this.fields[fieldName] = textarea.value;

					new Notice(`File saved: ${file.name}`);
				} catch (error) {
					console.error("Failed to save pasted file:", error);
					new Notice("Failed to save pasted file");
				}

				break; // Only handle first media item
			}
		}
	}

	/**
	 * Get file extension from MIME type.
	 */
	private getExtensionFromMime(mimeType: string): string {
		const mimeToExt: Record<string, string> = {
			"image/png": "png",
			"image/jpeg": "jpg",
			"image/gif": "gif",
			"image/webp": "webp",
			"image/svg+xml": "svg",
			"image/bmp": "bmp",
			"video/mp4": "mp4",
			"video/webm": "webm",
			"video/ogg": "ogv",
			"video/quicktime": "mov",
			"audio/mpeg": "mp3",
			"audio/wav": "wav",
			"audio/ogg": "ogg",
			"audio/mp4": "m4a",
			"audio/flac": "flac",
		};
		return mimeToExt[mimeType] || mimeType.split("/")[1] || "bin";
	}

	/**
	 * Resolve a safe file extension for pasted media.
	 */
	private getExtensionForPaste(blob: File, mimeType: string): string {
		if (mimeType) {
			const extFromMime = this.getExtensionFromMime(mimeType);
			if (extFromMime && extFromMime !== "bin") return extFromMime;
		}

		const nameParts = blob.name?.split(".") ?? [];
		const extFromName = nameParts.length > 1 ? nameParts.pop() : "";
		if (extFromName) return extFromName.toLowerCase();

		// Fallbacks for common paste types when MIME is missing
		return "png";
	}

	/**
	 * Ensure a folder exists in the vault.
	 */
	private async ensureFolderExists(folderPath: string): Promise<void> {
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!folder) {
			await this.app.vault.createFolder(folderPath);
		}
	}

	/**
	 * Insert text at the cursor position in a textarea.
	 */
	private insertAtCursor(textarea: HTMLTextAreaElement, text: string): void {
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const before = textarea.value.substring(0, start);
		const after = textarea.value.substring(end);

		textarea.value = before + text + after;
		textarea.selectionStart = textarea.selectionEnd = start + text.length;

		// Trigger input event so field value updates
		textarea.dispatchEvent(new Event("input", { bubbles: true }));
		textarea.focus();
	}

	/**
	 * Format field name for display (snake_case -> Title Case).
	 */
	private formatFieldName(name: string): string {
		return name
			.replace(/_/g, " ")
			.replace(/([A-Z])/g, " $1")
			.replace(/^./, (str) => str.toUpperCase())
			.trim();
	}
}
