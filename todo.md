## Todos

- **AI-assisted templating (optional):**
    - **Custom Nunjucks Filters:** Implement an async filter `| aiGenerate`.
        - _Usage:_ `{{ "Translate this to french" | aiGenerate }}`
        - _Implementation:_ Plugin registers an async Nunjucks filter that calls the configured AI provider API.
- **AI Integration Settings:**
    - **Provider:** (OpenAI, Anthropic, Local, etc.)
    - **API Key:** Secure storage.
    - **Model:** Select model (e.g., GPT-4o, Claude 3.5).
- Add edit card command (i.e. opens create card modal but with the fields filled out and linked to the card> make the modal generic?!)
- Anki import?!
