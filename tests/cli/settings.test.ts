import { describe, expect, test, beforeEach } from "bun:test";
import {
	mkdtempSync,
	readFileSync,
	writeFileSync,
	existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	getSettingsPath,
	buildHookCommand,
	registerHook,
} from "../../src/cli/settings";

let tempDir: string;

beforeEach(() => {
	tempDir = mkdtempSync(join(tmpdir(), "settings-test-"));
});

describe("getSettingsPath", () => {
	test("returns ~/.claude/settings.json by default", () => {
		// Clear env override
		const prev = process.env.CLAUDE_CONFIG_DIR;
		delete process.env.CLAUDE_CONFIG_DIR;
		try {
			const result = getSettingsPath();
			const homedir = require("node:os").homedir();
			expect(result).toBe(join(homedir, ".claude", "settings.json"));
		} finally {
			if (prev !== undefined) process.env.CLAUDE_CONFIG_DIR = prev;
		}
	});

	test("respects CLAUDE_CONFIG_DIR env override", () => {
		const prev = process.env.CLAUDE_CONFIG_DIR;
		process.env.CLAUDE_CONFIG_DIR = "/custom/config/dir";
		try {
			const result = getSettingsPath();
			expect(result).toBe(join("/custom/config/dir", "settings.json"));
		} finally {
			if (prev !== undefined) {
				process.env.CLAUDE_CONFIG_DIR = prev;
			} else {
				delete process.env.CLAUDE_CONFIG_DIR;
			}
		}
	});
});

describe("buildHookCommand", () => {
	test("on Windows uses forward slashes and quotes both paths", () => {
		// We test the output format directly
		const hookPath = "C:\\Users\\user\\.claude\\hooks\\yolo-safeguard\\hook.cjs";
		const result = buildHookCommand(hookPath, "win32", "C:\\Program Files\\nodejs\\node.exe");
		expect(result).toContain("C:/Program Files/nodejs/node.exe");
		expect(result).toContain("C:/Users/user/.claude/hooks/yolo-safeguard/hook.cjs");
		// Both paths should be quoted
		expect(result.startsWith('"')).toBe(true);
		expect(result).toMatch(/^"[^"]+"\s+"[^"]+"$/);
	});

	test("on Unix uses unquoted node <path> format", () => {
		const hookPath = "/home/user/.claude/hooks/yolo-safeguard/hook.cjs";
		const result = buildHookCommand(hookPath, "linux", "/usr/bin/node");
		expect(result).toBe("node /home/user/.claude/hooks/yolo-safeguard/hook.cjs");
	});

	test("on macOS uses unquoted node <path> format", () => {
		const hookPath = "/Users/user/.claude/hooks/yolo-safeguard/hook.cjs";
		const result = buildHookCommand(hookPath, "darwin", "/usr/local/bin/node");
		expect(result).toBe("node /Users/user/.claude/hooks/yolo-safeguard/hook.cjs");
	});
});

describe("registerHook", () => {
	test("with empty settings.json creates hooks.PreToolUse array with single entry", () => {
		const settingsPath = join(tempDir, "settings.json");
		writeFileSync(settingsPath, "{}");

		registerHook(settingsPath, "node /path/to/hook.cjs");

		const content = readFileSync(settingsPath, "utf-8");
		const settings = JSON.parse(content);
		expect(settings.hooks).toBeDefined();
		expect(settings.hooks.PreToolUse).toHaveLength(1);
		expect(settings.hooks.PreToolUse[0].matcher).toBe("Bash");
		expect(settings.hooks.PreToolUse[0].hooks[0].type).toBe("command");
		expect(settings.hooks.PreToolUse[0].hooks[0].command).toBe("node /path/to/hook.cjs");
		expect(settings.hooks.PreToolUse[0].hooks[0].timeout).toBe(5);
	});

	test("with existing hooks.PreToolUse preserves other entries and appends ours", () => {
		const settingsPath = join(tempDir, "settings.json");
		const existing = {
			hooks: {
				PreToolUse: [
					{
						matcher: "Bash",
						hooks: [{ type: "command", command: "node /other/hook.js", timeout: 10 }],
					},
				],
			},
		};
		writeFileSync(settingsPath, JSON.stringify(existing, null, 2));

		registerHook(settingsPath, "node /path/to/yolo-safeguard/hook.cjs");

		const content = readFileSync(settingsPath, "utf-8");
		const settings = JSON.parse(content);
		expect(settings.hooks.PreToolUse).toHaveLength(2);
		// Original entry preserved
		expect(settings.hooks.PreToolUse[0].hooks[0].command).toBe("node /other/hook.js");
		// Our entry appended
		expect(settings.hooks.PreToolUse[1].hooks[0].command).toBe("node /path/to/yolo-safeguard/hook.cjs");
	});

	test("called twice does not create duplicate (updates in-place)", () => {
		const settingsPath = join(tempDir, "settings.json");
		writeFileSync(settingsPath, "{}");

		registerHook(settingsPath, "node /old/yolo-safeguard/hook.cjs");
		registerHook(settingsPath, "node /new/yolo-safeguard/hook.cjs");

		const content = readFileSync(settingsPath, "utf-8");
		const settings = JSON.parse(content);
		expect(settings.hooks.PreToolUse).toHaveLength(1);
		expect(settings.hooks.PreToolUse[0].hooks[0].command).toBe("node /new/yolo-safeguard/hook.cjs");
	});

	test("with missing settings.json creates the file from scratch", () => {
		const settingsPath = join(tempDir, "nonexistent", "settings.json");

		registerHook(settingsPath, "node /path/to/yolo-safeguard/hook.cjs");

		expect(existsSync(settingsPath)).toBe(true);
		const content = readFileSync(settingsPath, "utf-8");
		const settings = JSON.parse(content);
		expect(settings.hooks.PreToolUse).toHaveLength(1);
	});

	test("with non-JSON content in settings.json creates fresh structure", () => {
		const settingsPath = join(tempDir, "settings.json");
		writeFileSync(settingsPath, "this is not json {{{}}}");

		registerHook(settingsPath, "node /path/to/yolo-safeguard/hook.cjs");

		const content = readFileSync(settingsPath, "utf-8");
		const settings = JSON.parse(content);
		expect(settings.hooks.PreToolUse).toHaveLength(1);
		expect(settings.hooks.PreToolUse[0].hooks[0].command).toBe("node /path/to/yolo-safeguard/hook.cjs");
	});

	test("settings.json is written with 2-space indentation and trailing newline", () => {
		const settingsPath = join(tempDir, "settings.json");
		writeFileSync(settingsPath, "{}");

		registerHook(settingsPath, "node /path/to/yolo-safeguard/hook.cjs");

		const content = readFileSync(settingsPath, "utf-8");
		// 2-space indent check
		expect(content).toContain("  ");
		expect(content).not.toContain("\t");
		// Trailing newline
		expect(content.endsWith("\n")).toBe(true);
		// Valid JSON
		expect(() => JSON.parse(content)).not.toThrow();
	});

	test("backup file (.bak) is created before modification", () => {
		const settingsPath = join(tempDir, "settings.json");
		const originalContent = JSON.stringify({ existing: true }, null, 2);
		writeFileSync(settingsPath, originalContent);

		registerHook(settingsPath, "node /path/to/yolo-safeguard/hook.cjs");

		const bakPath = settingsPath + ".bak";
		expect(existsSync(bakPath)).toBe(true);
		const bakContent = readFileSync(bakPath, "utf-8");
		expect(bakContent).toBe(originalContent);
	});

	test("backup is skipped if original file does not exist", () => {
		const settingsPath = join(tempDir, "nonexistent2", "settings.json");

		registerHook(settingsPath, "node /path/to/yolo-safeguard/hook.cjs");

		const bakPath = settingsPath + ".bak";
		expect(existsSync(bakPath)).toBe(false);
	});

	test("preserves other top-level fields in settings.json", () => {
		const settingsPath = join(tempDir, "settings.json");
		const existing = {
			theme: "dark",
			fontSize: 14,
			hooks: {},
		};
		writeFileSync(settingsPath, JSON.stringify(existing, null, 2));

		registerHook(settingsPath, "node /path/to/yolo-safeguard/hook.cjs");

		const content = readFileSync(settingsPath, "utf-8");
		const settings = JSON.parse(content);
		expect(settings.theme).toBe("dark");
		expect(settings.fontSize).toBe(14);
		expect(settings.hooks.PreToolUse).toHaveLength(1);
	});
});
