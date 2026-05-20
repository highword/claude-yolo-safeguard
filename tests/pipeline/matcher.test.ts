import { describe, expect, test } from "bun:test";
import {
	compileRules,
	matchRules,
	applyFilters,
	COMPILED_SHELL_RULES,
} from "../../src/pipeline/matcher";
import { ALL_RULES } from "../../src/rules/index";
import {
	parseCommand,
	buildTokenSpans,
} from "../../src/pipeline/parser";
import type { Rule } from "../../src/types/rule";
import type { CompiledRule, TokenSpan } from "../../src/pipeline/types";

/**
 * Helper: parse a command string, build token spans from the first segment.
 */
function spansFor(cmd: string): TokenSpan[] {
	const tokens = parseCommand(cmd);
	return buildTokenSpans(tokens);
}

describe("compileRules", () => {
	test("compiles shell-category rules into CompiledRule array", () => {
		const shellRules = ALL_RULES.filter((r) => r.category === "shell");
		const compiled = compileRules(shellRules);
		expect(compiled.length).toBe(shellRules.length);
		for (const cr of compiled) {
			expect(cr.rule).toBeDefined();
			expect(cr.regex).toBeInstanceOf(RegExp);
		}
	});

	test("returns empty array for empty input", () => {
		const compiled = compileRules([]);
		expect(compiled).toEqual([]);
	});

	test("each CompiledRule has a pre-compiled RegExp from rule.pattern", () => {
		const testRule: Rule = {
			id: "test.rule",
			category: "shell",
			severity: "HIGH",
			pattern: "rm\\s+-rf",
			keywords: ["rm"],
			description: "test",
			builtin: true,
		};
		const compiled = compileRules([testRule]);
		expect(compiled[0].regex.test("rm -rf")).toBe(true);
		expect(compiled[0].regex.test("echo hello")).toBe(false);
	});
});

describe("matchRules", () => {
	// Use the pre-compiled rules for realistic testing
	const compiled = COMPILED_SHELL_RULES;

	test("rm -rf / matches shell.rm-recursive-root", () => {
		const cmd = "rm -rf /";
		const spans = spansFor(cmd);
		const matches = matchRules(cmd, spans, compiled);
		expect(matches.length).toBeGreaterThanOrEqual(1);
		const rmMatch = matches.find(
			(m) => m.rule.id === "shell.rm-recursive-root",
		);
		expect(rmMatch).toBeDefined();
		expect(rmMatch!.matchedText).toBeDefined();
	});

	test("rm -rf node_modules returns NO match (filter notContains suppresses)", () => {
		const cmd = "rm -rf node_modules";
		const spans = spansFor(cmd);
		const matches = matchRules(cmd, spans, compiled);
		// shell.rm-recursive-force has filter notContains: "node_modules"
		const forceMatch = matches.find(
			(m) => m.rule.id === "shell.rm-recursive-force",
		);
		expect(forceMatch).toBeUndefined();
	});

	test("git push --force main matches shell.git-force-push", () => {
		const cmd = "git push --force main";
		const spans = spansFor(cmd);
		const matches = matchRules(cmd, spans, compiled);
		const pushMatch = matches.find(
			(m) => m.rule.id === "shell.git-force-push",
		);
		expect(pushMatch).toBeDefined();
	});

	test("git push --force-with-lease returns NO match (negative lookahead)", () => {
		const cmd = "git push --force-with-lease";
		const spans = spansFor(cmd);
		const matches = matchRules(cmd, spans, compiled);
		const pushMatch = matches.find(
			(m) => m.rule.id === "shell.git-force-push",
		);
		expect(pushMatch).toBeUndefined();
	});

	test("git branch -D feature matches shell.git-branch-D", () => {
		const cmd = "git branch -D feature";
		const spans = spansFor(cmd);
		const matches = matchRules(cmd, spans, compiled);
		const branchMatch = matches.find(
			(m) => m.rule.id === "shell.git-branch-D",
		);
		expect(branchMatch).toBeDefined();
	});

	test("git branch -d feature returns NO match (lowercase -d not matched)", () => {
		const cmd = "git branch -d feature";
		const spans = spansFor(cmd);
		const matches = matchRules(cmd, spans, compiled);
		const branchMatch = matches.find(
			(m) => m.rule.id === "shell.git-branch-D",
		);
		expect(branchMatch).toBeUndefined();
	});

	test("DROP DATABASE users matches shell.drop-database", () => {
		const cmd = "DROP DATABASE users";
		const spans = spansFor(cmd);
		const matches = matchRules(cmd, spans, compiled);
		const dropMatch = matches.find(
			(m) => m.rule.id === "shell.drop-database",
		);
		expect(dropMatch).toBeDefined();
	});

	test("rm file.tmp returns NO match (no recursive flag, no root target)", () => {
		const cmd = "rm file.tmp";
		const spans = spansFor(cmd);
		const matches = matchRules(cmd, spans, compiled);
		expect(matches).toEqual([]);
	});

	test("git checkout -b new-branch returns NO match (safe variant)", () => {
		const cmd = "git checkout -b new-branch";
		const spans = spansFor(cmd);
		const matches = matchRules(cmd, spans, compiled);
		expect(matches).toEqual([]);
	});

	test("git stash drop matches shell.git-stash-drop", () => {
		const cmd = "git stash drop";
		const spans = spansFor(cmd);
		const matches = matchRules(cmd, spans, compiled);
		const stashMatch = matches.find(
			(m) => m.rule.id === "shell.git-stash-drop",
		);
		expect(stashMatch).toBeDefined();
	});
});

describe("applyFilters", () => {
	test("rule with notContains filter rejects when value is present", () => {
		const rule: Rule = {
			id: "test.filter",
			category: "shell",
			severity: "HIGH",
			pattern: "rm\\s+-rf",
			filters: [{ type: "notContains", value: "node_modules" }],
			keywords: ["rm"],
			description: "test",
			builtin: true,
		};
		const result = applyFilters(rule, "rm -rf node_modules");
		expect(result).toBe(false);
	});

	test("rule with no filters always passes", () => {
		const rule: Rule = {
			id: "test.nofilter",
			category: "shell",
			severity: "HIGH",
			pattern: "rm\\s+-rf",
			keywords: ["rm"],
			description: "test",
			builtin: true,
		};
		const result = applyFilters(rule, "rm -rf /");
		expect(result).toBe(true);
	});

	test("rule with contains filter rejects when value is absent", () => {
		const rule: Rule = {
			id: "test.contains",
			category: "shell",
			severity: "HIGH",
			pattern: "test",
			filters: [{ type: "contains", value: "required" }],
			keywords: ["test"],
			description: "test",
			builtin: true,
		};
		const result = applyFilters(rule, "test something");
		expect(result).toBe(false);
	});

	test("rule with contains filter passes when value is present", () => {
		const rule: Rule = {
			id: "test.contains",
			category: "shell",
			severity: "HIGH",
			pattern: "test",
			filters: [{ type: "contains", value: "required" }],
			keywords: ["test"],
			description: "test",
			builtin: true,
		};
		const result = applyFilters(rule, "test required content");
		expect(result).toBe(true);
	});
});

describe("token position suppression", () => {
	test("match in multi-word argument position is suppressed", () => {
		// echo "rm -rf /" → tokens: ["echo", "rm -rf /"]
		// "rm -rf /" is in argument position and is multi-word (was quoted)
		const cmd = "echo rm -rf /";
		// Simulate the scenario where "rm -rf /" is a single multi-word argument token
		const tokens = parseCommand('echo "rm -rf /"');
		const spans = buildTokenSpans(tokens);
		const segmentStr = "echo rm -rf /";
		const compiled = COMPILED_SHELL_RULES;
		const matches = matchRules(segmentStr, spans, compiled);
		// The match should be suppressed because it falls within a multi-word argument
		const rmMatch = matches.find(
			(m) => m.rule.id === "shell.rm-recursive-root",
		);
		expect(rmMatch).toBeUndefined();
	});

	test("match in multi-word argument NOT suppressed when isShellWrapperArg is true", () => {
		// bash -c "rm -rf /" → after extraction, we analyze "rm -rf /" directly
		// When analyzing shell wrapper arguments, suppression doesn't apply
		const cmd = "rm -rf /";
		const spans = spansFor(cmd);
		const compiled = COMPILED_SHELL_RULES;
		const matches = matchRules(cmd, spans, compiled, true);
		const rmMatch = matches.find(
			(m) => m.rule.id === "shell.rm-recursive-root",
		);
		expect(rmMatch).toBeDefined();
	});

	test("match in command position is NOT suppressed", () => {
		// rm -rf / → "rm" is in command position, match should stand
		const cmd = "rm -rf /";
		const spans = spansFor(cmd);
		const compiled = COMPILED_SHELL_RULES;
		const matches = matchRules(cmd, spans, compiled);
		const rmMatch = matches.find(
			(m) => m.rule.id === "shell.rm-recursive-root",
		);
		expect(rmMatch).toBeDefined();
	});
});

describe("COMPILED_SHELL_RULES", () => {
	test("is pre-compiled at module load with shell-category rules only", () => {
		expect(COMPILED_SHELL_RULES.length).toBeGreaterThan(0);
		for (const cr of COMPILED_SHELL_RULES) {
			expect(cr.rule.category).toBe("shell");
			expect(cr.regex).toBeInstanceOf(RegExp);
		}
	});

	test("does not include content-category rules", () => {
		for (const cr of COMPILED_SHELL_RULES) {
			expect(cr.rule.category).not.toBe("content");
		}
	});
});
