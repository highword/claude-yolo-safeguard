import type { Decision } from "../types/decision";
import type { StructuredHookOutput } from "../types/hook";

export interface FormattedOutput {
	output: string;
	exitCode: number;
}

export function formatHookOutput(decision: Decision): FormattedOutput {
	if (
		decision.action === "off" ||
		decision.action === "log" ||
		decision.matchedRules.length === 0
	) {
		return { output: "", exitCode: 0 };
	}

	if (decision.action === "block") {
		const output: StructuredHookOutput = {
			hookSpecificOutput: {
				hookEventName: "PreToolUse",
				permissionDecision: "deny",
			},
			systemMessage: decision.message || "Command blocked by yolo-safeguard",
		};
		return { output: JSON.stringify(output), exitCode: 2 };
	}

	if (decision.action === "warn") {
		const output: StructuredHookOutput = {
			hookSpecificOutput: {
				hookEventName: "PreToolUse",
				permissionDecision: "allow",
				additionalContext: decision.message || "Warning from yolo-safeguard",
			},
		};
		return { output: JSON.stringify(output), exitCode: 0 };
	}

	return { output: "", exitCode: 0 };
}
