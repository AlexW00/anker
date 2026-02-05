/* eslint-env node */
/* global __dirname */
// Generate a realistic review-history.jsonl fixture for FSRS optimizer testing
// Usage: node scripts/generate-review-fixture.cjs
//
// The FSRS optimizer (fsrs-rs) has an outlier filter that requires at least 6
// items per (first_rating, second_review_delta_t) group. This fixture is
// designed to satisfy that constraint while still being realistic.

const { writeFileSync } = require("fs");
const { join } = require("path");

function generateReviewHistory() {
	const lines = [];
	const startDate = new Date("2024-06-01T08:00:00.000Z");
	let currentDate = new Date(startDate);

	// Deterministic pseudo-random via LCG
	let seed = 42;
	function seededRandom() {
		seed = (seed * 16807 + 0) % 2147483647;
		return (seed - 1) / 2147483646;
	}

	function advanceDays(days) {
		const jitter = seededRandom() * 0.4;
		currentDate = new Date(
			currentDate.getTime() + (days + jitter) * 86400000,
		);
	}

	function entry(cardPath, rating, elapsed_days) {
		const timestamp = currentDate.toISOString();
		lines.push(
			JSON.stringify({
				cardPath,
				entry: { timestamp, rating, elapsed_days },
			}),
		);
	}

	let cardIndex = 0;

	// Helper: generate a batch of cards with specific first-rating and
	// second-review delta_t to satisfy the outlier filter (≥ 6 per group).
	function generateGroup(
		prefix,
		count,
		firstRating,
		secondDeltaT,
		continuations,
	) {
		for (let i = 0; i < count; i++) {
			cardIndex++;
			const path = `${prefix}/card-${String(cardIndex).padStart(4, "0")}.md`;
			currentDate = new Date(startDate.getTime() + cardIndex * 120000);

			// First review (always delta_t = 0)
			entry(path, firstRating, 0);

			// Second review at the specified delta_t
			advanceDays(secondDeltaT);
			const secondRating =
				firstRating === 1 ? [2, 3, 3][i % 3] : [3, 3, 4][i % 3];
			entry(path, secondRating, secondDeltaT);

			// Additional reviews from the continuation pattern
			if (continuations && continuations.length > 0) {
				const pattern = continuations[i % continuations.length];
				for (const [deltaT, rating] of pattern) {
					advanceDays(deltaT);
					entry(path, rating, deltaT);
				}
			}
		}
	}

	// ===========================================================
	// INITIALIZATION SET: Cards with exactly 2 reviews
	// Need ≥ 6 per (first_rating, second_delta_t) group
	// ===========================================================

	// Rating 3 (Good) first review — most common in practice
	generateGroup("flashcards/init-good-d1", 15, 3, 1, null);
	generateGroup("flashcards/init-good-d3", 10, 3, 3, null);

	// Rating 4 (Easy) first review
	generateGroup("flashcards/init-easy-d1", 10, 4, 1, null);
	generateGroup("flashcards/init-easy-d4", 8, 4, 4, null);

	// Rating 2 (Hard) first review
	generateGroup("flashcards/init-hard-d1", 10, 2, 1, null);

	// Rating 1 (Again) first review
	generateGroup("flashcards/init-again-d1", 10, 1, 1, null);

	// ===========================================================
	// TRAINING SET: Cards with 3+ reviews (long_term_review_cnt ≥ 2)
	// These cards go into the actual gradient descent training
	// ===========================================================

	// Well-learned: Good start, consistent reviews
	generateGroup("flashcards/train-steady", 30, 3, 1, [
		[
			[3, 3],
			[7, 3],
			[15, 3],
		],
		[
			[3, 3],
			[7, 4],
			[14, 3],
			[30, 3],
		],
		[
			[2, 3],
			[5, 3],
			[10, 3],
			[25, 3],
		],
		[
			[3, 3],
			[7, 3],
			[20, 4],
			[60, 3],
		],
	]);

	// Struggling: Fail and recover
	generateGroup("flashcards/train-struggle", 25, 1, 1, [
		[
			[1, 3],
			[3, 1],
			[1, 3],
			[5, 3],
		],
		[
			[1, 2],
			[2, 3],
			[4, 3],
			[10, 3],
		],
		[
			[1, 3],
			[3, 2],
			[2, 3],
			[7, 3],
		],
	]);

	// Easy cards: High ratings
	generateGroup("flashcards/train-easy", 20, 4, 4, [
		[
			[15, 3],
			[30, 4],
		],
		[
			[10, 4],
			[45, 3],
			[60, 4],
		],
		[
			[20, 3],
			[40, 3],
		],
	]);

	// Hard start, improving
	generateGroup("flashcards/train-improve", 20, 2, 1, [
		[
			[2, 3],
			[5, 3],
			[12, 3],
		],
		[
			[1, 2],
			[3, 3],
			[7, 3],
			[15, 4],
		],
		[
			[2, 3],
			[4, 3],
			[10, 3],
		],
	]);

	// Long retention: Good → long intervals
	generateGroup("flashcards/train-longret", 20, 3, 3, [
		[
			[7, 3],
			[20, 3],
			[45, 4],
			[90, 3],
		],
		[
			[5, 3],
			[15, 3],
			[30, 3],
			[60, 3],
		],
		[
			[10, 4],
			[30, 3],
			[60, 3],
		],
	]);

	// Lapse pattern: Learning → Review → Lapse → Re-learn
	generateGroup("flashcards/train-lapse", 20, 3, 1, [
		[
			[3, 3],
			[7, 1],
			[1, 3],
			[5, 3],
			[12, 3],
		],
		[
			[2, 3],
			[5, 1],
			[1, 2],
			[3, 3],
			[8, 3],
		],
		[
			[4, 3],
			[10, 1],
			[1, 3],
			[4, 3],
		],
	]);

	// Mixed recent cards (shorter histories)
	generateGroup("flashcards/train-recent", 20, 3, 1, [
		[[3, 3]],
		[[2, 4]],
		[
			[3, 2],
			[2, 3],
		],
	]);

	return lines.join("\n") + "\n";
}

const content = generateReviewHistory();
const lineCount = content.trim().split("\n").length;
const outputPath = join(__dirname, "..", "resources", "review-history.jsonl");
writeFileSync(outputPath, content);
console.log(`Generated ${lineCount} review log entries -> ${outputPath}`);

// Verify: count unique cards and total reviews
const data = {};
for (const line of content.trim().split("\n")) {
	const { cardPath } = JSON.parse(line);
	data[cardPath] = (data[cardPath] || 0) + 1;
}
console.log(`Cards: ${Object.keys(data).length}, Total reviews: ${lineCount}`);

// Show per-group breakdown
const groups = {};
for (const [path] of Object.entries(data)) {
	const group = path.split("/").slice(0, 2).join("/");
	groups[group] = (groups[group] || 0) + 1;
}
console.log("Groups:", groups);
