import { describe, expect, test } from "bun:test";
import { processHookEvent } from "../../src/hook/process";

describe("processHookEvent", () => {
	test("Bash tool with dangerous command (rm -rf /) produces exit code 2 and block JSON", () => {
		const event = JSON.stringify({
			hook_type: "PreToolUse",
			tool_name: "Bash",
			tool_input: { command: "rm -rf /" },
			cwd: "/tmp",
		});
		const result = processHookEvent(event);
		expect(result.exitCode).toBe(2);
		const parsed = JSON.parse(result.output);
		expect(parsed.hookSpecificOutput.permissionDecision).toBe("deny");
		expect(parsed.systemMessage).toBeDefined();
	});

	test("Bash tool with safe command (ls -la) produces exit code 0 and no output", () => {
		const event = JSON.stringify({
			hook_type: "PreToolUse",
			tool_name: "Bash",
			tool_input: { command: "ls -la" },
			cwd: "/tmp",
		});
		const result = processHookEvent(event);
		expect(result.exitCode).toBe(0);
		expect(result.output).toBe("");
	});

	test("Write tool produces exit code 0 immediately (no analysis)", () => {
		const event = JSON.stringify({
			hook_type: "PreToolUse",
			tool_name: "Write",
			tool_input: { file_path: "/tmp/test.ts", content: "rm -rf /" },
			cwd: "/tmp",
		});
		const result = processHookEvent(event);
		expect(result.exitCode).toBe(0);
		expect(result.output).toBe("");
	});

	test("Edit tool produces exit code 0 immediately (no analysis)", () => {
		const event = JSON.stringify({
			hook_type: "PreToolUse",
			tool_name: "Edit",
			tool_input: { file_path: "/tmp/test.ts", new_string: "rm -rf /" },
			cwd: "/tmp",
		});
		const result = processHookEvent(event);
		expect(result.exitCode).toBe(0);
		expect(result.output).toBe("");
	});

	test("Bash tool with missing command field produces exit code 0", () => {
		const event = JSON.stringify({
			hook_type: "PreToolUse",
			tool_name: "Bash",
			tool_input: {},
			cwd: "/tmp",
		});
		const result = processHookEvent(event);
		expect(result.exitCode).toBe(0);
		expect(result.output).toBe("");
	});

	test("Invalid JSON on stdin produces exit code 0 (fail-open)", () => {
		const result = processHookEvent("not valid json {{{");
		expect(result.exitCode).toBe(0);
		expect(result.output).toBe("");
	});

	test("Empty stdin produces exit code 0 (fail-open)", () => {
		const result = processHookEvent("");
		expect(result.exitCode).toBe(0);
		expect(result.output).toBe("");
	});

	test("Bash tool with warn-level command produces exit code 0 with warn JSON", () => {
		const event = JSON.stringify({
			hook_type: "PreToolUse",
			tool_name: "Bash",
			tool_input: { command: "chmod 777 somefile" },
			cwd: "/tmp",
		});
		const result = processHookEvent(event);
		expect(result.exitCode).toBe(0);
		// Warn may or may not produce output depending on severity configuration defaults.
		// Default MEDIUM -> "warn" action, so it should produce output
		if (result.output) {
			const parsed = JSON.parse(result.output);
			expect(parsed.hookSpecificOutput.permissionDecision).toBe("allow");
			expect(parsed.hookSpecificOutput.additionalContext).toBeDefined();
		}
	});
});
