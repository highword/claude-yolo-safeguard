import { describe, expect, test } from "bun:test";
import { formatHookOutput } from "../../src/decision/format";
import type { Decision } from "../../src/types/decision";
import type { RuleMatch } from "../../src/types/rule";
import type { Rule } from "../../src/types/rule";
import type { Severity } from "../../src/types/severity";

const mockRule = (id: string, severity: Severity = "HIGH"): Rule => ({
	id,
	category: "shell",
	severity,
	pattern: ".*",
	keywords: ["test"],
	description: `Rule ${id}`,
	suggestion: "Use safer alternative",
	platforms: ["posix"],
	builtin: true,
});

const mockMatch = (
	ruleId: string,
	text: string,
	severity: Severity = "HIGH",
): RuleMatch => ({
	rule: mockRule(ruleId, severity),
	matchedText: text,
	index: 0,
});

describe("formatHookOutput", () => {
	test("block decision produces exitCode 2 and JSON with hookSpecificOutput.permissionDecision='deny'", () => {
		const decision: Decision = {
			action: "block",
			severity: "CRITICAL",
			matchedRules: [mockMatch("shell.rm-recursive-root", "rm -rf /", "CRITICAL")],
			message: "Blocked: rm -rf / — Rule shell.rm-recursive-root.",
			suggestion: "Use safer alternative",
			timestamp: "2024-01-15T10:30:00.000Z",
		};
		const result = formatHookOutput(decision);
		expect(result.exitCode).toBe(2);
		const parsed = JSON.parse(result.output);
		expect(parsed.hookSpecificOutput.permissionDecision).toBe("deny");
	});

	test("block decision includes systemMessage containing the decision.message text", () => {
		const decision: Decision = {
			action: "block",
			severity: "CRITICAL",
			matchedRules: [mockMatch("shell.rm-recursive-root", "rm -rf /", "CRITICAL")],
			message: "Blocked: rm -rf / — Rule shell.rm-recursive-root.",
			suggestion: "Use safer alternative",
			timestamp: "2024-01-15T10:30:00.000Z",
		};
		const result = formatHookOutput(decision);
		const parsed = JSON.parse(result.output);
		expect(parsed.systemMessage).toContain("Blocked: rm -rf /");
	});

	test("warn decision produces exitCode 0 and JSON with hookSpecificOutput.permissionDecision='allow' and additionalContext", () => {
		const decision: Decision = {
			action: "warn",
			severity: "MEDIUM",
			matchedRules: [mockMatch("shell.chmod-777", "chmod 777 file", "MEDIUM")],
			message: "Warning: chmod 777 file — Rule shell.chmod-777.",
			suggestion: "Use safer alternative",
			timestamp: "2024-01-15T10:30:00.000Z",
		};
		const result = formatHookOutput(decision);
		expect(result.exitCode).toBe(0);
		const parsed = JSON.parse(result.output);
		expect(parsed.hookSpecificOutput.permissionDecision).toBe("allow");
		expect(parsed.hookSpecificOutput.additionalContext).toContain("Warning: chmod 777 file");
	});

	test("log decision produces exitCode 0 and empty output string", () => {
		const decision: Decision = {
			action: "log",
			severity: "LOW",
			matchedRules: [mockMatch("shell.rm-file", "rm file.tmp", "LOW")],
			timestamp: "2024-01-15T10:30:00.000Z",
		};
		const result = formatHookOutput(decision);
		expect(result.exitCode).toBe(0);
		expect(result.output).toBe("");
	});

	test("off decision produces exitCode 0 and empty output string", () => {
		const decision: Decision = {
			action: "off",
			severity: "INFO",
			matchedRules: [mockMatch("shell.info-rule", "ls", "INFO")],
			timestamp: "2024-01-15T10:30:00.000Z",
		};
		const result = formatHookOutput(decision);
		expect(result.exitCode).toBe(0);
		expect(result.output).toBe("");
	});

	test("allow path (zero matchedRules) produces exitCode 0 and empty output", () => {
		const decision: Decision = {
			action: "off",
			matchedRules: [],
			timestamp: "2024-01-15T10:30:00.000Z",
		};
		const result = formatHookOutput(decision);
		expect(result.exitCode).toBe(0);
		expect(result.output).toBe("");
	});

	test("hookSpecificOutput.hookEventName is always 'PreToolUse' for block", () => {
		const decision: Decision = {
			action: "block",
			severity: "HIGH",
			matchedRules: [mockMatch("shell.git-force-push", "git push --force", "HIGH")],
			message: "Blocked: git push --force — Rule shell.git-force-push.",
			suggestion: "Use safer alternative",
			timestamp: "2024-01-15T10:30:00.000Z",
		};
		const result = formatHookOutput(decision);
		const parsed = JSON.parse(result.output);
		expect(parsed.hookSpecificOutput.hookEventName).toBe("PreToolUse");
	});

	test("hookSpecificOutput.hookEventName is always 'PreToolUse' for warn", () => {
		const decision: Decision = {
			action: "warn",
			severity: "MEDIUM",
			matchedRules: [mockMatch("shell.chmod-777", "chmod 777 file", "MEDIUM")],
			message: "Warning: chmod 777 file — Rule shell.chmod-777.",
			suggestion: "Use safer alternative",
			timestamp: "2024-01-15T10:30:00.000Z",
		};
		const result = formatHookOutput(decision);
		const parsed = JSON.parse(result.output);
		expect(parsed.hookSpecificOutput.hookEventName).toBe("PreToolUse");
	});

	test("output JSON is compact (no indentation/newlines)", () => {
		const decision: Decision = {
			action: "block",
			severity: "HIGH",
			matchedRules: [mockMatch("shell.test", "cmd", "HIGH")],
			message: "Blocked: cmd — Rule shell.test.",
			suggestion: "Use safer alternative",
			timestamp: "2024-01-15T10:30:00.000Z",
		};
		const result = formatHookOutput(decision);
		expect(result.output).not.toContain("\n");
		expect(result.output).not.toContain("  ");
	});
});
