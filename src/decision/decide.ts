import type { Decision } from "../types/decision";
import type { RuleMatch } from "../types/rule";
import type { Action, Severity, SeverityActionMap } from "../types/severity";

const SEVERITY_RANK: Record<Severity, number> = {
	CRITICAL: 5,
	HIGH: 4,
	MEDIUM: 3,
	LOW: 2,
	INFO: 1,
};

/**
 * Build the user-facing message from the primary rule match and any others.
 * Format per D-49:
 *   Block: "Blocked: {matchedText} — {description}. Suggest: {suggestion}"
 *   Warn:  "Warning: {matchedText} — {description}. Consider: {suggestion}"
 */
function buildMessage(
	action: Action,
	primary: RuleMatch,
	others: RuleMatch[],
): string {
	const prefix = action === "block" ? "Blocked:" : "Warning:";
	let msg = `${prefix} ${primary.matchedText} — ${primary.rule.description}.`;

	if (others.length > 0) {
		const otherIds = others.map((m) => m.rule.id).join(", ");
		msg += ` Also triggered: ${otherIds}.`;
	}

	if (primary.rule.suggestion) {
		const verb = action === "block" ? "Suggest:" : "Consider:";
		msg += ` ${verb} ${primary.rule.suggestion}`;
	}

	return msg;
}

/**
 * Make a graduated decision from filtered rule matches.
 * Per D-50: Highest severity determines final action.
 * Per D-51: Reason lists ALL matched rules.
 * Per D-52: Decision stores all RuleMatch[].
 *
 * @param matches - Filtered RuleMatch[] (post allow-list)
 * @param severityActions - User-configurable severity-to-action map
 * @returns Decision with action, severity, message, suggestion, timestamp
 */
export function makeDecision(
	matches: RuleMatch[],
	severityActions: SeverityActionMap,
): Decision {
	// Allow path: no matches
	if (matches.length === 0) {
		return {
			action: "off",
			matchedRules: [],
			timestamp: new Date().toISOString(),
		};
	}

	// Sort by severity (highest first) for primary rule selection
	const sorted = [...matches].sort(
		(a, b) => SEVERITY_RANK[b.rule.severity] - SEVERITY_RANK[a.rule.severity],
	);

	const primary = sorted[0];
	const severity = primary.rule.severity;
	const action = severityActions[severity];

	// Build message only for block/warn actions (per D-49)
	const message =
		action === "log" || action === "off"
			? undefined
			: buildMessage(action, primary, sorted.slice(1));

	// Suggestion only for block/warn actions
	const suggestion =
		action === "log" || action === "off"
			? undefined
			: primary.rule.suggestion || undefined;

	return {
		action,
		severity,
		matchedRules: matches,
		message,
		suggestion,
		timestamp: new Date().toISOString(),
	};
}
