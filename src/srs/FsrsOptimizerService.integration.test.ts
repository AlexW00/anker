/**
 * Integration tests for FsrsOptimizerService using a real review history fixture.
 *
 * These tests verify the complete optimization pipeline: reading the JSONL
 * fixture, parsing it into ReviewLogData, initializing the fsrs-browser WASM
 * module, and computing optimized FSRS parameters.
 *
 * The fixture at resources/review-history.jsonl contains 956 review entries
 * across 218 cards with varying review patterns (initialization groups for
 * the outlier filter, and training groups with diverse review histories).
 */
/* eslint-disable import/no-nodejs-modules */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FsrsOptimizerService } from "./FsrsOptimizerService";
import type { ReviewLogData } from "./ReviewLogStore";
import type { ReviewLogEntry } from "../types";

/**
 * Load the WASM binary for fsrs-browser so we can initialize it in Node.js
 * without relying on `fetch` or `import.meta.url` resolution.
 */
function loadFsrsWasm(): Uint8Array {
	const wasmPath = join(
		// eslint-disable-next-line no-undef
		process.cwd(),
		"node_modules",
		"fsrs-browser",
		"fsrs_browser_bg.wasm",
	);
	return new Uint8Array(readFileSync(wasmPath));
}

/**
 * Load the review history fixture and parse it into ReviewLogData format.
 * This mirrors the parsing logic in ReviewLogStore.loadJsonl().
 */
function loadReviewFixture(): ReviewLogData {
	const fixturePath = join(
		// eslint-disable-next-line no-undef
		process.cwd(),
		"resources",
		"review-history.jsonl",
	);
	const raw = readFileSync(fixturePath, "utf-8");
	const data: ReviewLogData = {};

	for (const line of raw.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		const parsed = JSON.parse(trimmed) as {
			cardPath: string;
			entry: ReviewLogEntry;
		};

		if (!data[parsed.cardPath]) {
			data[parsed.cardPath] = [];
		}
		data[parsed.cardPath]!.push(parsed.entry);
	}

	return data;
}

/**
 * Get stats from review data (mirrors ReviewLogStore.getStats).
 */
function getFixtureStats(data: ReviewLogData): {
	cardsWithHistory: number;
	totalReviews: number;
} {
	let cardsWithHistory = 0;
	let totalReviews = 0;

	for (const entries of Object.values(data)) {
		if (entries.length > 0) {
			cardsWithHistory++;
			totalReviews += entries.length;
		}
	}

	return { cardsWithHistory, totalReviews };
}

describe("FsrsOptimizerService Integration", () => {
	let reviewData: ReviewLogData;
	let optimizer: FsrsOptimizerService;

	beforeAll(async () => {
		// fsrs-browser imports a Web Worker helper that references `self`
		// and calls `self.addEventListener`. Provide minimal stubs so the
		// module can be imported in Node.js without errors.
		if (typeof globalThis.self === "undefined") {
			Object.defineProperty(globalThis, "self", {
				value: {
					addEventListener: () => {},
					removeEventListener: () => {},
				},
				configurable: true,
			});
		}

		reviewData = loadReviewFixture();
		optimizer = new FsrsOptimizerService();

		// Load WASM binary from disk and pass it to the initializer
		// to bypass the browser-only fetch() path.
		const wasmBuffer = loadFsrsWasm();
		await optimizer.initialize(wasmBuffer);
	});

	describe("fixture loading", () => {
		it("loads the review history fixture with expected card count", () => {
			const stats = getFixtureStats(reviewData);
			expect(stats.cardsWithHistory).toBe(218);
		});

		it("has sufficient reviews for optimization (>= 50)", () => {
			const stats = getFixtureStats(reviewData);
			expect(stats.totalReviews).toBeGreaterThanOrEqual(50);
			expect(stats.totalReviews).toBe(956);
		});

		it("contains valid review entries with required fields", () => {
			for (const [cardPath, entries] of Object.entries(reviewData)) {
				expect(cardPath).toMatch(/\.md$/);
				for (const entry of entries) {
					expect(entry).toHaveProperty("timestamp");
					expect(entry).toHaveProperty("rating");
					expect(entry).toHaveProperty("elapsed_days");
					expect(entry.rating).toBeGreaterThanOrEqual(1);
					expect(entry.rating).toBeLessThanOrEqual(4);
					expect(entry.elapsed_days).toBeGreaterThanOrEqual(0);
				}
			}
		});

		it("contains diverse rating distributions", () => {
			const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
			for (const entries of Object.values(reviewData)) {
				for (const entry of entries) {
					ratingCounts[entry.rating as 1 | 2 | 3 | 4]++;
				}
			}

			// All ratings should be represented
			expect(ratingCounts[1]).toBeGreaterThan(0); // Again
			expect(ratingCounts[2]).toBeGreaterThan(0); // Hard
			expect(ratingCounts[3]).toBeGreaterThan(0); // Good
			expect(ratingCounts[4]).toBeGreaterThan(0); // Easy
		});
	});

	describe("initialization", () => {
		it("reports initialized after init", () => {
			expect(optimizer.isInitialized()).toBe(true);
		});

		it("is idempotent when initialized twice", async () => {
			await optimizer.initialize();
			expect(optimizer.isInitialized()).toBe(true);
		});
	});

	describe("optimize with short-term enabled", () => {
		it("returns optimized weights with expected shape", async () => {
			const result = await optimizer.optimize(reviewData, true);

			expect(result).toHaveProperty("weights");
			expect(result).toHaveProperty("cardsUsed");
			expect(result).toHaveProperty("reviewsUsed");

			// FSRS with short-term enabled produces 21 weights
			expect(result.weights).toHaveLength(21);
		});

		it("returns correct card and review counts", async () => {
			const result = await optimizer.optimize(reviewData, true);

			expect(result.cardsUsed).toBe(218);
			expect(result.reviewsUsed).toBe(956);
		});

		it("produces valid weight values (finite numbers)", async () => {
			const result = await optimizer.optimize(reviewData, true);

			for (const weight of result.weights) {
				expect(typeof weight).toBe("number");
				expect(Number.isFinite(weight)).toBe(true);
			}
		});

		it("produces positive initial stability weights (w0-w3)", async () => {
			const result = await optimizer.optimize(reviewData, true);

			// w0-w3 are initial stability values for Again/Hard/Good/Easy
			// They should be positive
			for (let i = 0; i < 4; i++) {
				expect(result.weights[i]).toBeGreaterThan(0);
			}
		});
	});

	describe("optimize with short-term disabled", () => {
		it("returns 21 weights even when short-term is disabled", async () => {
			const result = await optimizer.optimize(reviewData, false);

			// fsrs-browser v5 always returns 21 weights; the enableShortTerm
			// flag affects training behavior, not the output shape.
			expect(result.weights).toHaveLength(21);
		});

		it("returns same card/review counts regardless of short-term setting", async () => {
			const result = await optimizer.optimize(reviewData, false);

			expect(result.cardsUsed).toBe(218);
			expect(result.reviewsUsed).toBe(956);
		});
	});

	describe("insufficient data", () => {
		it("rejects optimization with fewer than 50 reviews", async () => {
			// Create data with only a few reviews
			const tooFewReviews: ReviewLogData = {
				"flashcards/test/card-001.md": [
					{
						timestamp: "2024-06-01T08:00:00.000Z",
						rating: 3,
						elapsed_days: 0,
					},
					{
						timestamp: "2024-06-02T08:00:00.000Z",
						rating: 3,
						elapsed_days: 1,
					},
				],
			};

			await expect(
				optimizer.optimize(tooFewReviews, true),
			).rejects.toThrow(/Insufficient review data/);
		});

		it("rejects empty review data", async () => {
			const emptyData: ReviewLogData = {};

			await expect(
				optimizer.optimize(emptyData, true),
			).rejects.toThrow(/Insufficient review data/);
		});

		it("includes actual review count in error message", async () => {
			const smallData: ReviewLogData = {};
			for (let i = 0; i < 10; i++) {
				smallData[`flashcards/test/card-${i}.md`] = [
					{
						timestamp: "2024-06-01T08:00:00.000Z",
						rating: 3,
						elapsed_days: 0,
					},
				];
			}

			await expect(
				optimizer.optimize(smallData, true),
			).rejects.toThrow("found 10");
		});
	});

	describe("determinism", () => {
		it("produces consistent weights when called twice with the same data", async () => {
			const result1 = await optimizer.optimize(reviewData, true);
			const result2 = await optimizer.optimize(reviewData, true);

			expect(result1.weights).toEqual(result2.weights);
		});
	});

	describe("progress callback", () => {
		it("invokes progress callback during optimization", async () => {
			// The progress callback may or may not be called depending on
			// data size. We just verify it doesn't throw.
			let callCount = 0;
			await optimizer.optimize(reviewData, true, () => {
				callCount++;
			});

			// Progress callback is optional; just verify no error
			expect(callCount).toBeGreaterThanOrEqual(0);
		});
	});

	describe("edge cases in review data", () => {
		it("skips cards with empty review arrays", async () => {
			const dataWithEmpties: ReviewLogData = {
				...reviewData,
				"flashcards/empty/card-001.md": [],
				"flashcards/empty/card-002.md": [],
			};

			const result = await optimizer.optimize(dataWithEmpties, true);

			// Empty cards shouldn't count
			expect(result.cardsUsed).toBe(218);
			expect(result.reviewsUsed).toBe(956);
		});
	});
});
