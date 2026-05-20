import type { Rule } from "./rule";
import type { SeverityActionMap } from "./severity";

export interface Config {
	severityActions: SeverityActionMap;
	customRules: Rule[];
	allowList: AllowListEntry[];
	logging: LoggingConfig;
}

export interface LoggingConfig {
	enabled: boolean;
	path: string;
	maxSizeMb: number;
}

export interface AllowListEntry {
	id: string;
	match: AllowListMatcher;
	reason: string;
	expires?: string;
}

export interface AllowListMatcher {
	command?: string;
	filePath?: string;
	ruleId?: string;
}
