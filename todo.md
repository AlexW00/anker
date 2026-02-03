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
