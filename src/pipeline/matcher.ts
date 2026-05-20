import type { Rule, RuleMatch, RuleFilter } from "../types/rule";
import type { CompiledRule, TokenSpan } from "./types";
import { ALL_RULES } from "../rules/index";

/**
 * Compile an array of rules into CompiledRule objects with pre-built RegExp.
 * Per D-43: Called once at module load time, not per invocation.
 *
 * @param rules - Rules to compile (should be filtered to shell category by caller or here)
 * @returns CompiledRule array with pre-compiled regex
 */
export function compileRules(rules: Rule[]): CompiledRule[] {
	return rules.map((rule) => ({
		rule,
		regex: new RegExp(rule.pattern),
	}));
}

/**
 * Apply a rule's filters against the segment string.
 * Per D-36: Filters are post-match guards.
 *
 * @param rule - Rule with optional filters
 * @param segmentStr - The segment string to check against filters
 * @returns true if match stands (all filters pass), false if match should be suppressed
 */
export function applyFilters(rule: Rule, segmentStr: string): boolean {
	if (!rule.filters || rule.filters.length === 0) {
		return true; // No filters = match stands
	}

	for (const filter of rule.filters) {
		switch (filter.type) {
			case "notContains":
				if (segmentStr.includes(filter.value)) {
					return false; // Filter rejects: segment contains forbidden value
				}
				break;
			case "contains":
				if (!segmentStr.includes(filter.value)) {
					return false; // Filter rejects: segment missing required value
				}
				break;
		}
	}

	return true; // All filters pass
}

/**
 * Find which TokenSpan a character index falls into.
 * Returns the span or undefined if not found.
 */
function findSpanAtIndex(
	spans: TokenSpan[],
	charIndex: number,
): TokenSpan | undefined {
	for (const span of spans) {
		if (charIndex >= span.start && charIndex < span.end) {
			return span;
		}
	}
	return undefined;
}

/**
 * Check if a regex match should be suppressed due to token position.
 * Per D-33, D-34, D-39: A match is suppressed when:
 * - The matched text starts within a token in "argument" position
 * - AND the token is multi-word (was originally quoted)
 * - AND isShellWrapperArg is NOT true (shell wrapper args ARE the command)
 *
 * @param spans - Token spans for position verification
 * @param matchIndex - Character index where regex matched in the segment string
 * @param isShellWrapperArg - If true, skip suppression (the argument IS a command)
 * @returns true if match should be suppressed (not reported)
 */
function shouldSuppressMatch(
	spans: TokenSpan[],
	matchIndex: number,
	isShellWrapperArg: boolean,
): boolean {
	if (isShellWrapperArg) {
		return false; // Never suppress shell wrapper arguments
	}

	const span = findSpanAtIndex(spans, matchIndex);
	if (!span) {
		return false; // Can't find span — don't suppress (fail-open)
	}

	// Suppress if in argument position AND token is multi-word (was quoted)
	return span.position === "argument" && span.isMultiWord;
}

/**
 * Match compiled rules against a segment string with filter and token position verification.
 * Per D-40: Multiple rules can match; all matches collected.
 *
 * @param segmentStr - The rebuilt segment string to match against
 * @param spans - TokenSpan array for position verification
 * @param compiledRules - Pre-compiled rules to test
 * @param isShellWrapperArg - If true, skip token position suppression
 * @returns Array of RuleMatch objects for all matching rules
 */
export function matchRules(
	segmentStr: string,
	spans: TokenSpan[],
	compiledRules: CompiledRule[],
	isShellWrapperArg = false,
): RuleMatch[] {
	const results: RuleMatch[] = [];

	for (const compiled of compiledRules) {
		const match = compiled.regex.exec(segmentStr);
		if (!match) {
			continue;
		}

		// Step 1: Apply filters (D-36 post-match guards)
		if (!applyFilters(compiled.rule, segmentStr)) {
			continue;
		}

		// Step 2: Token position verification (D-33, D-34, D-39)
		if (shouldSuppressMatch(spans, match.index, isShellWrapperArg)) {
			continue;
		}

		// Step 3: Match passes all checks — record it
		results.push({
			rule: compiled.rule,
			matchedText: match[0],
			index: match.index,
		});
	}

	return results;
}

/**
 * Pre-compiled shell rules for use by the analysis pipeline.
 * Per D-43: Compiled once at module load, not per invocation.
 */
export const COMPILED_SHELL_RULES: CompiledRule[] = compileRules(
	ALL_RULES.filter((r) => r.category === "shell"),
);
