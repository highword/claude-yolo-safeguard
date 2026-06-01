import { describe, expect, test, beforeEach } from "bun:test";
import {
	mkdtempSync,
	readFileSync,
	writeFileSync,
	existsSync,
	mkdirSync,
} from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";
import {
	getHookTargetPath,
	resolveHookSource,
	deployHook,
} from "../../src/cli/deploy";

let tempDir: string;

beforeEach(() => {
	tempDir = mkdtempSync(join(tmpdir(), "deploy-test-"));
});

describe("getHookTargetPath", () => {
	test("global mode returns ~/.claude/hooks/yolo-safeguard/hook.cjs", () => {
		const result = getHookTargetPath("global");
		const expected = join(
			homedir(),
			".claude",
			"hooks",
			"yolo-safeguard",
			"hook.cjs",
		);
		expect(result).toBe(expected);
	});

	test("project mode returns .claude/hooks/yolo-safeguard/hook.cjs relative to cwd", () => {
		const result = getHookTargetPath("project", tempDir);
		const expected = join(
			tempDir,
			".claude",
			"hooks",
			"yolo-safeguard",
			"hook.cjs",
		);
		expect(result).toBe(expected);
	});
});

describe("resolveHookSource", () => {
	test("finds hook.cjs relative to provided base directory", () => {
		// Create a fake hook.cjs in temp dir
		const distDir = join(tempDir, "dist");
		mkdirSync(distDir, { recursive: true });
		writeFileSync(join(distDir, "hook.cjs"), "// hook content");

		const result = resolveHookSource(distDir);
		expect(result).toBe(join(distDir, "hook.cjs"));
	});

	test("returns fallback path when hook.cjs not found at primary location", () => {
		// Empty dir — hook.cjs does not exist
		const result = resolveHookSource(tempDir);
		// Should try fallback: ../dist/hook.cjs
		const expected = join(tempDir, "..", "dist", "hook.cjs");
		expect(result).toBe(expected);
	});
});

describe("deployHook", () => {
	test("creates target directory if it doesn't exist", () => {
		const sourcePath = join(tempDir, "source-hook.cjs");
		writeFileSync(sourcePath, "// hook source content");

		const targetPath = join(tempDir, ".claude", "hooks", "yolo-safeguard", "hook.cjs");
		deployHook(sourcePath, targetPath);

		expect(existsSync(targetPath)).toBe(true);
	});

	test("copies hook.cjs to the target path", () => {
		const sourcePath = join(tempDir, "source-hook.cjs");
		const content = "// hook source content v1";
		writeFileSync(sourcePath, content);

		const targetPath = join(tempDir, ".claude", "hooks", "hook.cjs");
		deployHook(sourcePath, targetPath);

		const targetContent = readFileSync(targetPath, "utf-8");
		expect(targetContent).toBe(content);
	});

	test("overwrites existing hook.cjs (upgrade scenario)", () => {
		const sourcePath = join(tempDir, "source-hook.cjs");
		const targetPath = join(tempDir, ".claude", "hooks", "hook.cjs");

		// Write old version
		mkdirSync(join(tempDir, ".claude", "hooks"), { recursive: true });
		writeFileSync(targetPath, "// old version");

		// Deploy new version
		writeFileSync(sourcePath, "// new version v2");
		deployHook(sourcePath, targetPath);

		const targetContent = readFileSync(targetPath, "utf-8");
		expect(targetContent).toBe("// new version v2");
	});

	test("validates target path must contain .claude directory", () => {
		const sourcePath = join(tempDir, "source-hook.cjs");
		writeFileSync(sourcePath, "// content");

		// Try to deploy to a path that doesn't contain .claude/ (should throw)
		const badPath = join(tempDir, "evil", "hook.cjs");
		expect(() => deployHook(sourcePath, badPath)).toThrow(
			/must be within a .claude directory/,
		);
	});
});

describe("init integration", () => {
	test("full init flow deploys hook and registers in settings", () => {
		// Setup: create a fake source hook.cjs
		const fakeDistDir = join(tempDir, "dist");
		mkdirSync(fakeDistDir, { recursive: true });
		writeFileSync(join(fakeDistDir, "hook.cjs"), "// bundled hook");

		// Setup: create a settings.json target
		const settingsDir = join(tempDir, "claude-config");
		mkdirSync(settingsDir, { recursive: true });
		const settingsPath = join(settingsDir, "settings.json");
		writeFileSync(settingsPath, "{}");

		// Import settings to verify the integration
		const { registerHook, buildHookCommand } = require("../../src/cli/settings");

		// Deploy
		const targetPath = join(tempDir, ".claude", "hooks", "yolo-safeguard", "hook.cjs");
		deployHook(join(fakeDistDir, "hook.cjs"), targetPath);

		// Register
		const hookCommand = buildHookCommand(targetPath, "linux", "/usr/bin/node");
		registerHook(settingsPath, hookCommand);

		// Verify hook file deployed
		expect(existsSync(targetPath)).toBe(true);
		const hookContent = readFileSync(targetPath, "utf-8");
		expect(hookContent).toBe("// bundled hook");

		// Verify settings updated
		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		expect(settings.hooks.PreToolUse).toHaveLength(1);
		expect(settings.hooks.PreToolUse[0].hooks[0].command).toContain("yolo-safeguard");
	});

	test("full init flow with project mode deploys to project-local path", () => {
		// Setup
		const fakeDistDir = join(tempDir, "dist");
		mkdirSync(fakeDistDir, { recursive: true });
		writeFileSync(join(fakeDistDir, "hook.cjs"), "// project hook");

		const projectDir = join(tempDir, "my-project");
		mkdirSync(projectDir, { recursive: true });

		// Deploy in project mode
		const targetPath = getHookTargetPath("project", projectDir);
		deployHook(join(fakeDistDir, "hook.cjs"), targetPath);

		// Verify
		expect(existsSync(targetPath)).toBe(true);
		expect(targetPath).toContain(join("my-project", ".claude", "hooks", "yolo-safeguard", "hook.cjs"));
	});
});
