import { describe, expect, test, beforeAll } from "bun:test";
import { existsSync, statSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const ROOT_DIR = join(import.meta.dir, "..");
const DIST_DIR = join(ROOT_DIR, "dist");
const HOOK_PATH = join(DIST_DIR, "hook.cjs");
const CLI_PATH = join(DIST_DIR, "cli.cjs");

beforeAll(() => {
	// Build before running tests
	execSync("npx bun run build.ts", { cwd: ROOT_DIR, stdio: "pipe" });
});

describe("build output", () => {
	test("dist/hook.cjs exists", () => {
		expect(existsSync(HOOK_PATH)).toBe(true);
	});

	test("dist/cli.cjs exists", () => {
		expect(existsSync(CLI_PATH)).toBe(true);
	});

	test("hook.cjs is under 100KB", () => {
		const stats = statSync(HOOK_PATH);
		const sizeKB = stats.size / 1024;
		expect(sizeKB).toBeLessThan(100);
	});

	test("cli.cjs is under 50KB", () => {
		const stats = statSync(CLI_PATH);
		const sizeKB = stats.size / 1024;
		expect(sizeKB).toBeLessThan(50);
	});

	test("hook.cjs is valid JavaScript content", () => {
		const content = readFileSync(HOOK_PATH, "utf-8");
		expect(content.length).toBeGreaterThan(0);
		// Verify it contains key identifiers from our hook code
		expect(content).toContain("readFileSync");
	});

	test("cli.cjs is valid JavaScript content", () => {
		const content = readFileSync(CLI_PATH, "utf-8");
		expect(content.length).toBeGreaterThan(0);
		// Should contain installer-related strings
		expect(content).toContain("yolo-safeguard");
	});

	test("hook.cjs source map exists", () => {
		expect(existsSync(join(DIST_DIR, "hook.cjs.map"))).toBe(true);
	});

	test("cli.cjs source map exists", () => {
		expect(existsSync(join(DIST_DIR, "cli.cjs.map"))).toBe(true);
	});

	test("hook.cjs contains hookSpecificOutput format", () => {
		const content = readFileSync(HOOK_PATH, "utf-8");
		// After minification the string literals should still be present
		expect(content).toContain("hookSpecificOutput");
		expect(content).toContain("PreToolUse");
	});

	test("hook.cjs contains permissionDecision protocol strings", () => {
		const content = readFileSync(HOOK_PATH, "utf-8");
		expect(content).toContain("permissionDecision");
		expect(content).toContain("deny");
	});

	test("hook.cjs bundle size is reasonable (>5KB, <100KB)", () => {
		const stats = statSync(HOOK_PATH);
		const sizeKB = stats.size / 1024;
		// Should be meaningful code (>5KB) but under budget (<100KB)
		expect(sizeKB).toBeGreaterThan(5);
		expect(sizeKB).toBeLessThan(100);
	});
});
