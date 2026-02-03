import {
	ButtonComponent,
	ItemView,
	WorkspaceLeaf,
	setIcon,
	Notice,
	debounce,
	TFolder,
} from "obsidian";
import type FlashcardsPlugin from "../main";
import type { Deck } from "../types";
import { DeckSelectorModal } from "./DeckSelectorModal";
import { TemplateSelectorModal } from "./TemplateSelectorModal";
import { CardCreationModal } from "./CardCreationModal";

export const DASHBOARD_VIEW_TYPE = "flashcards-dashboard";

/**
 * Main dashboard view showing decks and their stats.
 */
export class DashboardView extends ItemView {
	plugin: FlashcardsPlugin;
	private debouncedRender: () => void;

	constructor(leaf: WorkspaceLeaf, plugin: FlashcardsPlugin) {
		super(leaf);
		this.plugin = plugin;
		// Debounce render to avoid excessive updates during batch operations
		this.debouncedRender = debounce(() => void this.render(), 300, true);
	}

	getViewType(): string {
		return DASHBOARD_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Flashcards";
	}

	getIcon(): string {
		return "layers";
	}

	async onOpen() {
		// Register vault events for auto-refresh
		this.registerEvent(
			this.app.vault.on("create", () => this.debouncedRender()),
		);
		this.registerEvent(
			this.app.vault.on("delete", () => this.debouncedRender()),
		);
		this.registerEvent(
			this.app.vault.on("rename", () => this.debouncedRender()),
		);
		this.registerEvent(
			this.app.vault.on("modify", () => this.debouncedRender()),
		);

		await this.render();
	}

	async onClose() {
		// Cleanup if needed
	}

	async render() {
		const container = this.containerEl.children[1] as HTMLElement;
		if (!container) return;

		container.empty();
		container.addClass("flashcard-dashboard");

		// Header with toolbar
		const header = container.createDiv({
			cls: "flashcard-dashboard-header",
		});

		header.createEl("h2", { text: "Flashcards" });

		const toolbar = header.createDiv({
			cls: "flashcard-dashboard-toolbar",
		});

		// Add Card button
		new ButtonComponent(toolbar)
			.setButtonText("Add card")
			.setIcon("plus")
			.setCta()
			.onClick(() => this.startCardCreation());

		// Deck list
		const deckList = container.createDiv({ cls: "flashcard-deck-list" });

		const decks = this.plugin.deckService.discoverDecks();

		if (decks.length === 0) {
			const emptyState = deckList.createDiv({
				cls: "flashcard-empty-state",
			});
			emptyState.createEl("p", { text: "No flashcards yet." });
			emptyState.createEl("p", {
				text: "Create your first card to get started!",
			});

			new ButtonComponent(emptyState)
				.setButtonText("Create first card")
				.setCta()
				.onClick(() => this.startCardCreation());
		} else {
			this.renderDeckList(deckList, decks);
		}
	}

	private renderDeckList(container: HTMLElement, decks: Deck[]) {
		// Group decks by depth for hierarchical display
		const rootDecks = decks.filter((d) => !d.path.includes("/"));
		const childDecks = new Map<string, Deck[]>();

		for (const deck of decks) {
			if (deck.path.includes("/")) {
				const parentPath = deck.path.split("/").slice(0, -1).join("/");
				if (!childDecks.has(parentPath)) {
					childDecks.set(parentPath, []);
				}
				childDecks.get(parentPath)!.push(deck);
			}
		}

		const renderDeck = (deck: Deck, depth: number = 0) => {
			const deckEl = container.createDiv({ cls: "flashcard-deck-item" });
			deckEl.style.paddingLeft = `${depth * 20}px`;

			// Deck info
			const infoEl = deckEl.createDiv({ cls: "flashcard-deck-info" });

			const nameEl = infoEl.createSpan({
				cls: "flashcard-deck-name flashcard-deck-name-link",
			});
			setIcon(nameEl, "folder");
			nameEl.createSpan({ text: ` ${deck.name}` });
			nameEl.setAttr("role", "button");
			nameEl.setAttr("tabindex", "0");
			nameEl.setAttr("title", "Reveal in file explorer");
			nameEl.setAttr("aria-label", "Reveal in file explorer");
			nameEl.addEventListener("click", (event) => {
				event.stopPropagation();
				void this.revealDeckInFileExplorer(deck.path);
			});
			nameEl.addEventListener("keydown", (event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					void this.revealDeckInFileExplorer(deck.path);
				}
			});

			// Stats badges
			const statsEl = infoEl.createDiv({ cls: "flashcard-deck-stats" });

			if (deck.stats.new > 0) {
				statsEl.createSpan({
					text: `${deck.stats.new}`,
					cls: "flashcard-stat flashcard-stat-new",
				});
			}
			if (deck.stats.learning > 0) {
				statsEl.createSpan({
					text: `${deck.stats.learning}`,
					cls: "flashcard-stat flashcard-stat-learning",
				});
			}
			if (deck.stats.due > 0) {
				statsEl.createSpan({
					text: `${deck.stats.due}`,
					cls: "flashcard-stat flashcard-stat-due",
				});
			}

			// Actions
			const actionsEl = deckEl.createDiv({
				cls: "flashcard-deck-actions",
			});

			const studyBtnComponent = new ButtonComponent(actionsEl)
				.setButtonText("Study")
				.setClass("flashcard-btn-small")
				.onClick(() => {
					void this.plugin.startReview(deck.path);
				});
			// Stop propagation on the button element
			studyBtnComponent.buttonEl.addEventListener("click", (e) =>
				e.stopPropagation(),
			);

			// Render children
			const children = childDecks.get(deck.path);
			if (children) {
				for (const child of children) {
					renderDeck(child, depth + 1);
				}
			}
		};

		for (const deck of rootDecks) {
			renderDeck(deck);
		}
	}

	private async revealDeckInFileExplorer(deckPath: string) {
		const folder = this.app.vault.getAbstractFileByPath(deckPath);
		if (!(folder instanceof TFolder)) {
			new Notice(`Folder not found: ${deckPath}`);
			return;
		}

		let leaf: WorkspaceLeaf | null =
			this.app.workspace.getLeavesOfType("file-explorer")[0] ?? null;
		if (!leaf) {
			leaf = this.app.workspace.getLeftLeaf(false);
			if (leaf) {
				await leaf.setViewState({
					type: "file-explorer",
					active: true,
				});
			}
		}

		if (!leaf) return;
		void this.app.workspace.revealLeaf(leaf);

		const view = leaf.view as unknown as {
			revealInFolder?: (file: unknown) => void;
		};

		view.revealInFolder?.(folder);
	}

	private startCardCreation() {
		// Step 1: Select deck
		new DeckSelectorModal(
			this.app,
			this.plugin.deckService,
			(deckResult) => {
				const deckPath = deckResult.path;

				// Step 2: Select template
				void this.plugin.templateService
					.getTemplates(this.plugin.settings.templateFolder)
					.then((templates) => {
						if (templates.length === 0) {
							// No templates found - show error
							const templateFolder =
								this.plugin.settings.templateFolder;
							new Notice(
								`No templates found in "${templateFolder}". Please create a template first.`,
							);
							return;
						}

						if (templates.length === 1) {
							// Only one template, use it directly
							const template = templates[0];
							if (template) {
								this.showCardCreationModal(template, deckPath);
							}
						} else {
							new TemplateSelectorModal(
								this.app,
								templates,
								(template) => {
									this.showCardCreationModal(
										template,
										deckPath,
									);
								},
							).open();
						}
					});
			},
		).open();
	}

	private showCardCreationModal(
		template: import("../types").FlashcardTemplate,
		deckPath: string,
	) {
		new CardCreationModal(
			this.app,
			template,
			deckPath,
			(fields, createAnother) => {
				void this.plugin.cardService
					.createCard(
						deckPath,
						template.path,
						fields,
						this.plugin.settings.noteNameTemplate,
					)
					.then(async () => {
						new Notice("Card created!");

						// Update last used deck
						this.plugin.settings.lastUsedDeck = deckPath;
						await this.plugin.saveSettings();

						// Refresh dashboard
						await this.render();

						if (createAnother) {
							this.showCardCreationModal(template, deckPath);
						}
					})
					.catch((error: Error) => {
						new Notice(`Failed to create card: ${error.message}`);
					});
			},
		).open();
	}
}
