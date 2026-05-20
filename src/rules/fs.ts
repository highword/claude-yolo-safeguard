import type { Rule } from "../types/rule";

export const FS_RULES: Rule[] = [
	{
		id: "shell.rm-recursive-root",
		category: "shell",
		severity: "CRITICAL",
		pattern: "rm\\s+(-[a-zA-Z]*r[a-zA-Z]*\\s+.*)?(\/|~)",
		keywords: ["rm"],
		description: "Recursive rm targeting root (/) or home (~)",
		suggestion: "Specify an explicit subdirectory path instead of / or ~",
		builtin: true,
	},
	{
		id: "shell.rm-recursive-force",
		category: "shell",
		severity: "HIGH",
		pattern: "rm\\s+-[a-zA-Z]*r[a-zA-Z]*f",
		filters: [{ type: "notContains", value: "node_modules" }],
		keywords: ["rm"],
		description: "rm with recursive and force flags",
		suggestion: "Use rm without -f, or target a specific directory",
		builtin: true,
	},
	{
		id: "shell.rmdir-root",
		category: "shell",
		severity: "CRITICAL",
		pattern: "rmdir\\s+.*(\/|~)",
		keywords: ["rmdir"],
		description: "rmdir targeting root or home directory",
		suggestion: "Specify an explicit subdirectory path",
		builtin: true,
	},
];
