import type { AllowListEntry } from "../types/config";
import type { RuleMatch } from "../types/rule";

/**
 * Check if an allow-list entry has expired.
 * Invalid dates fail-open (treated as non-expired) per T-03-02.
 */
function isExpired(entry: AllowListEntry): boolean {
	if (!entry.expires) return false;
	try {
		const expiryTime = new Date(entry.expires).getTime();
		if (Number.isNaN(expiryTime)) return false; // invalid date = not expired (fail-open)
		return expiryTime < Date.now();
	} catch {
		return false; // parse error = not expired (fail-open)
	}
}

/**
 * Check if an allow-list entry matches a specific rule match.
 * AND logic: if both ruleId and command are set, both must match.
 * filePath-only entries are ignored for command matching (Phase 5 use).
 */
function entryMatchesRule(
	entry: AllowListEntry,
	match: RuleMatch,
	command?: string,
): boolean {
	const { ruleId, command: commandPattern, filePath } = entry.match;

	// If only filePath is set (no ruleId, no command), skip — filePath is for Write/Edit
	if (!ruleId && !commandPattern) return false;

	// AND logic: all specified conditions must match
	if (ruleId && match.rule.id !== ruleId) return false;
	if (commandPattern && !command?.includes(commandPattern)) return false;

	return true;
}

/**
 * Apply allow-list filtering to remove suppressed matches.
 * Per D-61: Allow-list entries suppress matches BEFORE decision.
 *
 * @param matches - RuleMatch[] from analysis pipeline
 * @param allowList - AllowListEntry[] from merged config
 * @param command - The original command string (for command-pattern matching)
 * @returns Filtered RuleMatch[] with suppressed matches removed
 */
export function applyAllowList(
	matches: RuleMatch[],
	allowList: AllowListEntry[],
	command?: string,
): RuleMatch[] {
	if (matches.length === 0 || allowList.length === 0) {
		return matches;
	}

	return matches.filter((match) => {
		// Check each allow-list entry — if ANY entry suppresses this match, remove it
		for (const entry of allowList) {
			if (isExpired(entry)) continue;
			if (entryMatchesRule(entry, match, command)) return false;
		}
		return true;
	});
}
