import type { RuleCategory } from "./rule";
import type { Severity } from "./severity";

export type ToolName = "Bash" | "Write" | "Edit";

export interface HookInput {
	tool: ToolName;
	command?: string;
	filePath?: string;
	content?: string;
	cwd: string;
	platform: "claude-code";
}

export interface ClaudeCodeHookEvent {
	hook_type: "PreToolUse";
	tool_name: ToolName;
	tool_input: {
		command?: string;
		file_path?: string;
		content?: string;
		old_string?: string;
		new_string?: string;
	};
	session_id?: string;
	cwd?: string;
}

export interface HookOutput {
	decision: "allow" | "block";
	reason?: string;
	rule?: string;
	severity?: Severity;
	category?: RuleCategory;
	suggestion?: string;
	matchedPatterns?: string[];
}

export interface StructuredHookOutput {
	hookSpecificOutput: {
		hookEventName: "PreToolUse";
		permissionDecision: "allow" | "deny";
		additionalContext?: string;
	};
	systemMessage?: string;
}
