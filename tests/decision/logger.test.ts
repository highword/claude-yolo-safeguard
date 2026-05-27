import { describe, expect, test, beforeEach } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync, statSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeAuditLog } from "../../src/decision/logger";
import type { Decision } from "../../src/types/decision";
import type { LoggingConfig } from "../../src/types/config";
import type { RuleMatch, Rule } from "../../src/types/rule";
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

let tempDir: string;

beforeEach(() => {
	tempDir = mkdtempSync(join(tmpdir(), "audit-test-"));
});

describe("writeAuditLog", () => {
	test("block action writes detailed JSONL record", () => {
		const logPath = join(tempDir, "audit.jsonl");
		const config: LoggingConfig = { enabled: true, path: logPath, maxSizeMb: 10 };
		const decision: Decision = {
			action: "block",
			severity: "CRITICAL",
			matchedRules: [mockMatch("shell.rm-recursive-root", "rm -rf /", "CRITICAL")],
			message: "Blocked: rm -rf /",
			suggestion: "Use safer alternative",
			timestamp: "2024-01-15T10:30:00.000Z",
		};
		writeAuditLog(decision, config, { command: "rm -rf /", cwd: "/home/user" });
		const content = readFileSync(logPath, "utf-8").trim();
		const record = JSON.parse(content);
		expect(record.timestamp).toBe("2024-01-15T10:30:00.000Z");
		expect(record.action).toBe("block");
		expect(record.severity).toBe("CRITICAL");
		expect(record.command).toBe("rm -rf /");
		expect(record.rules).toHaveLength(1);
		expect(record.rules[0].id).toBe("shell.rm-recursive-root");
		expect(record.suggestion).toBe("Use safer alternative");
	});

	test("warn action writes detailed JSONL record", () => {
		const logPath = join(tempDir, "audit.jsonl");
		const config: LoggingConfig = { enabled: true, path: logPath, maxSizeMb: 10 };
		const decision: Decision = {
			action: "warn",
			severity: "MEDIUM",
			matchedRules: [mockMatch("shell.chmod-777", "chmod 777", "MEDIUM")],
			message: "Warning: chmod 777",
			suggestion: "Use safer alternative",
			timestamp: "2024-01-15T10:30:00.000Z",
		};
		writeAuditLog(decision, config, { command: "chmod 777 file" });
		const content = readFileSync(logPath, "utf-8").trim();
		const record = JSON.parse(content);
		expect(record.action).toBe("warn");
		expect(record.severity).toBe("MEDIUM");
		expect(record.rules).toHaveLength(1);
	});

	test("off action with empty matchedRules writes minimal record", () => {
		const logPath = join(tempDir, "audit.jsonl");
		const config: LoggingConfig = { enabled: true, path: logPath, maxSizeMb: 10 };
		const decision: Decision = {
			action: "off",
			matchedRules: [],
			timestamp: "2024-01-15T10:30:00.000Z",
		};
		writeAuditLog(decision, config, { command: "ls -la" });
		const content = readFileSync(logPath, "utf-8").trim();
		const record = JSON.parse(content);
		expect(record.timestamp).toBe("2024-01-15T10:30:00.000Z");
		expect(record.action).toBe("off");
		expect(record.command).toBe("ls -la");
		expect(record.severity).toBeUndefined();
		expect(record.rules).toBeUndefined();
	});

	test("log action writes minimal record", () => {
		const logPath = join(tempDir, "audit.jsonl");
		const config: LoggingConfig = { enabled: true, path: logPath, maxSizeMb: 10 };
		const decision: Decision = {
			action: "log",
			severity: "LOW",
			matchedRules: [mockMatch("shell.rm-file", "rm file.tmp", "LOW")],
			timestamp: "2024-01-15T10:30:00.000Z",
		};
		writeAuditLog(decision, config, { command: "rm file.tmp" });
		const content = readFileSync(logPath, "utf-8").trim();
		const record = JSON.parse(content);
		expect(record.action).toBe("log");
		expect(record.command).toBe("rm file.tmp");
		expect(record.rules).toBeUndefined();
	});

	test("each call appends exactly one line ending with newline", () => {
		const logPath = join(tempDir, "audit.jsonl");
		const config: LoggingConfig = { enabled: true, path: logPath, maxSizeMb: 10 };
		const decision: Decision = {
			action: "off",
			matchedRules: [],
			timestamp: "2024-01-15T10:30:00.000Z",
		};
		writeAuditLog(decision, config, { command: "echo hi" });
		writeAuditLog(decision, config, { command: "echo bye" });
		const content = readFileSync(logPath, "utf-8");
		const lines = content.split("\n").filter((l) => l.length > 0);
		expect(lines).toHaveLength(2);
		expect(content.endsWith("\n")).toBe(true);
	});

	test("JSONL record is valid JSON", () => {
		const logPath = join(tempDir, "audit.jsonl");
		const config: LoggingConfig = { enabled: true, path: logPath, maxSizeMb: 10 };
		const decision: Decision = {
			action: "block",
			severity: "HIGH",
			matchedRules: [mockMatch("shell.test", "cmd", "HIGH")],
			message: "Blocked",
			timestamp: "2024-01-15T10:30:00.000Z",
		};
		writeAuditLog(decision, config, { command: "cmd" });
		const content = readFileSync(logPath, "utf-8").trim();
		expect(() => JSON.parse(content)).not.toThrow();
	});

	test("logging.enabled=false does NOT write anything", () => {
		const logPath = join(tempDir, "audit.jsonl");
		const config: LoggingConfig = { enabled: false, path: logPath, maxSizeMb: 10 };
		const decision: Decision = {
			action: "block",
			severity: "HIGH",
			matchedRules: [mockMatch("shell.test", "cmd", "HIGH")],
			message: "Blocked",
			timestamp: "2024-01-15T10:30:00.000Z",
		};
		writeAuditLog(decision, config, { command: "cmd" });
		expect(existsSync(logPath)).toBe(false);
	});

	test("log rotation — renames to .1 when file exceeds maxSizeMb", () => {
		const logPath = join(tempDir, "audit.jsonl");
		const config: LoggingConfig = { enabled: true, path: logPath, maxSizeMb: 0.0001 };
		// Write enough data to exceed threshold (~100 bytes)
		writeFileSync(logPath, "x".repeat(200));
		const decision: Decision = {
			action: "off",
			matchedRules: [],
			timestamp: "2024-01-15T10:30:00.000Z",
		};
		writeAuditLog(decision, config, { command: "test" });
		expect(existsSync(logPath + ".1")).toBe(true);
		// New file should have just the latest record
		const content = readFileSync(logPath, "utf-8").trim();
		const record = JSON.parse(content);
		expect(record.command).toBe("test");
	});

	test("handles missing directory (creates it)", () => {
		const logPath = join(tempDir, "nested", "deep", "audit.jsonl");
		const config: LoggingConfig = { enabled: true, path: logPath, maxSizeMb: 10 };
		const decision: Decision = {
			action: "off",
			matchedRules: [],
			timestamp: "2024-01-15T10:30:00.000Z",
		};
		writeAuditLog(decision, config, { command: "test" });
		expect(existsSync(logPath)).toBe(true);
	});

	test("fails silently on permission error (does not throw)", () => {
		// Use an invalid path that will fail
		const logPath = join("\0invalid", "audit.jsonl");
		const config: LoggingConfig = { enabled: true, path: logPath, maxSizeMb: 10 };
		const decision: Decision = {
			action: "off",
			matchedRules: [],
			timestamp: "2024-01-15T10:30:00.000Z",
		};
		expect(() => writeAuditLog(decision, config, { command: "test" })).not.toThrow();
	});

	test("path with ~ is expanded to homedir", () => {
		const config: LoggingConfig = {
			enabled: true,
			path: "~/.config/yolo-safeguard/test-audit.jsonl",
			maxSizeMb: 10,
		};
		const decision: Decision = {
			action: "off",
			matchedRules: [],
			timestamp: "2024-01-15T10:30:00.000Z",
		};
		writeAuditLog(decision, config, { command: "test" });
		const homedir = require("node:os").homedir();
		const expectedPath = join(homedir, ".config", "yolo-safeguard", "test-audit.jsonl");
		expect(existsSync(expectedPath)).toBe(true);
		// Cleanup
		rmSync(expectedPath, { force: true });
	});

	test("detailed record includes sessionId field when provided", () => {
		const logPath = join(tempDir, "audit.jsonl");
		const config: LoggingConfig = { enabled: true, path: logPath, maxSizeMb: 10 };
		const decision: Decision = {
			action: "block",
			severity: "HIGH",
			matchedRules: [mockMatch("shell.test", "cmd", "HIGH")],
			message: "Blocked",
			timestamp: "2024-01-15T10:30:00.000Z",
		};
		writeAuditLog(decision, config, { command: "cmd", sessionId: "session-123" });
		const content = readFileSync(logPath, "utf-8").trim();
		const record = JSON.parse(content);
		expect(record.sessionId).toBe("session-123");
	});
});
