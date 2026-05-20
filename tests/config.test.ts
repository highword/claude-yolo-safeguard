import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { getDefaults } from "../src/config/defaults";
import { loadConfig, mergeConfigs } from "../src/config/loader";
import type { Config } from "../src/types/config";
import type { Action } from "../src/types/severity";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("getDefaults", () => {
	it("returns CRITICAL=block, HIGH=block, MEDIUM=warn, LOW=log, INFO=off", () => {
		const config = getDefaults();
		expect(config.severityActions.CRITICAL).toBe("block");
		expect(config.severityActions.HIGH).toBe("block");
		expect(config.severityActions.MEDIUM).toBe("warn");
		expect(config.severityActions.LOW).toBe("log");
		expect(config.severityActions.INFO).toBe("off");
	});

	it("returns empty customRules array", () => {
		const config = getDefaults();
		expect(config.customRules).toEqual([]);
	});

	it("returns empty allowList array", () => {
		const config = getDefaults();
		expect(config.allowList).toEqual([]);
	});

	it("returns logging.enabled=true", () => {
		const config = getDefaults();
		expect(config.logging.enabled).toBe(true);
	});

	it("returns logging with path and maxSizeMb", () => {
		const config = getDefaults();
		expect(config.logging.path).toContain("yolo-safeguard");
		expect(config.logging.maxSizeMb).toBe(10);
	});
});

describe("mergeConfigs", () => {
	it("with empty user and project returns defaults unchanged", () => {
		const defaults = getDefaults();
		const result = mergeConfigs(defaults, null, null);
		expect(result.severityActions).toEqual(defaults.severityActions);
		expect(result.customRules).toEqual([]);
		expect(result.allowList).toEqual([]);
	});

	it("user-level can override any severity action", () => {
		const defaults = getDefaults();
		const userConfig = {
			severityActions: {
				CRITICAL: "block" as Action,
				HIGH: "warn" as Action,
				MEDIUM: "log" as Action,
				LOW: "off" as Action,
				INFO: "off" as Action,
			},
		};
		const result = mergeConfigs(defaults, userConfig, null);
		expect(result.severityActions.HIGH).toBe("warn");
		expect(result.severityActions.MEDIUM).toBe("log");
		expect(result.severityActions.LOW).toBe("off");
	});

	it("project-level CAN escalate (MEDIUM -> block)", () => {
		const defaults = getDefaults();
		const projectConfig = {
			severityActions: {
				CRITICAL: "block" as Action,
				HIGH: "block" as Action,
				MEDIUM: "block" as Action,
				LOW: "log" as Action,
				INFO: "off" as Action,
			},
		};
		const result = mergeConfigs(defaults, null, projectConfig);
		expect(result.severityActions.MEDIUM).toBe("block");
	});

	it("project-level CANNOT de-escalate (HIGH -> warn is ignored)", () => {
		const defaults = getDefaults();
		const projectConfig = {
			severityActions: {
				CRITICAL: "block" as Action,
				HIGH: "warn" as Action,
				MEDIUM: "warn" as Action,
				LOW: "log" as Action,
				INFO: "off" as Action,
			},
		};
		const result = mergeConfigs(defaults, null, projectConfig);
		expect(result.severityActions.HIGH).toBe("block");
	});

	it("project-level CANNOT change CRITICAL from block", () => {
		const defaults = getDefaults();
		const projectConfig = {
			severityActions: {
				CRITICAL: "warn" as Action,
				HIGH: "block" as Action,
				MEDIUM: "warn" as Action,
				LOW: "log" as Action,
				INFO: "off" as Action,
			},
		};
		const result = mergeConfigs(defaults, null, projectConfig);
		expect(result.severityActions.CRITICAL).toBe("block");
	});

	it("project-level customRules are appended to merged.customRules", () => {
		const defaults = getDefaults();
		const projectConfig = {
			customRules: [
				{
					id: "custom.test-rule",
					category: "shell" as const,
					severity: "HIGH" as const,
					pattern: "test-pattern",
					keywords: ["test"],
					description: "A test rule",
					builtin: false,
				},
			],
		};
		const result = mergeConfigs(defaults, null, projectConfig);
		expect(result.customRules).toHaveLength(1);
		expect(result.customRules[0].id).toBe("custom.test-rule");
	});

	it("project-level allowList entries are appended (additive merge)", () => {
		const defaults = getDefaults();
		const userConfig = {
			allowList: [
				{
					id: "user-allow-1",
					match: { command: "rm -rf node_modules" },
					reason: "Safe cleanup",
				},
			],
		};
		const projectConfig = {
			allowList: [
				{
					id: "project-allow-1",
					match: { ruleId: "shell.rm-recursive-force" },
					reason: "Build script needs this",
				},
			],
		};
		const result = mergeConfigs(defaults, userConfig, projectConfig);
		expect(result.allowList).toHaveLength(2);
		expect(result.allowList[0].id).toBe("user-allow-1");
		expect(result.allowList[1].id).toBe("project-allow-1");
	});

	it("user-level customRules are applied before project-level", () => {
		const defaults = getDefaults();
		const userConfig = {
			customRules: [
				{
					id: "user.rule",
					category: "content" as const,
					severity: "MEDIUM" as const,
					pattern: "user-pattern",
					keywords: ["user"],
					description: "User rule",
					builtin: false,
				},
			],
		};
		const projectConfig = {
			customRules: [
				{
					id: "project.rule",
					category: "shell" as const,
					severity: "HIGH" as const,
					pattern: "project-pattern",
					keywords: ["project"],
					description: "Project rule",
					builtin: false,
				},
			],
		};
		const result = mergeConfigs(defaults, userConfig, projectConfig);
		expect(result.customRules).toHaveLength(2);
		expect(result.customRules[0].id).toBe("user.rule");
		expect(result.customRules[1].id).toBe("project.rule");
	});
});

describe("loadConfig", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "yolo-safeguard-test-"));
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it("with no files on disk returns defaults", () => {
		const config = loadConfig(tmpDir);
		expect(config.severityActions.CRITICAL).toBe("block");
		expect(config.severityActions.HIGH).toBe("block");
		expect(config.severityActions.MEDIUM).toBe("warn");
		expect(config.severityActions.LOW).toBe("log");
		expect(config.severityActions.INFO).toBe("off");
		expect(config.customRules).toEqual([]);
		expect(config.allowList).toEqual([]);
	});

	it("reads project config from .safeguard.json in cwd", () => {
		const projectConfig = {
			severityActions: {
				CRITICAL: "block",
				HIGH: "block",
				MEDIUM: "block",
				LOW: "log",
				INFO: "off",
			},
		};
		fs.writeFileSync(
			path.join(tmpDir, ".safeguard.json"),
			JSON.stringify(projectConfig),
		);
		const config = loadConfig(tmpDir);
		expect(config.severityActions.MEDIUM).toBe("block");
	});

	it("handles malformed JSON gracefully (falls back to defaults)", () => {
		fs.writeFileSync(path.join(tmpDir, ".safeguard.json"), "not valid json {{{");
		const config = loadConfig(tmpDir);
		expect(config.severityActions.CRITICAL).toBe("block");
		expect(config.customRules).toEqual([]);
	});
});
