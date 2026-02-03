## 8. Future (Post-MVP)

- **AI-assisted templating (optional):**
    - **Custom Nunjucks Filters:** Implement an async filter `| aiGenerate`.
        - _Usage:_ `{{ "Translate this to french" | aiGenerate }}`
        - _Implementation:_ Plugin registers an async Nunjucks filter that calls the configured AI provider API.
- **AI Integration Settings:**
    - **Provider:** (OpenAI, Anthropic, Local, etc.)
    - **API Key:** Secure storage.
    - **Model:** Select model (e.g., GPT-4o, Claude 3.5).
- Update Dashboard so that:
    - folders can be collapsed/expanded when clicking on the folder icon (also changes icon); clicking on the text still opens the deck

- Update the review mode so that it does not filter cards by status (e.g. only new cards), but instead shows all cards that are due for review (including new cards or re-review etc.).
- Also I noticed that sometimes when reviewing a deck it would finish and then when I go back to the dashboard there's still cards left for review for example in that deck and it is because the due date is like a few minutes in the future but still on the same day and so I want the behavior to change so that it's like in Anki that when you finish a deck there is no more cards due on that day. So maybe the due date shouldn't be seen so strictly, uh, but instead maybe used as some ordering key instead for that day. In essence, I wanted to behave like Anki.

nitpicks

- shadow of review card in darkmode looks bad / off
