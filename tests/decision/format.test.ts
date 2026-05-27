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
	test("block decision → exitCode 2, JSON with decision='block'", () => {
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
		expect(parsed.decision).toBe("block");
		expect(parsed.reason).toBe(decision.message);
	});

	test("block decision includes rule, severity, category, suggestion, matchedPatterns", () => {
		const decision: Decision = {
			action: "block",
			severity: "HIGH",
			matchedRules: [
				mockMatch("shell.git-force-push", "git push --force", "HIGH"),
				mockMatch("shell.git-reset-hard", "git reset --hard", "HIGH"),
			],
			message: "Blocked: git push --force — Rule shell.git-force-push.",
			suggestion: "Use safer alternative",
			timestamp: "2024-01-15T10:30:00.000Z",
		};
		const result = formatHookOutput(decision);
		const parsed = JSON.parse(result.output);
		expect(parsed.rule).toBe("shell.git-force-push");
		expect(parsed.severity).toBe("HIGH");
		expect(parsed.category).toBe("shell");
		expect(parsed.suggestion).toBe("Use safer alternative");
		expect(parsed.matchedPatterns).toEqual([
			"shell.git-force-push",
			"shell.git-reset-hard",
		]);
	});

	test("warn decision → exitCode 0, JSON with decision='allow'", () => {
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
		expect(parsed.decision).toBe("allow");
		expect(parsed.reason).toBe(decision.message);
	});

	test("log decision → exitCode 0, empty output", () => {
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

	test("off decision → exitCode 0, empty output", () => {
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

	test("block with multiple matched rules → matchedPatterns contains all rule IDs", () => {
		const decision: Decision = {
			action: "block",
			severity: "CRITICAL",
			matchedRules: [
				mockMatch("shell.rm-recursive-root", "rm -rf /", "CRITICAL"),
				mockMatch("shell.rm-recursive-home", "rm -rf ~", "CRITICAL"),
				mockMatch("shell.destructive-flag", "--force", "HIGH"),
			],
			message: "Blocked: rm -rf / — Rule shell.rm-recursive-root.",
			suggestion: "Use safer alternative",
			timestamp: "2024-01-15T10:30:00.000Z",
		};
		const result = formatHookOutput(decision);
		const parsed = JSON.parse(result.output);
		expect(parsed.matchedPatterns).toEqual([
			"shell.rm-recursive-root",
			"shell.rm-recursive-home",
			"shell.destructive-flag",
		]);
	});

	test("block with no suggestion → suggestion field omitted from JSON", () => {
		const ruleNoSuggestion = {
			...mockRule("shell.test", "CRITICAL"),
			suggestion: undefined,
		};
		const decision: Decision = {
			action: "block",
			severity: "CRITICAL",
			matchedRules: [{ rule: ruleNoSuggestion, matchedText: "test cmd", index: 0 }],
			message: "Blocked: test cmd — Rule shell.test.",
			timestamp: "2024-01-15T10:30:00.000Z",
		};
		const result = formatHookOutput(decision);
		const parsed = JSON.parse(result.output);
		expect(parsed.suggestion).toBeUndefined();
		expect("suggestion" in parsed).toBe(false);
	});

	test("output JSON is valid parseable JSON", () => {
		const decision: Decision = {
			action: "block",
			severity: "HIGH",
			matchedRules: [mockMatch("shell.test", "cmd", "HIGH")],
			message: "Blocked: cmd — Rule shell.test.",
			suggestion: "Use safer alternative",
			timestamp: "2024-01-15T10:30:00.000Z",
		};
		const result = formatHookOutput(decision);
		expect(() => JSON.parse(result.output)).not.toThrow();
	});

	test("allow path (zero matchedRules) → exitCode 0, empty output", () => {
		const decision: Decision = {
			action: "off",
			matchedRules: [],
			timestamp: "2024-01-15T10:30:00.000Z",
		};
		const result = formatHookOutput(decision);
		expect(result.exitCode).toBe(0);
		expect(result.output).toBe("");
	});
});
