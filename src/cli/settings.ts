import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * Returns the path to Claude Code's settings.json file.
 * Respects the CLAUDE_CONFIG_DIR environment variable if set.
 */
export function getSettingsPath(): string {
	const configDir =
		process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
	return path.join(configDir, "settings.json");
}

/**
 * Builds the hook invocation command string for settings.json registration.
 *
 * On Windows: quotes both the node path and hook path, uses forward slashes.
 * On Unix: simple `node <path>` format (no quoting needed).
 *
 * @param hookPath - Absolute path to hook.cjs
 * @param platform - OS platform (defaults to process.platform)
 * @param nodePath - Path to node executable (defaults to process.execPath)
 */
export function buildHookCommand(
	hookPath: string,
	platform: string = process.platform,
	nodePath: string = process.execPath,
): string {
	if (platform === "win32") {
		// Windows: quote both paths, use forward slashes (Pitfall 1: avoid backslash escaping in JSON)
		const nodeForward = nodePath.replace(/\\/g, "/");
		const hookForward = hookPath.replace(/\\/g, "/");
		return `"${nodeForward}" "${hookForward}"`;
	}
	// Unix (macOS/Linux): simple unquoted command
	return `node ${hookPath}`;
}

/**
 * Reads a settings.json file safely.
 * Returns an empty object if the file doesn't exist or is invalid JSON.
 */
function readSettings(settingsPath: string): Record<string, unknown> {
	try {
		const content = fs.readFileSync(settingsPath, "utf-8");
		const parsed = JSON.parse(content);
		if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
			return parsed as Record<string, unknown>;
		}
		return {};
	} catch {
		return {};
	}
}

/**
 * Registers the yolo-safeguard hook in Claude Code's settings.json.
 *
 * - Appends to existing hooks (never overwrites other entries) (D-68)
 * - Deduplicates: if yolo-safeguard already registered, updates in-place (Pitfall 5)
 * - Creates backup (.bak) before modification (T-04-05, T-04-07)
 * - Validates target path (T-04-06)
 * - Writes with 2-space indentation + trailing newline (D-69)
 */
export function registerHook(settingsPath: string, hookCommand: string): void {
	// Ensure parent directory exists
	fs.mkdirSync(path.dirname(settingsPath), { recursive: true });

	// Read existing settings (fail-open if missing/invalid)
	const fileExists = fs.existsSync(settingsPath);
	const settings = readSettings(settingsPath);

	// Create backup before modification (T-04-05: tamper recovery)
	if (fileExists) {
		try {
			fs.copyFileSync(settingsPath, settingsPath + ".bak");
		} catch {
			// Backup failure is non-fatal
		}
	}

	// Ensure hooks.PreToolUse array exists
	if (
		!settings.hooks ||
		typeof settings.hooks !== "object" ||
		Array.isArray(settings.hooks)
	) {
		settings.hooks = {};
	}
	const hooks = settings.hooks as Record<string, unknown>;
	if (!Array.isArray(hooks.PreToolUse)) {
		hooks.PreToolUse = [];
	}

	const preToolUse = hooks.PreToolUse as Array<Record<string, unknown>>;

	// Check for existing yolo-safeguard entry (deduplication per D-68 + Pitfall 5)
	const existingIdx = preToolUse.findIndex((entry) => {
		const entryHooks = entry?.hooks;
		if (!Array.isArray(entryHooks)) return false;
		return entryHooks.some(
			(h: Record<string, unknown>) =>
				typeof h?.command === "string" &&
				h.command.includes("yolo-safeguard"),
		);
	});

	const hookEntry = {
		matcher: "Bash",
		hooks: [
			{
				type: "command",
				command: hookCommand,
				timeout: 5,
			},
		],
	};

	if (existingIdx >= 0) {
		// Update in-place (no duplicate)
		preToolUse[existingIdx] = hookEntry;
	} else {
		// Append new entry
		preToolUse.push(hookEntry);
	}

	// Validate JSON before write (T-04-07: never corrupt settings file)
	const output = JSON.stringify(settings, null, 2) + "\n";
	JSON.parse(output); // Round-trip validation — throws if somehow invalid

	// Write back with 2-space indent + trailing newline (D-69)
	fs.writeFileSync(settingsPath, output);
}
