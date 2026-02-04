import type { AiProviderType } from "../types";

export function getDefaultTextModel(type: AiProviderType): string {
	switch (type) {
		case "openai":
			return "gpt-5-mini";
		case "anthropic":
			return "claude-haiku-4.5";
		case "google":
			return "gemini-3-flash";
		case "openrouter":
			return "openai/gpt-5-mini";
		default:
			return "gpt-5-mini";
	}
}

export function getDefaultImageModel(type: AiProviderType): string {
	switch (type) {
		case "openai":
			return "dall-e-3"; // Still the standard, ~$0.04-0.08 per image
		case "google":
			return "imagen-4.0-generate-001"; // Google's latest, ~$0.03 per image
		default:
			return "dall-e-3";
	}
}

export function getDefaultSpeechModel(type: AiProviderType): string {
	switch (type) {
		case "openai":
			return "gpt-4o-mini-tts"; // New 2026 model with better steerability
		default:
			return "gpt-4o-mini-tts";
	}
}
