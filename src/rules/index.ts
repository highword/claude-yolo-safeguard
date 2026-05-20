import type { Rule } from "../types/rule";
import { FS_RULES } from "./fs";
import { GIT_RULES } from "./git";
import { DB_RULES } from "./db";
import { EXEC_RULES } from "./exec";
import { CONTENT_RULES } from "./content";

export const ALL_RULES: Rule[] = [
	...FS_RULES,
	...GIT_RULES,
	...DB_RULES,
	...EXEC_RULES,
	...CONTENT_RULES,
];

export const QUICK_REJECT_SET: Set<string> = new Set(
	ALL_RULES.flatMap((rule) => rule.keywords),
);

/**
 * Quick Reject: if input contains NONE of the aggregated keywords,
 * skip all regex matching (guaranteed no rule will match).
 *
 * @returns true if input should be SKIPPED (no keywords found — allow immediately)
 * @returns false if input should PROCEED to regex matching (keyword found)
 */
export function quickReject(input: string): boolean {
	const lower = input.toLowerCase();
	for (const keyword of QUICK_REJECT_SET) {
		if (lower.includes(keyword.toLowerCase())) {
			return false; // Don't reject — proceed to regex matching
		}
	}
	return true; // Reject — no keywords found, guaranteed no match
}

export { FS_RULES } from "./fs";
export { GIT_RULES } from "./git";
export { DB_RULES } from "./db";
export { EXEC_RULES } from "./exec";
export { CONTENT_RULES } from "./content";
