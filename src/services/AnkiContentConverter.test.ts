import { describe, it, expect, beforeEach } from "vitest";
import { AnkiContentConverter } from "./AnkiContentConverter";

describe("AnkiContentConverter", () => {
	let converter: AnkiContentConverter;
	let emptyMediaMap: Map<string, string>;

	beforeEach(() => {
		converter = new AnkiContentConverter();
		emptyMediaMap = new Map();
	});

	describe("convert", () => {
		it("should convert simple HTML paragraph to markdown", () => {
			const html = "<p>Hello world</p>";
			const result = converter.convert(html, emptyMediaMap);
			expect(result.markdown).toBe("Hello world");
			expect(result.mediaFiles.size).toBe(0);
		});

		it("should convert bold and italic", () => {
			const html = "<p><b>bold</b> and <i>italic</i></p>";
			const result = converter.convert(html, emptyMediaMap);
			expect(result.markdown).toBe("**bold** and *italic*");
		});

		it("should convert headers", () => {
			const html = "<h1>Title</h1><h2>Subtitle</h2>";
			const result = converter.convert(html, emptyMediaMap);
			expect(result.markdown).toContain("# Title");
			expect(result.markdown).toContain("## Subtitle");
		});

		it("should convert unordered lists", () => {
			const html = "<ul><li>Item 1</li><li>Item 2</li></ul>";
			const result = converter.convert(html, emptyMediaMap);
			expect(result.markdown).toContain("- Item 1");
			expect(result.markdown).toContain("- Item 2");
		});

		it("should convert ordered lists", () => {
			const html = "<ol><li>First</li><li>Second</li></ol>";
			const result = converter.convert(html, emptyMediaMap);
			expect(result.markdown).toContain("1. First");
			expect(result.markdown).toContain("2. Second");
		});

		it("should strip style tags", () => {
			const html = "<style>.card { color: red; }</style><p>Content</p>";
			const result = converter.convert(html, emptyMediaMap);
			expect(result.markdown).toBe("Content");
			expect(result.markdown).not.toContain("color");
		});

		it("should strip script tags", () => {
			const html = "<script>alert('hi')</script><p>Content</p>";
			const result = converter.convert(html, emptyMediaMap);
			expect(result.markdown).toBe("Content");
			expect(result.markdown).not.toContain("alert");
		});

		it("should handle divs with classes", () => {
			const html = '<div class="front"><div class="word">Hello</div></div>';
			const result = converter.convert(html, emptyMediaMap);
			expect(result.markdown).toBe("Hello");
		});

		it("should handle nested content", () => {
			const html =
				"<div><p><b>Bold</b> text</p><p>Another paragraph</p></div>";
			const result = converter.convert(html, emptyMediaMap);
			expect(result.markdown).toContain("**Bold** text");
			expect(result.markdown).toContain("Another paragraph");
		});
	});

	describe("convertClozes", () => {
		it("should convert basic cloze deletion", () => {
			const html = "<p>The capital of France is {{c1::Paris}}</p>";
			const result = converter.convert(html, emptyMediaMap);
			expect(result.markdown).toBe(
				"The capital of France is ==Paris=="
			);
		});

		it("should convert cloze with hint (discarding hint)", () => {
			const html = "<p>Water is {{c1::H2O::chemical formula}}</p>";
			const result = converter.convert(html, emptyMediaMap);
			expect(result.markdown).toBe("Water is ==H2O==");
		});

		it("should convert multiple clozes", () => {
			const html = "<p>{{c1::Dogs}} and {{c2::cats}} are pets</p>";
			const result = converter.convert(html, emptyMediaMap);
			expect(result.markdown).toBe("==Dogs== and ==cats== are pets");
		});

		it("should handle cloze with higher numbers", () => {
			const html = "<p>{{c10::Higher}} numbered cloze</p>";
			const result = converter.convert(html, emptyMediaMap);
			expect(result.markdown).toBe("==Higher== numbered cloze");
		});

		it("should trim whitespace in cloze answer", () => {
			const html = "<p>Answer: {{c1::  spaced  }}</p>";
			const result = converter.convert(html, emptyMediaMap);
			expect(result.markdown).toBe("Answer: ==spaced==");
		});
	});

	describe("processMediaReferences", () => {
		it("should convert img tag to WikiLink", () => {
			const html = '<img src="photo.jpg">';
			const result = converter.convert(html, emptyMediaMap);
			expect(result.markdown).toBe("![[photo.jpg]]");
			expect(result.mediaFiles.has("photo.jpg")).toBe(true);
		});

		it("should handle URL-encoded filenames", () => {
			const html = '<img src="my%20image.jpg">';
			const result = converter.convert(html, emptyMediaMap);
			expect(result.markdown).toBe("![[my image.jpg]]");
			expect(result.mediaFiles.has("my image.jpg")).toBe(true);
		});

		it("should convert video tag to WikiLink", () => {
			const html = '<video src="clip.mp4"></video>';
			const result = converter.convert(html, emptyMediaMap);
			expect(result.markdown).toBe("![[clip.mp4]]");
			expect(result.mediaFiles.has("clip.mp4")).toBe(true);
		});

		it("should convert audio tag to WikiLink", () => {
			const html = '<audio src="sound.mp3"></audio>';
			const result = converter.convert(html, emptyMediaMap);
			expect(result.markdown).toBe("![[sound.mp3]]");
			expect(result.mediaFiles.has("sound.mp3")).toBe(true);
		});

		it("should handle multiple media references", () => {
			const html = '<img src="a.jpg"><img src="b.png">';
			const result = converter.convert(html, emptyMediaMap);
			expect(result.markdown).toContain("![[a.jpg]]");
			expect(result.markdown).toContain("![[b.png]]");
			expect(result.mediaFiles.size).toBe(2);
		});

		it("should track all media files in the set", () => {
			const html =
				'<img src="img.jpg"><video src="vid.mp4"><audio src="aud.mp3">';
			const result = converter.convert(html, emptyMediaMap);
			expect(result.mediaFiles.has("img.jpg")).toBe(true);
			expect(result.mediaFiles.has("vid.mp4")).toBe(true);
			expect(result.mediaFiles.has("aud.mp3")).toBe(true);
		});
	});

	describe("processSoundReferences", () => {
		it("should convert [sound:file] syntax to WikiLink", () => {
			const html = "<p>Listen: [sound:audio.mp3]</p>";
			const result = converter.convert(html, emptyMediaMap);
			expect(result.markdown).toBe("Listen: ![[audio.mp3]]");
			expect(result.mediaFiles.has("audio.mp3")).toBe(true);
		});

		it("should handle multiple sound references", () => {
			const html = "<p>[sound:a.mp3] and [sound:b.mp3]</p>";
			const result = converter.convert(html, emptyMediaMap);
			expect(result.markdown).toContain("![[a.mp3]]");
			expect(result.markdown).toContain("![[b.mp3]]");
			expect(result.mediaFiles.size).toBe(2);
		});

		it("should handle sound reference with special characters", () => {
			const html = "<p>[sound:audio-file_name.mp3]</p>";
			const result = converter.convert(html, emptyMediaMap);
			expect(result.markdown).toBe("![[audio-file_name.mp3]]");
		});
	});

	describe("cleanupWhitespace", () => {
		it("should collapse multiple blank lines", () => {
			const html = "<p>Line 1</p>\n\n\n\n<p>Line 2</p>";
			const result = converter.convert(html, emptyMediaMap);
			// Should have at most double newlines
			expect(result.markdown).not.toMatch(/\n{3,}/);
		});

		it("should trim leading and trailing whitespace", () => {
			const html = "   <p>Content</p>   ";
			const result = converter.convert(html, emptyMediaMap);
			expect(result.markdown).toBe("Content");
		});
	});

	describe("unescapeWikiEmbeds", () => {
		it("should unescape escaped WikiLinks", () => {
			// After conversion, WikiLinks might get escaped
			// The converter should clean them up
			const html = '<img src="image.jpg">';
			const result = converter.convert(html, emptyMediaMap);
			// Should be a clean WikiLink, not escaped
			expect(result.markdown).toBe("![[image.jpg]]");
			expect(result.markdown).not.toContain("\\[");
			expect(result.markdown).not.toContain("\\]");
		});
	});

	describe("complex content", () => {
		it("should handle mixed content with clozes and media", () => {
			const html = `
				<div class="card">
					<p>The {{c1::Eiffel Tower}} is in {{c2::Paris}}</p>
					<img src="eiffel.jpg">
					[sound:pronunciation.mp3]
				</div>
			`;
			const result = converter.convert(html, emptyMediaMap);

			expect(result.markdown).toContain("==Eiffel Tower==");
			expect(result.markdown).toContain("==Paris==");
			expect(result.markdown).toContain("![[eiffel.jpg]]");
			expect(result.markdown).toContain("![[pronunciation.mp3]]");
			expect(result.mediaFiles.size).toBe(2);
		});

		it("should handle tables (via GFM plugin)", () => {
			const html = `
				<table>
					<tr><th>Header 1</th><th>Header 2</th></tr>
					<tr><td>Cell 1</td><td>Cell 2</td></tr>
				</table>
			`;
			const result = converter.convert(html, emptyMediaMap);

			// GFM tables should be preserved
			expect(result.markdown).toContain("|");
			expect(result.markdown).toContain("Header 1");
			expect(result.markdown).toContain("Cell 1");
		});

		it("should handle code blocks", () => {
			const html = "<pre><code>const x = 1;</code></pre>";
			const result = converter.convert(html, emptyMediaMap);
			expect(result.markdown).toContain("```");
			expect(result.markdown).toContain("const x = 1;");
		});

		it("should handle inline code", () => {
			const html = "<p>Use <code>console.log</code> for debugging</p>";
			const result = converter.convert(html, emptyMediaMap);
			expect(result.markdown).toBe("Use `console.log` for debugging");
		});

		it("should handle links", () => {
			const html =
				'<p>Visit <a href="https://example.com">Example</a></p>';
			const result = converter.convert(html, emptyMediaMap);
			expect(result.markdown).toBe(
				"Visit [Example](https://example.com)"
			);
		});
	});

	describe("edge cases", () => {
		it("should handle empty input", () => {
			const result = converter.convert("", emptyMediaMap);
			expect(result.markdown).toBe("");
			expect(result.mediaFiles.size).toBe(0);
		});

		it("should handle plain text (no HTML)", () => {
			const result = converter.convert("Just plain text", emptyMediaMap);
			expect(result.markdown).toBe("Just plain text");
		});

		it("should handle self-closing tags", () => {
			const html = "<p>Line<br/>Break</p>";
			const result = converter.convert(html, emptyMediaMap);
			expect(result.markdown).toContain("Line");
			expect(result.markdown).toContain("Break");
		});

		it("should handle HTML entities", () => {
			const html = "<p>&amp; &lt; &gt; &quot;</p>";
			const result = converter.convert(html, emptyMediaMap);
			expect(result.markdown).toContain("&");
			expect(result.markdown).toContain("<");
			expect(result.markdown).toContain(">");
		});

		it("should handle unicode content", () => {
			const html = "<p>日本語 🎉 émojis</p>";
			const result = converter.convert(html, emptyMediaMap);
			expect(result.markdown).toBe("日本語 🎉 émojis");
		});
	});
});
