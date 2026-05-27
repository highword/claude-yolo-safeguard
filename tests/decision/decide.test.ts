import { describe, expect, test } from "bun:test";
import { makeDecision } from "../../src/decision/decide";
import type { Rule, RuleMatch } from "../../src/types/rule";
import type { Severity, SeverityActionMap } from "../../src/types/severity";
import { DEFAULT_SEVERITY_ACTIONS } from "../../src/types/severity";

/**
 * Test helpers
 */
const mockRule = (
	id: string,
	severity: Severity = "HIGH",
	suggestion?: string,
): Rule => ({
	id,
	category: "shell",
	severity,
	pattern: ".*",
	keywords: ["test"],
	description: `Rule ${id}`,
	suggestion,
	platforms: ["posix"],
	builtin: true,
});

const mockMatch = (
	ruleId: string,
	text: string,
	severity: Severity = "HIGH",
	suggestion?: string,
): RuleMatch => ({
	rule: mockRule(ruleId, severity, suggestion),
	matchedText: text,
	index: 0,
});

// Pre-built test fixtures
const criticalMatch = mockMatch(
	"shell.rm-recursive-root",
	"rm -rf /",
	"CRITICAL",
	"Use rm with specific file paths instead",
);
const highMatch = mockMatch(
	"shell.git-force-push",
	"git push --force",
	"HIGH",
	"Use --force-with-lease for safer force push",
);
const mediumMatch = mockMatch(
	"shell.chmod-777",
	"chmod 777 file",
	"MEDIUM",
	"Use more restrictive permissions like 755",
);
const lowMatch = mockMatch("shell.rm-file", "rm file.tmp", "LOW", undefined);
const infoMatch = mockMatch("shell.ls-hidden", "ls -la", "INFO", undefined);

describe("makeDecision", () => {
	test("empty matches returns Decision with action='off', matchedRules=[], no message", () => {
		const decision = makeDecision([], DEFAULT_SEVERITY_ACTIONS);
		expect(decision.action).toBe("off");
		expect(decision.matchedRules).toEqual([]);
		expect(decision.message).toBeUndefined();
		expect(decision.severity).toBeUndefined();
		expect(decision.suggestion).toBeUndefined();
		expect(decision.timestamp).toBeDefined();
	});

	test("single CRITICAL match produces action='block', severity='CRITICAL'", () => {
		const decision = makeDecision([criticalMatch], DEFAULT_SEVERITY_ACTIONS);
		expect(decision.action).toBe("block");
		expect(decision.severity).toBe("CRITICAL");
		expect(decision.message).toContain("rm -rf /");
		expect(decision.message).toContain("Rule shell.rm-recursive-root");
	});

	test("single HIGH match produces action='block', severity='HIGH'", () => {
		const decision = makeDecision([highMatch], DEFAULT_SEVERITY_ACTIONS);
		expect(decision.action).toBe("block");
		expect(decision.severity).toBe("HIGH");
		expect(decision.message).toContain("Blocked:");
		expect(decision.message).toContain(
			"Use --force-with-lease for safer force push",
		);
	});

	test("single MEDIUM match produces action='warn', severity='MEDIUM'", () => {
		const decision = makeDecision([mediumMatch], DEFAULT_SEVERITY_ACTIONS);
		expect(decision.action).toBe("warn");
		expect(decision.severity).toBe("MEDIUM");
		expect(decision.message).toContain("Warning:");
	});

	test("single LOW match produces action='log', severity='LOW', no message", () => {
		const decision = makeDecision([lowMatch], DEFAULT_SEVERITY_ACTIONS);
		expect(decision.action).toBe("log");
		expect(decision.severity).toBe("LOW");
		expect(decision.message).toBeUndefined();
	});

	test("single INFO match produces action='off', severity='INFO', no message", () => {
		const decision = makeDecision([infoMatch], DEFAULT_SEVERITY_ACTIONS);
		expect(decision.action).toBe("off");
		expect(decision.severity).toBe("INFO");
		expect(decision.message).toBeUndefined();
	});

	test("multiple matches (HIGH + LOW) - highest severity wins - action='block'", () => {
		const decision = makeDecision(
			[highMatch, lowMatch],
			DEFAULT_SEVERITY_ACTIONS,
		);
		expect(decision.action).toBe("block");
		expect(decision.severity).toBe("HIGH");
	});

	test("multiple matches (CRITICAL + HIGH + MEDIUM) - CRITICAL wins, message lists 'Also triggered'", () => {
		const decision = makeDecision(
			[criticalMatch, highMatch, mediumMatch],
			DEFAULT_SEVERITY_ACTIONS,
		);
		expect(decision.action).toBe("block");
		expect(decision.severity).toBe("CRITICAL");
		expect(decision.message).toContain("Also triggered:");
		expect(decision.message).toContain("shell.git-force-push");
		expect(decision.message).toContain("shell.chmod-777");
	});

	test("Decision.matchedRules contains ALL matches (not just primary)", () => {
		const decision = makeDecision(
			[criticalMatch, highMatch, mediumMatch],
			DEFAULT_SEVERITY_ACTIONS,
		);
		expect(decision.matchedRules.length).toBe(3);
		expect(decision.matchedRules).toContain(criticalMatch);
		expect(decision.matchedRules).toContain(highMatch);
		expect(decision.matchedRules).toContain(mediumMatch);
	});

	test("Decision.suggestion comes from the primary (highest severity) rule", () => {
		const decision = makeDecision(
			[criticalMatch, highMatch],
			DEFAULT_SEVERITY_ACTIONS,
		);
		expect(decision.suggestion).toBe(
			"Use rm with specific file paths instead",
		);
	});

	test("Decision.timestamp is a valid ISO string", () => {
		const decision = makeDecision([highMatch], DEFAULT_SEVERITY_ACTIONS);
		const parsed = new Date(decision.timestamp);
		expect(parsed.toISOString()).toBe(decision.timestamp);
	});

	test("custom severityActions map where MEDIUM='block' produces action='block'", () => {
		const customActions: SeverityActionMap = {
			CRITICAL: "block",
			HIGH: "block",
			MEDIUM: "block",
			LOW: "warn",
			INFO: "log",
		};
		const decision = makeDecision([mediumMatch], customActions);
		expect(decision.action).toBe("block");
		expect(decision.severity).toBe("MEDIUM");
	});

	test("rule without suggestion field produces undefined Decision.suggestion", () => {
		const noSuggestionMatch = mockMatch(
			"shell.some-rule",
			"some command",
			"HIGH",
			undefined,
		);
		const decision = makeDecision(
			[noSuggestionMatch],
			DEFAULT_SEVERITY_ACTIONS,
		);
		expect(decision.suggestion).toBeUndefined();
	});

	test("block message format: 'Blocked: {matchedText} - {description}. Suggest: {suggestion}'", () => {
		const decision = makeDecision([highMatch], DEFAULT_SEVERITY_ACTIONS);
		expect(decision.message).toBe(
			"Blocked: git push --force — Rule shell.git-force-push. Suggest: Use --force-with-lease for safer force push",
		);
	});

	test("block message format with no suggestion: 'Blocked: {matchedText} - {description}.'", () => {
		const noSuggestionMatch = mockMatch(
			"shell.dangerous",
			"dangerous cmd",
			"HIGH",
			undefined,
		);
		const decision = makeDecision(
			[noSuggestionMatch],
			DEFAULT_SEVERITY_ACTIONS,
		);
		expect(decision.message).toBe(
			"Blocked: dangerous cmd — Rule shell.dangerous.",
		);
	});

	test("warn message format: 'Warning: {matchedText} - {description}. Consider: {suggestion}'", () => {
		const decision = makeDecision([mediumMatch], DEFAULT_SEVERITY_ACTIONS);
		expect(decision.message).toBe(
			"Warning: chmod 777 file — Rule shell.chmod-777. Consider: Use more restrictive permissions like 755",
		);
	});

	test("warn message format with no suggestion", () => {
		const noSuggestionWarn = mockMatch(
			"shell.risky",
			"risky cmd",
			"MEDIUM",
			undefined,
		);
		const decision = makeDecision(
			[noSuggestionWarn],
			DEFAULT_SEVERITY_ACTIONS,
		);
		expect(decision.message).toBe(
			"Warning: risky cmd — Rule shell.risky.",
		);
	});
});
