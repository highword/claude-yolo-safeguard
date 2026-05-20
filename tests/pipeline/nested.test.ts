import { describe, expect, test } from "bun:test";
import {
	extractNestedCommands,
	extractSubshells,
	SHELL_WRAPPERS,
	INTERPRETERS,
} from "../../src/pipeline/nested";
import type { ParseEntry } from "../../src/pipeline/types";

describe("extractNestedCommands", () => {
	describe("shell wrappers", () => {
		test("bash -c extracts inner command", () => {
			const tokens: ParseEntry[] = ["bash", "-c", "rm -rf /"];
			const result = extractNestedCommands(tokens);
			expect(result).toEqual([
				{ command: "rm -rf /", source: "shell-wrapper" },
			]);
		});

		test("sh -c extracts inner command", () => {
			const tokens: ParseEntry[] = ["sh", "-c", "ls"];
			const result = extractNestedCommands(tokens);
			expect(result).toEqual([{ command: "ls", source: "shell-wrapper" }]);
		});

		test("/bin/bash -c extracts inner command", () => {
			const tokens: ParseEntry[] = ["/bin/bash", "-c", "echo hello"];
			const result = extractNestedCommands(tokens);
			expect(result).toEqual([
				{ command: "echo hello", source: "shell-wrapper" },
			]);
		});

		test("/usr/bin/env bash -c extracts inner command", () => {
			const tokens: ParseEntry[] = [
				"/usr/bin/env",
				"bash",
				"-c",
				"rm -rf /",
			];
			const result = extractNestedCommands(tokens);
			expect(result).toEqual([
				{ command: "rm -rf /", source: "shell-wrapper" },
			]);
		});

		test("env sh -c extracts inner command", () => {
			const tokens: ParseEntry[] = ["env", "sh", "-c", "echo test"];
			const result = extractNestedCommands(tokens);
			expect(result).toEqual([
				{ command: "echo test", source: "shell-wrapper" },
			]);
		});
	});

	describe("interpreters", () => {
		test("python -c extracts code string", () => {
			const tokens: ParseEntry[] = [
				"python",
				"-c",
				"import os; os.system('rm -rf /')",
			];
			const result = extractNestedCommands(tokens);
			expect(result).toEqual([
				{
					command: "import os; os.system('rm -rf /')",
					source: "interpreter",
				},
			]);
		});

		test("python3 -c extracts code string", () => {
			const tokens: ParseEntry[] = ["python3", "-c", "print('hello')"];
			const result = extractNestedCommands(tokens);
			expect(result).toEqual([
				{ command: "print('hello')", source: "interpreter" },
			]);
		});

		test("node -e extracts code string", () => {
			const tokens: ParseEntry[] = [
				"node",
				"-e",
				"require('child_process').exec('rm -rf /')",
			];
			const result = extractNestedCommands(tokens);
			expect(result).toEqual([
				{
					command: "require('child_process').exec('rm -rf /')",
					source: "interpreter",
				},
			]);
		});

		test("ruby -e extracts code string", () => {
			const tokens: ParseEntry[] = [
				"ruby",
				"-e",
				"system('rm -rf /')",
			];
			const result = extractNestedCommands(tokens);
			expect(result).toEqual([
				{ command: "system('rm -rf /')", source: "interpreter" },
			]);
		});

		test("perl -e extracts code string", () => {
			const tokens: ParseEntry[] = [
				"perl",
				"-e",
				"system('rm -rf /')",
			];
			const result = extractNestedCommands(tokens);
			expect(result).toEqual([
				{ command: "system('rm -rf /')", source: "interpreter" },
			]);
		});

		test("node --eval extracts code string", () => {
			const tokens: ParseEntry[] = ["node", "--eval", "console.log(1)"];
			const result = extractNestedCommands(tokens);
			expect(result).toEqual([
				{ command: "console.log(1)", source: "interpreter" },
			]);
		});
	});

	describe("non-nested commands", () => {
		test("echo hello returns empty array", () => {
			const tokens: ParseEntry[] = ["echo", "hello"];
			const result = extractNestedCommands(tokens);
			expect(result).toEqual([]);
		});

		test("ls -la returns empty array", () => {
			const tokens: ParseEntry[] = ["ls", "-la"];
			const result = extractNestedCommands(tokens);
			expect(result).toEqual([]);
		});

		test("empty array returns empty array", () => {
			const tokens: ParseEntry[] = [];
			const result = extractNestedCommands(tokens);
			expect(result).toEqual([]);
		});
	});
});

describe("extractSubshells", () => {
	test("$(...) pattern extracts inner command", () => {
		// echo $(rm -rf /) → ["echo", "$", {op:"("}, "rm", "-rf", "/", {op:")"}]
		const tokens: ParseEntry[] = [
			"echo",
			"$",
			{ op: "(" },
			"rm",
			"-rf",
			"/",
			{ op: ")" },
		];
		const result = extractSubshells(tokens);
		expect(result).toEqual([
			{ command: "rm -rf /", source: "subshell" },
		]);
	});

	test("no $(...) pattern returns empty array", () => {
		const tokens: ParseEntry[] = ["echo", "hello", "world"];
		const result = extractSubshells(tokens);
		expect(result).toEqual([]);
	});

	test("nested $(...) with multiple tokens", () => {
		// result=$(ls -la /tmp)
		const tokens: ParseEntry[] = [
			"result=$",
			{ op: "(" },
			"ls",
			"-la",
			"/tmp",
			{ op: ")" },
		];
		const result = extractSubshells(tokens);
		expect(result).toEqual([
			{ command: "ls -la /tmp", source: "subshell" },
		]);
	});
});

describe("depth limiting", () => {
	test("extractNestedCommands with maxDepth 0 returns empty (bail)", () => {
		const tokens: ParseEntry[] = ["bash", "-c", "rm -rf /"];
		const result = extractNestedCommands(tokens, 10);
		expect(result).toEqual([]);
	});

	test("extractNestedCommands within depth limit works normally", () => {
		const tokens: ParseEntry[] = ["bash", "-c", "rm -rf /"];
		const result = extractNestedCommands(tokens, 5);
		expect(result).toEqual([
			{ command: "rm -rf /", source: "shell-wrapper" },
		]);
	});
});

describe("exports", () => {
	test("SHELL_WRAPPERS is a Set with expected entries", () => {
		expect(SHELL_WRAPPERS).toBeInstanceOf(Set);
		expect(SHELL_WRAPPERS.has("bash")).toBe(true);
		expect(SHELL_WRAPPERS.has("sh")).toBe(true);
		expect(SHELL_WRAPPERS.has("zsh")).toBe(true);
		expect(SHELL_WRAPPERS.has("dash")).toBe(true);
		expect(SHELL_WRAPPERS.has("/bin/bash")).toBe(true);
		expect(SHELL_WRAPPERS.has("/bin/sh")).toBe(true);
	});

	test("INTERPRETERS has expected entries", () => {
		expect(INTERPRETERS).toHaveProperty("python");
		expect(INTERPRETERS).toHaveProperty("python3");
		expect(INTERPRETERS).toHaveProperty("node");
		expect(INTERPRETERS).toHaveProperty("ruby");
		expect(INTERPRETERS).toHaveProperty("perl");
		expect(INTERPRETERS.node).toContain("-e");
		expect(INTERPRETERS.node).toContain("--eval");
	});
});
