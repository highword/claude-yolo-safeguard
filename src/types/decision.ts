import type { RuleMatch } from "./rule";
import type { Action, Severity } from "./severity";

export interface Decision {
	action: Action;
	severity?: Severity;
	matchedRules: RuleMatch[];
	message?: string;
	suggestion?: string;
	timestamp: string;
}
