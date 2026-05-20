import type { Rule } from "../types/rule";

export const DB_RULES: Rule[] = [
	{
		id: "shell.drop-database",
		category: "shell",
		severity: "CRITICAL",
		pattern: "DROP\\s+DATABASE",
		keywords: ["DROP", "DATABASE"],
		description: "DROP DATABASE permanently destroys an entire database",
		suggestion: "Create a backup first; use DROP DATABASE IF EXISTS for safety",
		builtin: true,
	},
	{
		id: "shell.drop-table",
		category: "shell",
		severity: "CRITICAL",
		pattern: "DROP\\s+TABLE",
		keywords: ["DROP", "TABLE"],
		description: "DROP TABLE permanently destroys a table and all its data",
		suggestion: "Create a backup first; consider RENAME TABLE instead",
		builtin: true,
	},
	{
		id: "shell.truncate-table",
		category: "shell",
		severity: "HIGH",
		pattern: "TRUNCATE\\s+TABLE",
		keywords: ["TRUNCATE", "TABLE"],
		description:
			"TRUNCATE TABLE removes all rows without logging individual deletions",
		suggestion: "Use DELETE FROM with a WHERE clause for selective removal",
		builtin: true,
	},
];
