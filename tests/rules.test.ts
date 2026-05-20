import { describe, expect, test } from "bun:test";
import {
	ALL_RULES,
	QUICK_REJECT_SET,
	quickReject,
} from "../src/rules/index";

describe("ALL_RULES registry", () => {
	test("contains at least 15 rules", () => {
		expect(ALL_RULES.length).toBeGreaterThanOrEqual(15);
	});

	test("every rule has non-empty id", () => {
		for (const rule of ALL_RULES) {
			expect(rule.id).toBeTruthy();
			expect(rule.id.length).toBeGreaterThan(0);
		}
	});

	test("every rule has non-empty category", () => {
		for (const rule of ALL_RULES) {
			expect(rule.category).toBeTruthy();
		}
	});

	test("every rule has non-empty severity", () => {
		for (const rule of ALL_RULES) {
			expect(rule.severity).toBeTruthy();
		}
	});

	test("every rule has non-empty pattern", () => {
		for (const rule of ALL_RULES) {
			expect(rule.pattern).toBeTruthy();
			expect(rule.pattern.length).toBeGreaterThan(0);
		}
	});

	test("every rule has non-empty keywords array", () => {
		for (const rule of ALL_RULES) {
			expect(rule.keywords).toBeInstanceOf(Array);
			expect(rule.keywords.length).toBeGreaterThan(0);
		}
	});

	test("every rule.id is unique (no duplicates)", () => {
		const ids = ALL_RULES.map((r) => r.id);
		const uniqueIds = new Set(ids);
		expect(uniqueIds.size).toBe(ids.length);
	});

	test("every rule.builtin === true", () => {
		for (const rule of ALL_RULES) {
			expect(rule.builtin).toBe(true);
		}
	});
});

describe("QUICK_REJECT_SET", () => {
	test("contains expected keywords", () => {
		expect(QUICK_REJECT_SET.has("rm")).toBe(true);
		expect(QUICK_REJECT_SET.has("git")).toBe(true);
		expect(QUICK_REJECT_SET.has("DROP")).toBe(true);
		expect(QUICK_REJECT_SET.has("curl")).toBe(true);
		expect(QUICK_REJECT_SET.has("eval")).toBe(true);
		expect(QUICK_REJECT_SET.has("innerHTML")).toBe(true);
	});
});

describe("quickReject", () => {
	test("returns true for safe commands (no keywords match — skip analysis)", () => {
		expect(quickReject("ls -la")).toBe(true);
	});

	test("returns false for rm -rf / (keyword 'rm' found — proceed)", () => {
		expect(quickReject("rm -rf /")).toBe(false);
	});

	test("returns false for git push --force main (keywords found)", () => {
		expect(quickReject("git push --force main")).toBe(false);
	});

	test("returns true for echo hello world (no keywords match)", () => {
		expect(quickReject("echo hello world")).toBe(true);
	});

	test("returns false for SELECT * FROM users (keyword found)", () => {
		expect(quickReject("SELECT * FROM users")).toBe(false);
	});
});
