import type { Decision } from "../types/decision";
import type { HookOutput } from "../types/hook";

export interface FormattedOutput {
	output: string;
	exitCode: number;
}

function stripUndefined(obj: object): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj)) {
		if (value !== undefined) {
			result[key] = value;
		}
	}
	return result;
}

export function formatHookOutput(decision: Decision): FormattedOutput {
	if (
		decision.action === "off" ||
		decision.action === "log" ||
		decision.matchedRules.length === 0
	) {
		return { output: "", exitCode: 0 };
	}

	const primary = decision.matchedRules[0];

	if (decision.action === "block") {
		const hookOutput: HookOutput = {
			decision: "block",
			reason: decision.message,
			rule: primary?.rule.id,
			severity: decision.severity,
			category: primary?.rule.category,
			suggestion: decision.suggestion || undefined,
			matchedPatterns: decision.matchedRules.map((m) => m.rule.id),
		};
		return { output: JSON.stringify(stripUndefined(hookOutput)), exitCode: 2 };
	}

	if (decision.action === "warn") {
		const hookOutput: HookOutput = {
			decision: "allow",
			reason: decision.message,
			rule: primary?.rule.id,
			severity: decision.severity,
			category: primary?.rule.category,
			suggestion: decision.suggestion || undefined,
			matchedPatterns: decision.matchedRules.map((m) => m.rule.id),
		};
		return { output: JSON.stringify(stripUndefined(hookOutput)), exitCode: 0 };
	}

	return { output: "", exitCode: 0 };
}
