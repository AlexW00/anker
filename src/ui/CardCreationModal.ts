import {
	App,
	ButtonComponent,
	ExtraButtonComponent,
	Modal,
	Notice,
} from "obsidian";
import type { FlashcardTemplate } from "../types";
import { TextareaSuggest } from "./TextareaSuggest";

/**
 * Supported media types for file picker.
 */
type MediaType = "image" | "video" | "audio";

/**
 * MIME type accept strings for each media type.
 */
const MEDIA_ACCEPT: Record<MediaType, string> = {
	image: "image/*",
	video: "video/*",
	audio: "audio/*",
};

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
 * Modal for creating a flashcard with a dynamic form based on template variables.
 * Includes a media toolbar and paste handling for images.
 */
export class CardCreationModal extends Modal {
	private template: FlashcardTemplate;
	private deckPath: string;
	private attachmentFolder: string;
	private onSubmit: (
		fields: Record<string, string>,
		createAnother: boolean,
	) => void;
	private fields: Record<string, string> = {};
	private activeTextarea: HTMLTextAreaElement | null = null;
	private textareaSuggests: TextareaSuggest[] = [];

	constructor(
		app: App,
		template: FlashcardTemplate,
		deckPath: string,
		attachmentFolder: string,
		onSubmit: (
			fields: Record<string, string>,
			createAnother: boolean,
		) => void,
	) {
		super(app);
		this.template = template;
		this.deckPath = deckPath;
		this.attachmentFolder = attachmentFolder;
		this.onSubmit = onSubmit;

		// Initialize fields with empty values
		for (const variable of template.variables) {
			this.fields[variable.name] = variable.defaultValue || "";
		}
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("flashcard-creation-modal");

		// Clean up old suggests
		this.textareaSuggests.forEach((s) => s.destroy());
		this.textareaSuggests = [];

		// Header
		contentEl.createEl("h2", { text: `New Card: ${this.template.name}` });
		contentEl.createEl("p", {
			text: `Creating in: ${this.deckPath}`,
			cls: "flashcard-modal-subtitle",
		});

		// Dynamic form fields with toolbar
		for (const variable of this.template.variables) {
			const fieldWrapper = contentEl.createDiv({
				cls: "flashcard-field-wrapper",
			});

			// Field label
			fieldWrapper.createEl("label", {
				text: this.formatFieldName(variable.name),
				cls: "flashcard-field-label",
			});

			// Toolbar
			const toolbar = fieldWrapper.createDiv({
				cls: "flashcard-field-toolbar",
			});

			// Create toolbar buttons (image, video, audio)
			this.createToolbarButton(toolbar, "image", "Insert image", variable.name);
			this.createToolbarButton(toolbar, "video", "Insert video", variable.name);
			this.createToolbarButton(toolbar, "music", "Insert audio", variable.name);

			// Textarea
			const textarea = fieldWrapper.createEl("textarea", {
				cls: "flashcard-textarea-full-width",
				attr: {
					placeholder: `Enter ${variable.name}...`,
					rows: "3",
				},
			});
			textarea.value = this.fields[variable.name] ?? "";

			textarea.addEventListener("input", () => {
				this.fields[variable.name] = textarea.value;
			});

			textarea.addEventListener("focus", () => {
				this.activeTextarea = textarea;
			});

			// Paste handler for images
			textarea.addEventListener("paste", (e) =>
				this.handlePaste(e, textarea, variable.name),
			);

			// Add [[ link suggestions
			const suggest = new TextareaSuggest(this.app, textarea);
			this.textareaSuggests.push(suggest);
		}

		// Button container
		const buttonContainer = contentEl.createDiv({
			cls: "flashcard-modal-buttons",
		});

		// Create button
		new ButtonComponent(buttonContainer)
			.setButtonText("Create")
			.setCta()
			.onClick(() => {
				this.close();
				this.onSubmit(this.fields, false);
			});

		// Create & Add Another button
		new ButtonComponent(buttonContainer)
			.setButtonText("Create & add another")
			.onClick(() => {
				this.onSubmit({ ...this.fields }, true);
				// Clear fields for next card
				for (const variable of this.template.variables) {
					this.fields[variable.name] = "";
				}
				this.onOpen(); // Refresh the form
			});

		// Cancel button
		new ButtonComponent(buttonContainer)
			.setButtonText("Cancel")
			.onClick(() => this.close());

		// Focus first field
		const firstInput = contentEl.querySelector("textarea");
		if (firstInput) {
			(firstInput as HTMLTextAreaElement).focus();
			this.activeTextarea = firstInput as HTMLTextAreaElement;
		}
	}

	onClose() {
		// Clean up suggests
		this.textareaSuggests.forEach((s) => s.destroy());
		this.textareaSuggests = [];

		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Create a toolbar button for uploading media from the system.
	 */
	private createToolbarButton(
		toolbar: HTMLElement,
		icon: string,
		tooltip: string,
		fieldName: string,
	): void {
		const mediaType: MediaType =
			icon === "image" ? "image" : icon === "video" ? "video" : "audio";

		new ExtraButtonComponent(toolbar)
			.setIcon(icon)
			.setTooltip(tooltip)
			.onClick(() => {
				this.openFilePicker(mediaType, fieldName);
			});
	}

	/**
	 * Open a native file picker to select a file from the user's system.
	 */
	private openFilePicker(mediaType: MediaType, fieldName: string): void {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = MEDIA_ACCEPT[mediaType];
		input.style.display = "none";

		input.addEventListener("change", async () => {
			const file = input.files?.[0];
			if (!file) return;

			try {
				await this.saveFileToVault(file, fieldName);
			} catch (error) {
				console.error("Failed to save file:", error);
				new Notice("Failed to save file");
			} finally {
				input.remove();
			}
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
		const path = `${this.attachmentFolder}/${filename}`;

		// Ensure attachment folder exists
		await this.ensureFolderExists(this.attachmentFolder);

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
		const wrappers = this.contentEl.querySelectorAll(
			".flashcard-field-wrapper",
		);
		const index = this.template.variables.findIndex(
			(v) => v.name === fieldName,
		);
		if (index >= 0 && wrappers[index]) {
			return wrappers[index].querySelector("textarea");
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
			// Handle images, videos, and audio
			if (
				item.type.startsWith("image/") ||
				item.type.startsWith("video/") ||
				item.type.startsWith("audio/")
			) {
				event.preventDefault();

				const blob = item.getAsFile();
				if (!blob) continue;

				try {
					const buffer = await blob.arrayBuffer();
					const mimeType = item.type;
					const extension = this.getExtensionFromMime(mimeType);
					const filename = `${generateUUID()}.${extension}`;
					const path = `${this.attachmentFolder}/${filename}`;

					// Ensure attachment folder exists
					await this.ensureFolderExists(this.attachmentFolder);

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
	private insertAtCursor(
		textarea: HTMLTextAreaElement,
		text: string,
	): void {
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
