import { describe, expect, test } from "bun:test";
import { processHookEvent } from "../../src/hook/process";

describe("hook performance", () => {
	test("safe command (ls -la) processes in <50ms", () => {
		const input = JSON.stringify({
			hook_type: "PreToolUse",
			tool_name: "Bash",
			tool_input: { command: "ls -la" },
			cwd: process.cwd(),
		});

		const start = performance.now();
		const result = processHookEvent(input);
		const elapsed = performance.now() - start;

		expect(result.exitCode).toBe(0);
		expect(elapsed).toBeLessThan(50);
	});

	test("dangerous command (rm -rf /) processes in <50ms", () => {
		const input = JSON.stringify({
			hook_type: "PreToolUse",
			tool_name: "Bash",
			tool_input: { command: "rm -rf /" },
			cwd: process.cwd(),
		});

		const start = performance.now();
		const result = processHookEvent(input);
		const elapsed = performance.now() - start;

		expect(result.exitCode).toBe(2);
		expect(elapsed).toBeLessThan(50);
	});

	test("complex compound command processes in <50ms", () => {
		const input = JSON.stringify({
			hook_type: "PreToolUse",
			tool_name: "Bash",
			tool_input: {
				command:
					"git add . && git commit -m 'test' && git push --force origin main",
			},
			cwd: process.cwd(),
		});

		const start = performance.now();
		const result = processHookEvent(input);
		const elapsed = performance.now() - start;

		expect(elapsed).toBeLessThan(50);
	});

	test("Write tool early-exit processes in <5ms", () => {
		const input = JSON.stringify({
			hook_type: "PreToolUse",
			tool_name: "Write",
			tool_input: { file_path: "/tmp/test.txt", content: "hello" },
			cwd: process.cwd(),
		});

		const start = performance.now();
		const result = processHookEvent(input);
		const elapsed = performance.now() - start;

		expect(result.exitCode).toBe(0);
		expect(elapsed).toBeLessThan(5);
	});

	test("Edit tool early-exit processes in <5ms", () => {
		const input = JSON.stringify({
			hook_type: "PreToolUse",
			tool_name: "Edit",
			tool_input: {
				file_path: "/tmp/test.txt",
				old_string: "hello",
				new_string: "world",
			},
			cwd: process.cwd(),
		});

		const start = performance.now();
		const result = processHookEvent(input);
		const elapsed = performance.now() - start;

		expect(result.exitCode).toBe(0);
		expect(elapsed).toBeLessThan(5);
	});

	test("average of 100 safe commands processes in <50ms", () => {
		const input = JSON.stringify({
			hook_type: "PreToolUse",
			tool_name: "Bash",
			tool_input: { command: "npm install express" },
			cwd: process.cwd(),
		});

		// Warm up
		processHookEvent(input);

		const start = performance.now();
		for (let i = 0; i < 100; i++) {
			processHookEvent(input);
		}
		const elapsed = (performance.now() - start) / 100;

		expect(elapsed).toBeLessThan(50);
	});

	test("nested command (bash -c 'rm -rf /') processes in <50ms", () => {
		const input = JSON.stringify({
			hook_type: "PreToolUse",
			tool_name: "Bash",
			tool_input: { command: "bash -c 'rm -rf /'" },
			cwd: process.cwd(),
		});

		const start = performance.now();
		const result = processHookEvent(input);
		const elapsed = performance.now() - start;

		expect(result.exitCode).toBe(2);
		expect(elapsed).toBeLessThan(50);
	});

	test("malformed JSON fails open in <5ms", () => {
		const start = performance.now();
		const result = processHookEvent("not valid json at all");
		const elapsed = performance.now() - start;

		expect(result.exitCode).toBe(0);
		expect(result.output).toBe("");
		expect(elapsed).toBeLessThan(5);
	});
});
