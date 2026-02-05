# Review System Bugs

Analysis based on console logs from a review session with 5 cards.

---

## Bug 1: Metadata Cache Race Condition (Critical)

**Symptom**: After `updateReviewState()` writes new frontmatter to disk, immediately calling `getDueCards()` returns stale data from the metadata cache.

**Evidence**:

```
[Anker:rateCard] t=12ms updateReviewState done
[Anker:rateCard] t=12ms metadataCache AFTER update (may be stale): {"due":"2026-02-05T23:02:08.567Z"...}
[Anker:rateCard] CACHE STALE? YES - cache has due=2026-02-05T23:02:08.567Z, expected=2026-02-06T23:17:15.585Z
```

This happens on **every single rating** in the logs. The cache takes ~1 second to update, but we call `getDueCards()` within ~17ms.

**Impact**:

- Cards may reappear with stale scheduling data
- Cards that are still due may be incorrectly excluded
- Progress bar may not update correctly

---

## Bug 2: Card Disappears from Session When Still Due

**Symptom**: When rating a card "Hard" (or any rating that keeps it due today), the card disappears from the session instead of staying.

**Evidence**:

```
[Anker:rateCard] card=Anker/example-notes/flashcards/basic-card.md, sessionCards=4
[Anker:rateCard] t=1ms newState due=2026-02-05T23:23:17.484Z, state=1
[Anker:rateCard] t=9ms isDue=true (based on newState, not cache)
[Anker:rateCard] t=10ms getDueCards returned 3 cards: [vocab-card-2.md, vocab-card.md, basic-card-5.md]
[Anker:rateCard] WARNING: card basic-card.md still due, but nextDueCards may have stale frontmatter
[Anker:rateCard] END - render complete, reviewedCount=1/5, sessionCards=3
```

- The card `basic-card.md` was rated Hard (state=1 Learning, due in 6 minutes)
- `isDue=true` confirms it should still be in the session
- But `getDueCards` only returned 3 cards, and `basic-card.md` is not included
- Session went from 4 cards to 3 cards incorrectly

**Root Cause**: `getDueCards()` reads from stale metadata cache which still has the OLD due date. Combined with the filtering logic, the card gets dropped.

---

## Bug 3: Auto-regeneration Fails During Review

**Symptom**: `Auto-regeneration failed: Error: Template not found: [[Basic]]`

**Evidence**: This error appears after each card rating, triggered by `handleMetadataChange`.

**Impact**:

- Console spam with error messages
- May interfere with review flow if not properly caught
- Cards referencing missing templates cannot be regenerated

**Note**: This is partly due to example cards referencing non-existent templates, but the error should be handled more gracefully.

---

## Bug 4: Missing Card IDs

**Symptom**: Some cards have empty `_id` fields in frontmatter.

**Evidence**:

```
[Anker:rateCard] card=Anker/example-notes/flashcards/basic-card-3.md, id=, sessionCards=5
[Anker:rateCard] card=Anker/example-notes/flashcards/basic-card.md, id=, sessionCards=4
[Anker:rateCard] card=Anker/example-notes/flashcards/vocab-card-2.md, id=cdb5b1b3-e03c-4fcb-b062-5243580c6624
```

**Impact**:

- Review history entries saved with empty cardId cannot be linked back to cards
- FSRS optimization may have incomplete data
- Card identity is unstable (relies on file path instead)

---

## Bug 5: reviewedCount Not Incrementing When Card Stays Due

**Symptom**: When a card is rated but remains due (e.g., Hard on a Learning card), `reviewedCount` is not incremented.

**Evidence**:

```
# First rating (Good on basic-card-3.md, not due anymore)
[Anker:rateCard] isDue=false (based on newState, not cache)
[Anker:rateCard] reviewedCount incremented to 1/5

# Second rating (Hard on basic-card.md, still due)
[Anker:rateCard] isDue=true (based on newState, not cache)
[Anker:rateCard] END - render complete, reviewedCount=1/5, sessionCards=3
```

The user reviewed a card but progress shows 1/5 instead of 2/5 because the card is still due.

**Impact**: Progress bar underreports actual reviews performed, confusing users.

---

## Summary Table

| Bug                                   | Severity | Category       | File(s)                       |
| ------------------------------------- | -------- | -------------- | ----------------------------- |
| Metadata cache race condition         | Critical | Race Condition | ReviewView.ts, DeckService.ts |
| Card disappears when still due        | High     | Logic Error    | ReviewView.ts                 |
| Auto-regeneration fails during review | Medium   | Error Handling | CardRegenService.ts           |
| Missing card IDs                      | Medium   | Data Integrity | Example cards / migration     |
| reviewedCount logic incorrect         | Low      | UX             | ReviewView.ts                 |

---

## Recommended Fixes

1. **Bug 1 & 2**: Don't rely on `getDueCards()` after rating. Either:
    - Wait for metadata cache to update before querying
    - Maintain session state locally and only update cards we know about
    - Read file content directly instead of using metadata cache

2. **Bug 3**: Skip auto-regeneration during active review, or catch template errors silently

3. **Bug 4**: Ensure all cards have IDs during import/creation; add migration for existing cards

4. **Bug 5**: Track "reviews performed" separately from "cards completed" in session state
