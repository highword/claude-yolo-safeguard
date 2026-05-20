import type { Rule } from "../types/rule";

export const EXEC_RULES: Rule[] = [
	{
		id: "shell.curl-pipe-sh",
		category: "shell",
		severity: "HIGH",
		pattern: "curl\\s+.*\\|\\s*(sh|bash)",
		keywords: ["curl", "sh", "bash"],
		description:
			"Piping curl output directly to shell executes untrusted remote code",
		suggestion: "Download the script first, review it, then execute",
		builtin: true,
	},
	{
		id: "shell.wget-pipe-sh",
		category: "shell",
		severity: "HIGH",
		pattern: "wget\\s+.*\\|\\s*(sh|bash)",
		keywords: ["wget", "sh", "bash"],
		description:
			"Piping wget output directly to shell executes untrusted remote code",
		suggestion: "Download the script first, review it, then execute",
		builtin: true,
	},
	{
		id: "shell.eval",
		category: "shell",
		severity: "MEDIUM",
		pattern: "\\beval\\b",
		keywords: ["eval"],
		description: "eval executes arbitrary strings as code",
		suggestion: "Use a safer alternative to dynamic code execution",
		builtin: true,
	},
];
