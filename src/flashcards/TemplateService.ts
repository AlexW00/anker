import { App, TFile, TFolder } from "obsidian";
import nunjucks from "nunjucks";
import type { FlashcardTemplate, TemplateVariable } from "../types";

/**
 * Service for managing flashcard templates and Nunjucks rendering.
 */
export class TemplateService {
	private app: App;
	private env: nunjucks.Environment;

	constructor(app: App) {
		this.app = app;
		// Configure Nunjucks with autoescape disabled (we're generating Markdown, not HTML)
		this.env = new nunjucks.Environment(null, {
			autoescape: false,
			trimBlocks: true,
			lstripBlocks: true,
		});
	}

	/**
	 * Extract variable names from a Nunjucks template using regex.
	 * Matches {{ variable }} and {{ variable | filter }} patterns.
	 */
	extractVariables(templateContent: string): TemplateVariable[] {
		const variableRegex =
			/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:\|[^}]*)?\}\}/g;
		const variables = new Map<string, TemplateVariable>();

		let match;
		while ((match = variableRegex.exec(templateContent)) !== null) {
			const name = match[1];
			if (!name) continue;
			// Skip built-in Nunjucks variables and loop variables
			if (
				!["loop", "super", "self", "true", "false", "none"].includes(
					name,
				)
			) {
				if (!variables.has(name)) {
					variables.set(name, { name });
				}
			}
		}

		return Array.from(variables.values());
	}

	/**
	 * Render a template with the given fields.
	 */
	render(templateContent: string, fields: Record<string, string>): string {
		return this.env.renderString(templateContent, fields);
	}

	/**
	 * Get all template files from the specified folder.
	 */
	async getTemplates(templateFolder: string): Promise<FlashcardTemplate[]> {
		const templates: FlashcardTemplate[] = [];
		const folder = this.app.vault.getAbstractFileByPath(templateFolder);

		if (!(folder instanceof TFolder)) {
			return templates;
		}

		for (const file of folder.children) {
			if (file instanceof TFile && file.extension === "md") {
				const content = await this.app.vault.read(file);
				templates.push({
					path: file.path,
					name: file.basename,
					variables: this.extractVariables(content),
					content,
				});
			}
		}

		return templates;
	}

	/**
	 * Load a template by path.
	 */
	async loadTemplate(
		templatePath: string,
	): Promise<FlashcardTemplate | null> {
		// Handle WikiLink format: [[path]] or [[path|alias]]
		const cleanPath = this.resolveWikiLink(templatePath);

		const file = this.app.vault.getAbstractFileByPath(cleanPath);
		if (!(file instanceof TFile)) {
			// Try adding .md extension
			const fileWithExt = this.app.vault.getAbstractFileByPath(
				cleanPath + ".md",
			);
			if (!(fileWithExt instanceof TFile)) {
				return null;
			}
			const content = await this.app.vault.read(fileWithExt);
			return {
				path: fileWithExt.path,
				name: fileWithExt.basename,
				variables: this.extractVariables(content),
				content,
			};
		}

		const content = await this.app.vault.read(file);
		return {
			path: file.path,
			name: file.basename,
			variables: this.extractVariables(content),
			content,
		};
	}

	/**
	 * Resolve a WikiLink to a clean file path.
	 * Handles [[path]], [[path|alias]], and plain paths.
	 */
	private resolveWikiLink(link: string): string {
		// Remove [[ and ]] if present
		const path = link.replace(/^\[\[|\]\]$/g, "");
		// Remove alias if present (everything after |)
		const parts = path.split("|");
		return (parts[0] ?? path).trim();
	}

	/**
	 * Generate a note name from the template.
	 */
	generateNoteName(template: string): string {
		const now = new Date();
		const date = now.toISOString().split("T")[0] ?? "unknown"; // YYYY-MM-DD
		const timeParts = now.toTimeString().split(" ");
		const time = (timeParts[0] ?? "00-00-00").replace(/:/g, "-"); // HH-MM-SS
		const timestamp = now.getTime().toString();

		return template
			.replace(/\{\{date\}\}/g, date)
			.replace(/\{\{time\}\}/g, time)
			.replace(/\{\{timestamp\}\}/g, timestamp);
	}

	/**
	 * Ensure the template folder exists and contains at least a Basic template.
	 * Creates the folder and Basic template if they don't exist.
	 */
	async ensureDefaultTemplate(templateFolder: string): Promise<void> {
		// Check if folder exists
		let folder = this.app.vault.getAbstractFileByPath(templateFolder);

		// Create folder if it doesn't exist
		if (!folder) {
			try {
				await this.app.vault.createFolder(templateFolder);
			} catch {
				// Folder may already exist on disk but not indexed yet
			}
			folder = this.app.vault.getAbstractFileByPath(templateFolder);
		}

		if (!(folder instanceof TFolder)) {
			return;
		}

		// Check if folder has any template files
		const hasTemplates = folder.children.some(
			(file) => file instanceof TFile && file.extension === "md",
		);

		if (!hasTemplates) {
			await this.createBasicTemplate(templateFolder);
		}
	}

	/**
	 * Create the default Basic template with usage tips.
	 */
	private async createBasicTemplate(templateFolder: string): Promise<void> {
		const basicTemplatePath = `${templateFolder}/Basic.md`;
		const basicTemplateContent = `# {{ front }}

---

{{ back }}

<!--
## Template Tips

This is a Basic flashcard template using Nunjucks syntax.

### How templates work:
- Variables are wrapped in {{ double_braces }}
- When creating a card, you'll be prompted to fill in each variable
- The content above the --- is shown as the question
- The content below the --- is revealed as the answer

### Creating your own templates:
1. Create a new .md file in this folder
2. Use {{ variable_name }} for any fields you want to fill in
3. Use --- to separate the front (question) from the back (answer)

### Example: Vocabulary Template
# {{ word }}

*{{ part_of_speech }}*

---

**Definition:** {{ definition }}

**Example:** {{ example_sentence }}

### Example: Cloze Template
{{ context_before }} [...] {{ context_after }}

---

{{ context_before }} **{{ answer }}** {{ context_after }}

For more information, see the plugin documentation.
-->
`;

		await this.app.vault.create(basicTemplatePath, basicTemplateContent);
	}
}
