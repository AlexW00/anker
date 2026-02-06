# Native Review Implementation

This document describes the implementation of the native review system in Anker, which replaced the previous `ItemView`-based approach.

## Overview

The native review system allows flashcards to be reviewed directly within Obsidian's standard `MarkdownView` (preview mode). This change was made to ensure that all community plugin post-processors (like Dataview, Diagrams, LaTeX, etc.) render correctly, which was not possible with the isolated `ItemView`.

## Architecture

The system is split into two main components:

1. **`ReviewSessionManager`** (Service)
    - Manages the state of the active review session.
    - Handles FSRS scheduling logic and deck queue management.
    - Emits events (`session-started`, `side-revealed`, `card-changed`) to coordinate UI updates.
    - **File**: `src/services/ReviewSessionManager.ts`

2. **`FlashcardPreviewComponent`** (UI)
    - A component that attaches to Obsidian's workspace.
    - Monitors active Markdown views and "decorates" them if they are flashcards in an active review session.
    - Manipulates the native preview DOM to hide/show content progressively.
    - Injects review controls (buttons, progress bar) as overlays.
    - **File**: `src/ui/FlashcardPreviewComponent.ts`

## DOM Manipulation Strategy

Instead of re-rendering markdown manually (which bypasses other plugins), we let Obsidian render the full note naturally in Preview Mode, and then apply CSS classes to hide specific parts.

### Content Hiding

The `FlashcardPreviewComponent` inspects the rendered DOM `markdown-preview-sizer`:

1. **Metadata & Title**: Explicitly hides `.metadata-container` and `.inline-title` using the `.anker-hidden-side` class during review.
2. **Side Splitting**: Identifies `<hr>` elements as side separators.
3. **Progressive Reveal**:
    - Loops through all child elements of the preview container.
    - Assigns each element to a "side" index based on preceding `<hr>` tags.
    - Applies `.anker-hidden-side` to all elements belonging to sides greater than the current session index.
    - Removes the class when `revealNext()` is called.

### CSS Classes

Defined in `src/styles/_review.css`:

- `.anker-flashcard-wrapper`: Wraps the native preview.
- `.anker-review-active`: Applied when a review session is active for the current file.
- `.anker-hidden-side`: `display: none !important` - used to hide future sides and metadata.
- `.flashcard-side-separator`: Styling for the `<hr>` elements (dashed line).

## Implementation Notes and Learnings

These notes capture subtle behaviors in Obsidian's preview rendering and the review decoration lifecycle. They are here to prevent regressions.

### Render Timing and Flicker Prevention

- The preview DOM can render in multiple passes. The initial `file-open` event can fire before the `.markdown-preview-sizer` has children, which can briefly expose full content.
- The review UI should keep the preview hidden until decoration completes. Use `body.anker-review-card-loading` and remove it only after `.anker-decorated` is applied.
- A `MutationObserver` on `.markdown-preview-sizer` is used to re-run decoration after the preview finishes rendering. This avoids race conditions that cause the full card to show.

### Side Separation Detection

- Obsidian renders markdown separators (`---`) as `<div class="el-hr"><hr></div>`, not always as direct `<hr>` children.
- Side splitting must detect separators in wrapper elements, not just `:scope > hr`.
- If separators are missed, the card looks like a single-side card and the UI will show rating buttons immediately.

### Metadata and Title Visibility

- Metadata (`.metadata-container`) and the inline title can flash briefly during preview render.
- Hide these at the leaf level in review mode, not only during per-card decoration.

## Review Session Flow

1. **Start**: User selects a deck. `ReviewSessionManager.startSession()` fetches due cards.
2. **Navigation**: The manager opens the first card file in a standard Obsidian tab using `leaf.openFile()`.
3. **Decoration**: `FlashcardPreviewComponent` detects the file open event, checks if it matches the current session card, and applies DOM hiding.
4. **Interaction**:
    - **Reveal**: User presses Space or clicks content. `ReviewSessionManager` increments `currentSide`. The component updates DOM visibility.
    - **Rate**: User selects a rating (1-4). `ReviewSessionManager` updates FSRS data, saves to frontmatter, and navigates to the next card file.
5. **Completion**: When cues are empty, a completion screen is shown overlaying the last card.

## key Advantages

- **Plugin Compatibility**: Any content that renders in a normal Obsidian note will work in a flashcard (Dataview, Excalidraw, etc.).
- **Theme Compatibility**: Since it uses standard DOM elements, it inherits the user's theme for fonts/colors naturally.
- **Maintainability**: We no longer maintain a separate markdown rendering pipeline.
