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
    - field 1 = kind (`0` = normal, `1` = cloze)

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

## Test fixture: example-export.apkg

The file `resources/example-export.apkg` is used for integration testing. It contains a variety of data to exercise the import pipeline, including examples of all supported Anki note types.

### Contents

**Decks (3)**

| ID            | Name                 |
| ------------- | -------------------- |
| 1             | Default              |
| 1770302890374 | Default::nested deck |
| 1770395230113 | neighbor             |

**Note Types (7)**

| Name                         | Type         | Fields                                           | Templates |
| ---------------------------- | ------------ | ------------------------------------------------ | --------- |
| Basic                        | Standard (0) | Front, Back                                      | 1         |
| Basic (and reversed card)    | Standard (0) | Front, Back                                      | 2         |
| Basic (optional reversed card) | Standard (0) | Front, Back, Add Reverse                       | 2         |
| Basic (type in the answer)   | Standard (0) | Front, Back                                      | 1         |
| Cloze                        | Cloze (1)    | Text, Back Extra                                 | 1         |
| Image Occlusion              | Cloze (1)    | Occlusion, Image, Header, Back Extra, Comments   | 1         |
| Custom                       | Standard (0) | Front, Back, Comment, Image                      | 1         |

**Notes (7)**

1. **Custom note** (deck: Default) — Contains:
    - HTML formatting (`<ul>`, `<b>`, `<br>`)
    - Furigana with ruby annotation
    - Image reference (`<img src="...png">`)
    - Tags: `ddd`, `tag2`

2. **Cloze note** (deck: Default) — Contains:
    - Cloze deletion: `{{c1::hidden}}`
    - Back Extra field

3. **Basic note** (deck: nested deck) — Simple text in Front/Back fields

4. **Basic (and reversed card) note** (deck: neighbor) — Contains:
    - Front: `basic`
    - Back: `and reverse`
    - Creates 2 cards (one for each direction)

5. **Basic (optional reversed card) note** (deck: neighbor) — Contains:
    - Front: `basic`
    - Back: `optional`
    - Add Reverse: `reverse`
    - Creates 2 cards (reverse card is generated because Add Reverse field is non-empty)

6. **Basic (type in the answer) note** (deck: neighbor) — Contains:
    - Front: `baisc` (typo intentional, matches fixture)
    - Back: `type in the answer`
    - Template uses `{{type:Back}}` syntax (stripped during conversion)

7. **Image Occlusion note** (deck: neighbor) — Contains:
    - Occlusion: `{{c1::image-occlusion:rect:left=.4059:top=.4105:width=.5093:height=.463:oi=1}}`
    - Image: same PNG as Custom note
    - Header, Back Extra, Comments: empty
    - Note: Occlusion masks are not supported; imports as regular image card

**Cards (9)**

| Note Type                    | Card Count | Notes                                  |
| ---------------------------- | ---------- | -------------------------------------- |
| Custom                       | 1          | Single card                            |
| Cloze                        | 1          | Single cloze deletion                  |
| Basic                        | 1          | Single card                            |
| Basic (and reversed card)    | 2          | Card 1 (Front→Back), Card 2 (Back→Front) |
| Basic (optional reversed card) | 2        | Card 1 + optional Card 2               |
| Basic (type in the answer)   | 1          | Single card (type feature stripped)    |
| Image Occlusion              | 1          | Single occlusion region                |

**Media (1)**

| Key | Filename                                     |
| --- | -------------------------------------------- |
| 0   | 9f1b5b46aed533f5386cf276ab2cdce48cbd2e25.png |

The media file is zstd-compressed in the ZIP and is a PNG image.

### Unsupported features

The following Anki features are imported but their interactive functionality is not preserved:

- **Image Occlusion**: Occlusion masks are converted to highlight syntax (`==...==`). The base image is preserved but the masking/reveal behavior does not work during review.
- **Type in the answer**: The `{{type:Field}}` syntax is stripped and the field is displayed as plain text. No input field is rendered during review.

### Inspecting the fixture

To manually inspect the apkg contents:

```bash
# Extract the ZIP
unzip resources/example-export.apkg -d /tmp/apkg-explore

# Decompress and open the database
cd /tmp/apkg-explore
zstd -d collection.anki21b -o collection.db
sqlite3 collection.db

# Useful queries
.tables
SELECT id, name FROM decks;
SELECT id, name FROM notetypes;
SELECT ntid, ord, name FROM fields ORDER BY ntid, ord;
SELECT id, mid, tags, flds FROM notes;
```

### Adding test data

When adding new test cases to the fixture:

1. Create content in Anki Desktop (2.1.50+)
2. Export with "Include media" enabled
3. Replace `resources/example-export.apkg`
4. Update this documentation section
5. Update integration tests in `src/services/AnkiImport.integration.test.ts`
