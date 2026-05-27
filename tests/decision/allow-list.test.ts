import { describe, expect, test } from "bun:test";
import { applyAllowList } from "../../src/decision/allow-list";
import type { AllowListEntry } from "../../src/types/config";
import type { Rule, RuleMatch } from "../../src/types/rule";
import type { Severity } from "../../src/types/severity";

/**
 * Test helpers
 */
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
	severity?: Severity,
): RuleMatch => ({
	rule: mockRule(ruleId, severity),
	matchedText: text,
	index: 0,
});

describe("applyAllowList", () => {
	test("empty matches array returns empty array regardless of allow-list", () => {
		const allowList: AllowListEntry[] = [
			{
				id: "entry-1",
				match: { ruleId: "shell.rm-recursive-root" },
				reason: "Allowed for testing",
			},
		];
		const result = applyAllowList([], allowList);
		expect(result).toEqual([]);
	});

	test("empty allow-list returns all matches unchanged", () => {
		const matches: RuleMatch[] = [
			mockMatch("shell.rm-recursive-root", "rm -rf /", "CRITICAL"),
			mockMatch("shell.git-force-push", "git push --force", "HIGH"),
		];
		const result = applyAllowList(matches, []);
		expect(result).toEqual(matches);
	});

	test("allow-list entry with ruleId removes only matches with that rule.id", () => {
		const matches: RuleMatch[] = [
			mockMatch("shell.rm-recursive-root", "rm -rf /", "CRITICAL"),
			mockMatch("shell.git-force-push", "git push --force", "HIGH"),
		];
		const allowList: AllowListEntry[] = [
			{
				id: "allow-rm",
				match: { ruleId: "shell.rm-recursive-root" },
				reason: "Known safe rm usage",
			},
		];
		const result = applyAllowList(matches, allowList);
		expect(result.length).toBe(1);
		expect(result[0].rule.id).toBe("shell.git-force-push");
	});

	test("allow-list entry with command removes all matches if command includes pattern", () => {
		const matches: RuleMatch[] = [
			mockMatch("shell.rm-recursive-root", "rm -rf /", "CRITICAL"),
			mockMatch("shell.git-force-push", "git push --force", "HIGH"),
		];
		const allowList: AllowListEntry[] = [
			{
				id: "allow-npm-test",
				match: { command: "npm test" },
				reason: "npm test is safe",
			},
		];
		const result = applyAllowList(matches, allowList, "npm test && rm -rf /");
		expect(result).toEqual([]);
	});

	test("allow-list entry with both ruleId AND command requires BOTH to match (AND logic)", () => {
		const matches: RuleMatch[] = [
			mockMatch("shell.rm-recursive-root", "rm -rf /", "CRITICAL"),
			mockMatch("shell.git-force-push", "git push --force", "HIGH"),
		];
		const allowList: AllowListEntry[] = [
			{
				id: "allow-rm-in-deploy",
				match: { ruleId: "shell.rm-recursive-root", command: "deploy.sh" },
				reason: "rm is safe in deploy script",
			},
		];
		// command does NOT include "deploy.sh" → entry should NOT suppress
		const result = applyAllowList(matches, allowList, "rm -rf /");
		expect(result.length).toBe(2);
	});

	test("allow-list entry with both ruleId AND command - both match", () => {
		const matches: RuleMatch[] = [
			mockMatch("shell.rm-recursive-root", "rm -rf /", "CRITICAL"),
			mockMatch("shell.git-force-push", "git push --force", "HIGH"),
		];
		const allowList: AllowListEntry[] = [
			{
				id: "allow-rm-in-deploy",
				match: { ruleId: "shell.rm-recursive-root", command: "deploy.sh" },
				reason: "rm is safe in deploy script",
			},
		];
		// command DOES include "deploy.sh" AND ruleId matches → suppress only that match
		const result = applyAllowList(
			matches,
			allowList,
			"./deploy.sh rm -rf /",
		);
		expect(result.length).toBe(1);
		expect(result[0].rule.id).toBe("shell.git-force-push");
	});

	test("allow-list entry with ruleId only - matches with different rule.id are preserved", () => {
		const matches: RuleMatch[] = [
			mockMatch("shell.chmod-777", "chmod 777 file", "MEDIUM"),
			mockMatch("shell.git-force-push", "git push --force", "HIGH"),
		];
		const allowList: AllowListEntry[] = [
			{
				id: "allow-rm",
				match: { ruleId: "shell.rm-recursive-root" },
				reason: "Allow rm",
			},
		];
		const result = applyAllowList(matches, allowList);
		expect(result.length).toBe(2);
	});

	test("expired allow-list entry is skipped (matches NOT suppressed)", () => {
		const matches: RuleMatch[] = [
			mockMatch("shell.rm-recursive-root", "rm -rf /", "CRITICAL"),
		];
		const allowList: AllowListEntry[] = [
			{
				id: "expired-entry",
				match: { ruleId: "shell.rm-recursive-root" },
				reason: "Temporary allow",
				expires: "2020-01-01T00:00:00Z",
			},
		];
		const result = applyAllowList(matches, allowList);
		expect(result.length).toBe(1);
		expect(result[0].rule.id).toBe("shell.rm-recursive-root");
	});

	test("non-expired allow-list entry is applied normally", () => {
		const matches: RuleMatch[] = [
			mockMatch("shell.rm-recursive-root", "rm -rf /", "CRITICAL"),
		];
		const allowList: AllowListEntry[] = [
			{
				id: "future-entry",
				match: { ruleId: "shell.rm-recursive-root" },
				reason: "Allowed until 2099",
				expires: "2099-12-31T23:59:59Z",
			},
		];
		const result = applyAllowList(matches, allowList);
		expect(result.length).toBe(0);
	});

	test("allow-list entry with no expires field is always applied (permanent)", () => {
		const matches: RuleMatch[] = [
			mockMatch("shell.rm-recursive-root", "rm -rf /", "CRITICAL"),
		];
		const allowList: AllowListEntry[] = [
			{
				id: "permanent-entry",
				match: { ruleId: "shell.rm-recursive-root" },
				reason: "Always allowed",
				// no expires field
			},
		];
		const result = applyAllowList(matches, allowList);
		expect(result.length).toBe(0);
	});

	test("multiple allow-list entries independently filter matches", () => {
		const matches: RuleMatch[] = [
			mockMatch("shell.rm-recursive-root", "rm -rf /", "CRITICAL"),
			mockMatch("shell.git-force-push", "git push --force", "HIGH"),
			mockMatch("shell.chmod-777", "chmod 777 file", "MEDIUM"),
		];
		const allowList: AllowListEntry[] = [
			{
				id: "allow-rm",
				match: { ruleId: "shell.rm-recursive-root" },
				reason: "Allow rm",
			},
			{
				id: "allow-git",
				match: { ruleId: "shell.git-force-push" },
				reason: "Allow git force push",
			},
		];
		const result = applyAllowList(matches, allowList);
		expect(result.length).toBe(1);
		expect(result[0].rule.id).toBe("shell.chmod-777");
	});

	test("allow-list entry with filePath field only is ignored for command matching", () => {
		const matches: RuleMatch[] = [
			mockMatch("shell.rm-recursive-root", "rm -rf /", "CRITICAL"),
		];
		const allowList: AllowListEntry[] = [
			{
				id: "filepath-only",
				match: { filePath: "/etc/passwd" },
				reason: "filePath only - for Write/Edit use",
			},
		];
		const result = applyAllowList(matches, allowList);
		// filePath-only entry should NOT suppress any command-level matches
		expect(result.length).toBe(1);
	});
});
