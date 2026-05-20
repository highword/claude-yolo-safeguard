import { parse } from "shell-quote";
import type { ParseEntry, Segment, TokenSpan } from "./types";
import { isOperatorToken } from "./types";

/**
 * Parse a raw POSIX shell command string into typed token array.
 * Wraps shell-quote's parse() with no env argument (POSIX only, per D-44).
 * Returns empty array on error (fail-open per project principle, T-02-01).
 */
export function parseCommand(cmd: string): ParseEntry[] {
	if (!cmd || cmd.trim() === "") {
		return [];
	}
	try {
		return parse(cmd) as ParseEntry[];
	} catch {
		// Fail-open: return empty array on malformed input
		return [];
	}
}

/** Operators that split compound commands into independent segments */
const SEGMENT_SPLIT_OPS = new Set(["&&", "||", ";", "|", "&"]);

/**
 * Split a token array at compound operator boundaries (&&, ||, ;, |, &).
 * Redirections (<, >, >>, >&, <() stay within their segment.
 * Per D-30 and D-31: all segments treated equally.
 */
export function splitSegments(tokens: ParseEntry[]): Segment[] {
	if (tokens.length === 0) {
		return [];
	}

	const segments: Segment[] = [];
	let current: ParseEntry[] = [];

	for (const token of tokens) {
		if (isSegmentSplitOperator(token)) {
			if (current.length > 0) {
				segments.push({
					tokens: current,
					original: rebuildSegment(current),
				});
				current = [];
			}
			// Operator itself is discarded (per D-31)
		} else {
			current.push(token);
		}
	}

	if (current.length > 0) {
		segments.push({
			tokens: current,
			original: rebuildSegment(current),
		});
	}

	return segments;
}

/**
 * Check if a token is a segment-splitting operator.
 */
function isSegmentSplitOperator(token: ParseEntry): boolean {
	return isOperatorToken(token) && SEGMENT_SPLIT_OPS.has(token.op);
}

/**
 * Rebuild a segment string from its token array.
 * - String tokens: used directly
 * - Glob tokens: use their pattern field
 * - Operator tokens (redirections): use their op field
 * - Comment tokens: ignored
 */
export function rebuildSegment(tokens: ParseEntry[]): string {
	const parts: string[] = [];

	for (const token of tokens) {
		if (typeof token === "string") {
			parts.push(token);
		} else if (typeof token === "object" && token !== null) {
			if ("pattern" in token && "op" in token) {
				// Glob token: { op: "glob", pattern: "*.tmp" }
				parts.push((token as { op: "glob"; pattern: string }).pattern);
			} else if ("op" in token) {
				// Operator token (redirections that stayed in segment)
				parts.push((token as { op: string }).op);
			}
			// Comment tokens are ignored
		}
	}

	return parts.join(" ");
}

/**
 * Get the string representation of a token for span calculation.
 */
function tokenToString(token: ParseEntry): string | null {
	if (typeof token === "string") {
		return token;
	}
	if (typeof token === "object" && token !== null) {
		if ("pattern" in token && "op" in token) {
			return (token as { op: "glob"; pattern: string }).pattern;
		}
		if ("op" in token) {
			return (token as { op: string }).op;
		}
	}
	return null;
}

/**
 * Build token spans with character offsets and position classification.
 * Position classification:
 * - Index 0 = "command"
 * - Starts with "-" = "flag"
 * - Everything else = "argument"
 * isMultiWord = token string contains at least one space
 */
export function buildTokenSpans(tokens: ParseEntry[]): TokenSpan[] {
	if (tokens.length === 0) {
		return [];
	}

	const spans: TokenSpan[] = [];
	let offset = 0;
	let stringIndex = 0; // Tracks position among meaningful tokens for classification

	for (const token of tokens) {
		const str = tokenToString(token);
		if (str === null) {
			// Skip comment tokens
			continue;
		}

		const start = offset;
		const end = offset + str.length;

		// Classify position
		let position: "command" | "argument" | "flag";
		if (stringIndex === 0) {
			position = "command";
		} else if (typeof token === "string" && token.startsWith("-")) {
			position = "flag";
		} else {
			position = "argument";
		}

		// Determine if multi-word (contains space - was originally quoted)
		const isMultiWord = typeof token === "string" && token.includes(" ");

		spans.push({
			token,
			start,
			end,
			position,
			isMultiWord,
		});

		// Move offset past this token + 1 space separator
		offset = end + 1;
		stringIndex++;
	}

	return spans;
}
