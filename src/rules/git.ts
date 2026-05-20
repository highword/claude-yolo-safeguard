import type { Rule } from "../types/rule";

export const GIT_RULES: Rule[] = [
	{
		id: "shell.git-force-push",
		category: "shell",
		severity: "CRITICAL",
		pattern: "git\\s+push\\s+.*--force(?!-with-lease)",
		keywords: ["git", "push", "force"],
		description: "git push --force (not --force-with-lease)",
		suggestion: "Use --force-with-lease for safer force push",
		builtin: true,
	},
	{
		id: "shell.git-reset-hard",
		category: "shell",
		severity: "HIGH",
		pattern: "git\\s+reset\\s+--hard",
		keywords: ["git", "reset", "hard"],
		description: "git reset --hard discards all uncommitted changes",
		suggestion:
			"Use git stash to save changes before reset, or use git reset --soft",
		builtin: true,
	},
	{
		id: "shell.git-clean-force",
		category: "shell",
		severity: "HIGH",
		pattern: "git\\s+clean\\s+-[a-zA-Z]*f",
		keywords: ["git", "clean"],
		description: "git clean -f permanently deletes untracked files",
		suggestion:
			"Use git clean -n (dry-run) first to see what would be deleted",
		builtin: true,
	},
	{
		id: "shell.git-branch-D",
		category: "shell",
		severity: "MEDIUM",
		pattern: "git\\s+branch\\s+-D",
		keywords: ["git", "branch"],
		description:
			"git branch -D force-deletes branch regardless of merge status",
		suggestion:
			"Use git branch -d (lowercase) which refuses to delete unmerged branches",
		builtin: true,
	},
	{
		id: "shell.git-stash-drop",
		category: "shell",
		severity: "MEDIUM",
		pattern: "git\\s+stash\\s+(drop|clear)",
		keywords: ["git", "stash"],
		description: "git stash drop/clear permanently discards stashed changes",
		suggestion:
			"Use git stash list first; consider git stash apply instead of pop",
		builtin: true,
	},
];
