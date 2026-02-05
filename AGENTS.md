# Anker Plugin

## Index

- **Entry point**: [src/main.ts](src/main.ts)
- **Settings**: [src/settings.ts](src/settings.ts)
- **Types**: [src/types.ts](src/types.ts)
- **Flashcards**: [src/flashcards/](src/flashcards/)
- **SRS**: [src/srs/](src/srs/)
- **UI**: [src/ui/](src/ui/)
- **Services**: [src/services/](src/services/)
- **Docs**: [docs/dev/](docs/dev/)
- **Build config**: [esbuild.config.mjs](esbuild.config.mjs)
- **Plugin metadata**: [manifest.json](manifest.json), [versions.json](versions.json)

## Project overview

Obsidian community plugin for spaced repetition flashcards using FSRS. The plugin uses a **hydration model**: frontmatter is the source of truth and the Markdown body is generated from templates.

## How it works (high level)

- Card creation writes frontmatter and regenerates body from templates.
- Reviews update scheduling in frontmatter.
- Template changes regenerate body.

## Hooks (run after changes)

- **Lint**: `npm run lint`
- **Typecheck**: `npm run typecheck`
- **Build (when needed)**: `npm run build`

## Key conventions

- Flashcards live in Markdown files with frontmatter fields like `_type`, `_template`, `_review`.
- Template variables use Nunjucks `{{ variable }}` syntax.
- Generated content starts with `<!-- flashcard-content: DO NOT EDIT BELOW -->`.

## Best practices (non-obvious)

- Keep [src/main.ts](src/main.ts) minimal (lifecycle + registration only).
- Prefer Obsidian UI components (modals, settings, inputs) over custom HTML/CSS when possible.
- Use `this.register*` helpers to clean up listeners and intervals.
- Avoid unnecessary network calls. If required, document and provide opt-in.
- Keep changes mobile-safe

## Obsidian API reference

- API docs: https://docs.obsidian.md
- When unsure about an API or UI pattern, consult the docs and reuse official components before building custom UI.

## Commands and releases

- Add user-facing commands via `this.addCommand(...)` with stable IDs.
- Bump `manifest.json` version and update `versions.json` together.
- Release artifacts: `main.js`, `manifest.json`, optional `styles.css`.
