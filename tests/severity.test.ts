import { describe, expect, test } from "bun:test";
import { DEFAULT_SEVERITY_ACTIONS } from "../src/types/severity";

describe("DEFAULT_SEVERITY_ACTIONS", () => {
	test("CRITICAL maps to block", () => {
		expect(DEFAULT_SEVERITY_ACTIONS.CRITICAL).toBe("block");
	});

	test("HIGH maps to block", () => {
		expect(DEFAULT_SEVERITY_ACTIONS.HIGH).toBe("block");
	});

	test("MEDIUM maps to warn", () => {
		expect(DEFAULT_SEVERITY_ACTIONS.MEDIUM).toBe("warn");
	});

	test("LOW maps to log", () => {
		expect(DEFAULT_SEVERITY_ACTIONS.LOW).toBe("log");
	});

	test("INFO maps to off", () => {
		expect(DEFAULT_SEVERITY_ACTIONS.INFO).toBe("off");
	});
});
