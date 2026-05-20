import { describe, expect, it } from "bun:test";
import { analyzeCommand } from "../../src/pipeline/index";
import type { AnalysisResult } from "../../src/pipeline/types";
import type { Rule } from "../../src/types/rule";

describe("analyzeCommand - Integration Tests", () => {
	describe("SHELL-01: Filesystem destruction detection", () => {
		it("detects rm -rf / as CRITICAL", () => {
			const result = analyzeCommand("rm -rf /");
			expect(result.matches.length).toBeGreaterThanOrEqual(1);
			const match = result.matches.find(
				(m) => m.rule.id === "shell.rm-recursive-root",
			);
			expect(match).toBeDefined();
			expect(match!.rule.severity).toBe("CRITICAL");
		});

		it("detects rm -rf ~ as CRITICAL", () => {
			const result = analyzeCommand("rm -rf ~");
			expect(result.matches.length).toBeGreaterThanOrEqual(1);
			const match = result.matches.find(
				(m) => m.rule.id === "shell.rm-recursive-root",
			);
			expect(match).toBeDefined();
			expect(match!.rule.severity).toBe("CRITICAL");
		});

		it("returns zero matches for rm file.tmp (safe)", () => {
			const result = analyzeCommand("rm file.tmp");
			expect(result.matches).toHaveLength(0);
		});

		it("returns zero matches for rm -rf node_modules (filter suppresses)", () => {
			const result = analyzeCommand("rm -rf node_modules");
			expect(result.matches).toHaveLength(0);
		});
	});

	describe("SHELL-02: Git force push and reset detection", () => {
		it("detects git push --force main as CRITICAL", () => {
			const result = analyzeCommand("git push --force main");
			expect(result.matches.length).toBeGreaterThanOrEqual(1);
			const match = result.matches.find(
				(m) => m.rule.id === "shell.git-force-push",
			);
			expect(match).toBeDefined();
			expect(match!.rule.severity).toBe("CRITICAL");
		});

		it("returns zero matches for git push --force-with-lease (safe variant)", () => {
			const result = analyzeCommand("git push --force-with-lease");
			expect(result.matches).toHaveLength(0);
		});

		it("detects git reset --hard as HIGH", () => {
			const result = analyzeCommand("git reset --hard");
			expect(result.matches.length).toBeGreaterThanOrEqual(1);
			const match = result.matches.find(
				(m) => m.rule.id === "shell.git-reset-hard",
			);
			expect(match).toBeDefined();
			expect(match!.rule.severity).toBe("HIGH");
		});

		it("detects git clean -fd as HIGH", () => {
			const result = analyzeCommand("git clean -fd");
			expect(result.matches.length).toBeGreaterThanOrEqual(1);
			const match = result.matches.find(
				(m) => m.rule.id === "shell.git-clean-force",
			);
			expect(match).toBeDefined();
			expect(match!.rule.severity).toBe("HIGH");
		});
	});

	describe("SHELL-03: Git branch and stash operations", () => {
		it("detects git branch -D feature as MEDIUM", () => {
			const result = analyzeCommand("git branch -D feature");
			expect(result.matches.length).toBeGreaterThanOrEqual(1);
			const match = result.matches.find(
				(m) => m.rule.id === "shell.git-branch-D",
			);
			expect(match).toBeDefined();
			expect(match!.rule.severity).toBe("MEDIUM");
		});

		it("returns zero matches for git branch -d feature (safe lowercase)", () => {
			const result = analyzeCommand("git branch -d feature");
			expect(result.matches).toHaveLength(0);
		});

		it("detects git stash drop as MEDIUM", () => {
			const result = analyzeCommand("git stash drop");
			expect(result.matches.length).toBeGreaterThanOrEqual(1);
			const match = result.matches.find(
				(m) => m.rule.id === "shell.git-stash-drop",
			);
			expect(match).toBeDefined();
			expect(match!.rule.severity).toBe("MEDIUM");
		});

		it("detects git stash clear as MEDIUM", () => {
			const result = analyzeCommand("git stash clear");
			expect(result.matches.length).toBeGreaterThanOrEqual(1);
			const match = result.matches.find(
				(m) => m.rule.id === "shell.git-stash-drop",
			);
			expect(match).toBeDefined();
			expect(match!.rule.severity).toBe("MEDIUM");
		});
	});

	describe("SHELL-04: Database destruction detection", () => {
		it("detects DROP DATABASE users as CRITICAL", () => {
			const result = analyzeCommand("DROP DATABASE users");
			expect(result.matches.length).toBeGreaterThanOrEqual(1);
			const match = result.matches.find(
				(m) => m.rule.id === "shell.drop-database",
			);
			expect(match).toBeDefined();
			expect(match!.rule.severity).toBe("CRITICAL");
		});

		it("detects DROP TABLE sessions as CRITICAL", () => {
			const result = analyzeCommand("DROP TABLE sessions");
			expect(result.matches.length).toBeGreaterThanOrEqual(1);
			const match = result.matches.find(
				(m) => m.rule.id === "shell.drop-table",
			);
			expect(match).toBeDefined();
			expect(match!.rule.severity).toBe("CRITICAL");
		});

		it("detects TRUNCATE TABLE logs as HIGH", () => {
			const result = analyzeCommand("TRUNCATE TABLE logs");
			expect(result.matches.length).toBeGreaterThanOrEqual(1);
			const match = result.matches.find(
				(m) => m.rule.id === "shell.truncate-table",
			);
			expect(match).toBeDefined();
			expect(match!.rule.severity).toBe("HIGH");
		});
	});

	describe("SHELL-05: Nested shell wrapper detection", () => {
		it("detects danger inside bash -c wrapping", () => {
			const result = analyzeCommand('bash -c "rm -rf /"');
			expect(result.matches.length).toBeGreaterThanOrEqual(1);
			const match = result.matches.find(
				(m) => m.rule.severity === "CRITICAL",
			);
			expect(match).toBeDefined();
		});

		it("detects danger through 2 layers of shell wrapping", () => {
			const result = analyzeCommand('sh -c "sh -c \\"rm -rf /\\""');
			expect(result.matches.length).toBeGreaterThanOrEqual(1);
			const match = result.matches.find(
				(m) => m.rule.severity === "CRITICAL",
			);
			expect(match).toBeDefined();
		});

		it("detects danger through multiple layers of bash -c nesting", () => {
			// Test with properly nested commands that shell-quote can parse
			// bash -c 'bash -c "rm -rf /"' - 2 layers deep
			const result = analyzeCommand('bash -c "bash -c \\"rm -rf /\\""');
			expect(result.matches.length).toBeGreaterThanOrEqual(1);
			expect(result.maxDepth).toBeGreaterThanOrEqual(1);
			const match = result.matches.find(
				(m) => m.rule.severity === "CRITICAL",
			);
			expect(match).toBeDefined();
		});

		it("enforces MAX_DEPTH=10 limit and does not infinite loop", () => {
			// Build deeply nested command - verifies depth limiting works
			let cmd = "rm -rf /";
			for (let i = 0; i < 11; i++) {
				cmd = `bash -c "${cmd.replace(/"/g, '\\"')}"`;
			}
			const result = analyzeCommand(cmd);
			// The important contract: it returns without crashing/looping
			// and maxDepth never exceeds the internal limit
			expect(result.maxDepth).toBeLessThanOrEqual(10);
			expect(result).toHaveProperty("matches");
			expect(result).toHaveProperty("segmentCount");
		});
	});

	describe("SHELL-06: Interpreter one-liner detection", () => {
		it("detects danger in python -c with os.system", () => {
			const result = analyzeCommand(
				"python -c \"import os; os.system('rm -rf /')\"",
			);
			expect(result.matches.length).toBeGreaterThanOrEqual(1);
		});

		it("detects danger in node -e with child_process", () => {
			const result = analyzeCommand(
				"node -e \"require('child_process').exec('rm -rf /')\"",
			);
			expect(result.matches.length).toBeGreaterThanOrEqual(1);
		});

		it("detects danger in ruby -e with system call", () => {
			const result = analyzeCommand("ruby -e \"system('rm -rf /')\"");
			expect(result.matches.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe("SHELL-07: Compound command segmentation", () => {
		it("detects rm -rf / in compound ls && rm -rf / || echo done", () => {
			const result = analyzeCommand("ls && rm -rf / || echo done");
			expect(result.matches.length).toBeGreaterThanOrEqual(1);
			const match = result.matches.find(
				(m) => m.rule.id === "shell.rm-recursive-root",
			);
			expect(match).toBeDefined();
		});

		it("detects both dangerous commands in git push --force main; git clean -fd", () => {
			const result = analyzeCommand(
				"git push --force main; git clean -fd",
			);
			expect(result.matches.length).toBeGreaterThanOrEqual(2);
			const forcePush = result.matches.find(
				(m) => m.rule.id === "shell.git-force-push",
			);
			const cleanForce = result.matches.find(
				(m) => m.rule.id === "shell.git-clean-force",
			);
			expect(forcePush).toBeDefined();
			expect(cleanForce).toBeDefined();
		});

		it("returns zero matches for cat file | grep pattern (safe pipe)", () => {
			const result = analyzeCommand("cat file | grep pattern");
			expect(result.matches).toHaveLength(0);
		});
	});

	describe("SHELL-08: Safe variant no-false-positive", () => {
		it("returns zero matches for git checkout -b new-branch", () => {
			const result = analyzeCommand("git checkout -b new-branch");
			expect(result.matches).toHaveLength(0);
		});

		it("returns zero matches for git push origin main (no --force)", () => {
			const result = analyzeCommand("git push origin main");
			expect(result.matches).toHaveLength(0);
		});
	});

	describe("SHELL-09: Quoted argument false-positive reduction", () => {
		it("returns zero matches for echo 'rm -rf /' (quoted argument)", () => {
			const result = analyzeCommand("echo 'rm -rf /'");
			expect(result.matches).toHaveLength(0);
		});

		it("returns zero matches for gh issue create --body 'git reset --hard'", () => {
			const result = analyzeCommand(
				"gh issue create --body 'git reset --hard'",
			);
			expect(result.matches).toHaveLength(0);
		});

		it("returns zero matches for echo 'DROP DATABASE'", () => {
			const result = analyzeCommand("echo 'DROP DATABASE'");
			expect(result.matches).toHaveLength(0);
		});
	});

	describe("PLAT-01/02: Platform detection and POSIX support", () => {
		it("analyzes rm -rf / correctly via POSIX shell-quote pipeline", () => {
			const result = analyzeCommand("rm -rf /");
			expect(result.matches.length).toBeGreaterThanOrEqual(1);
			expect(result.segmentCount).toBeGreaterThanOrEqual(1);
		});

		it("PowerShell-style commands use regex-only fallback", () => {
			// PowerShell command should not crash and should use regex fallback
			const result = analyzeCommand(
				"Remove-Item -Recurse -Force C:\\Users",
			);
			// Should not throw; regex fallback handles it
			expect(result).toBeDefined();
			expect(result.matches).toBeDefined();
		});
	});

	describe("Quick Reject fast-path", () => {
		it("returns immediately for ls -la (no keywords)", () => {
			const result = analyzeCommand("ls -la");
			expect(result.matches).toHaveLength(0);
			expect(result.segmentCount).toBe(0);
			expect(result.maxDepth).toBe(0);
		});
	});

	describe("AnalysisResult structure", () => {
		it("returns AnalysisResult with matches, segmentCount, maxDepth", () => {
			const result = analyzeCommand("rm -rf /");
			expect(result).toHaveProperty("matches");
			expect(result).toHaveProperty("segmentCount");
			expect(result).toHaveProperty("maxDepth");
			expect(Array.isArray(result.matches)).toBe(true);
			expect(typeof result.segmentCount).toBe("number");
			expect(typeof result.maxDepth).toBe("number");
		});
	});

	describe("Custom rules support", () => {
		it("includes custom rules in matching when provided", () => {
			const customRule: Rule = {
				id: "custom.test-rule",
				category: "shell",
				severity: "HIGH",
				pattern: "dangerous-custom-cmd",
				keywords: ["dangerous-custom-cmd"],
				description: "Test custom rule",
				builtin: false,
			};
			const result = analyzeCommand("dangerous-custom-cmd --flag", [
				customRule,
			]);
			expect(result.matches.length).toBeGreaterThanOrEqual(1);
			const match = result.matches.find(
				(m) => m.rule.id === "custom.test-rule",
			);
			expect(match).toBeDefined();
		});
	});
});
