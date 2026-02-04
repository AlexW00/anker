# Anki import format (Anki 2.1.50+)

## Supported export
- **Only** Anki 2.1.50+ exports are supported.
- The package must contain **collection.anki21b** (zstd-compressed SQLite).
- Older formats (**collection.anki21**, **collection.anki2**) are not supported.

## Database format (anki21b)
- The SQLite DB is **zstd-compressed** and must be decompressed before opening.
- Schema is **new-style** (no JSON blobs in `col`).

### Key tables used
- `notetypes` — note type definitions (config protobuf)
- `fields` — field names by notetype
- `templates` — card templates by notetype (config protobuf)
- `notes` — note content (fields separated by `\x1f`)
- `cards` — card instances (deck id, template ordinal)
- `decks` — deck names

### Template config (protobuf)
- `templates.config` is a protobuf blob:
  - field 1 = `qfmt` (front / question HTML)
  - field 2 = `afmt` (back / answer HTML)

### Notetype config (protobuf)
- `notetypes.config` contains the note kind:
  - field 4 = kind (`0` = normal, `1` = cloze)

## Media mapping
- `media` file is protobuf (may be zstd-compressed).
- Maps numeric filenames in the ZIP to original media filenames.

## Conversion pipeline summary
1. Load ZIP, ensure `collection.anki21b` exists.
2. Decompress DB (zstd) and open SQLite.
3. Read `notetypes`, `fields`, `templates`, `notes`, `cards`, `decks`.
4. Convert template HTML to Nunjucks markdown.
5. Convert note field HTML to markdown and map media references.
6. Create flashcard files with frontmatter + rendered body.
