import type { Severity } from "./severity";

export type RuleCategory = "shell" | "content";
export type Platform = "posix" | "powershell" | "cmd";

export interface Filter {
	type: string;
	value: string;
}

export interface NotContainsFilter extends Filter {
	type: "notContains";
	value: string;
}

export interface ContainsFilter extends Filter {
	type: "contains";
	value: string;
}

export type RuleFilter = NotContainsFilter | ContainsFilter;

export interface Rule {
	id: string;
	category: RuleCategory;
	severity: Severity;
	pattern: string;
	filters?: RuleFilter[];
	keywords: string[];
	description: string;
	suggestion?: string;
	platforms?: Platform[];
	builtin: boolean;
}

export interface RuleMatch {
	rule: Rule;
	matchedText: string;
	index: number;
}
