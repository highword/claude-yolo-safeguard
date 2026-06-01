import { loadConfig } from "../config/loader";
import { analyzeCommand } from "../pipeline/index";
import { applyAllowList } from "../decision/allow-list";
import { makeDecision } from "../decision/decide";
import { formatHookOutput } from "../decision/format";
import { writeAuditLog } from "../decision/logger";
import type { ClaudeCodeHookEvent } from "../types/hook";

/**
 * Process a hook event from raw stdin JSON string.
 * This is the core logic extracted for testability.
 * Returns { output, exitCode } for the caller to handle.
 *
 * Any thrown error results in fail-open { output: "", exitCode: 0 }.
 */
export function processHookEvent(raw: string): { output: string; exitCode: number } {
	try {
		const event: ClaudeCodeHookEvent = JSON.parse(raw);

		// D-65: Only Bash tool gets full analysis; Write/Edit return immediately
		if (event.tool_name !== "Bash") {
			return { output: "", exitCode: 0 };
		}

		// Bail if no command to analyze
		const command = event.tool_input?.command;
		if (!command) {
			return { output: "", exitCode: 0 };
		}

		// Load 3-layer merged config
		const cwd = event.cwd || process.cwd();
		const config = loadConfig(cwd);

		// Analyze command through pipeline
		const analysis = analyzeCommand(
			command,
			config.customRules.length > 0 ? config.customRules : undefined,
		);

		// Apply allow-list filtering
		const filtered = applyAllowList(analysis.matches, config.allowList, command);

		// Make graduated decision
		const decision = makeDecision(filtered, config.severityActions);

		// Audit log (fire-and-forget, fail-open internally)
		writeAuditLog(decision, config.logging, {
			command,
			cwd,
			sessionId: event.session_id,
		});

		// Format and return
		return formatHookOutput(decision);
	} catch {
		// D-66: Any error = fail-open
		return { output: "", exitCode: 0 };
	}
}
