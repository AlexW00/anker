import { App, ButtonComponent, Modal, Notice } from "obsidian";
import type { TFile } from "obsidian";

export class OrphanAttachmentsModal extends Modal {
	private files: TFile[];
	private attachmentFolder: string;
	private onConfirm: () => Promise<void>;

	constructor(
		app: App,
		files: TFile[],
		attachmentFolder: string,
		onConfirm: () => Promise<void>,
	) {
		super(app);
		this.files = files;
		this.attachmentFolder = attachmentFolder;
		this.onConfirm = onConfirm;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("flashcard-orphan-modal");

		contentEl.createEl("h2", { text: "Delete unused attachments" });
		contentEl.createEl("p", {
			text: `Found ${this.files.length} unused attachment${
				this.files.length === 1 ? "" : "s"
			} in "${this.attachmentFolder}".`,
		});

		const list = contentEl.createEl("ul", {
			cls: "flashcard-orphan-list",
		});
		this.files.forEach((file) => {
			const item = list.createEl("li");
			const link = item.createEl("a", {
				text: file.path,
				cls: "flashcard-orphan-link",
				href: "#",
			});
			link.addEventListener("click", (event) => {
				event.preventDefault();
				void this.app.workspace.getLeaf().openFile(file);
			});
		});

		const buttonRow = contentEl.createDiv({
			cls: "flashcard-modal-buttons-v2",
		});
		const leftButtons = buttonRow.createDiv({
			cls: "flashcard-buttons-left",
		});
		const rightButtons = buttonRow.createDiv({
			cls: "flashcard-buttons-right",
		});

		const cancelBtn = new ButtonComponent(leftButtons)
			.setButtonText("Cancel")
			.onClick(() => this.close());

		new ButtonComponent(rightButtons)
			.setButtonText("Delete all")
			.setWarning()
			.onClick(async () => {
				cancelBtn.setDisabled(true);
				try {
					await this.onConfirm();
					new Notice(
						`Deleted ${this.files.length} unused attachment${
							this.files.length === 1 ? "" : "s"
						}.`,
					);
					this.close();
				} catch (error) {
					console.error("Failed to delete attachments", error);
					new Notice("Failed to delete unused attachments");
					cancelBtn.setDisabled(false);
				}
			});
	}

	onClose() {
		this.contentEl.empty();
	}
}
