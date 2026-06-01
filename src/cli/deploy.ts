import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * Returns the absolute target path for hook.cjs deployment.
 *
 * Global mode: ~/.claude/hooks/yolo-safeguard/hook.cjs
 * Project mode: <cwd>/.claude/hooks/yolo-safeguard/hook.cjs
 *
 * @param mode - "global" or "project" installation mode
 * @param cwd - Current working directory (used for project mode, defaults to process.cwd())
 */
export function getHookTargetPath(
	mode: "global" | "project",
	cwd: string = process.cwd(),
): string {
	const base =
		mode === "global" ? os.homedir() : cwd;
	return path.join(base, ".claude", "hooks", "yolo-safeguard", "hook.cjs");
}

/**
 * Resolves the source path for hook.cjs within the npm package.
 *
 * Primary: <baseDir>/hook.cjs (when cli.cjs and hook.cjs are siblings in dist/)
 * Fallback: <baseDir>/../dist/hook.cjs (when running from a different location)
 *
 * @param baseDir - The directory to search from (defaults to __dirname)
 */
export function resolveHookSource(baseDir: string = __dirname): string {
	const primaryPath = path.join(baseDir, "hook.cjs");
	if (fs.existsSync(primaryPath)) {
		return primaryPath;
	}
	// Fallback: look in ../dist/ relative to base
	return path.resolve(baseDir, "..", "dist", "hook.cjs");
}

/**
 * Validates that a target path is within an expected safe directory.
 * The path must contain a `.claude` segment to be considered valid.
 * Prevents path traversal attacks (T-04-06).
 */
function validateTargetPath(targetPath: string): void {
	const normalized = path.normalize(targetPath);
	// Must contain .claude directory segment
	const segments = normalized.split(path.sep);
	if (!segments.includes(".claude")) {
		throw new Error(
			`Invalid target path: ${targetPath} — must be within a .claude directory`,
		);
	}
}

/**
 * Deploys (copies) hook.cjs from source to target location.
 *
 * - Creates target directory if it doesn't exist
 * - Overwrites existing file (upgrade scenario)
 * - Sets executable permission on Unix
 * - Validates target path is safe (T-04-06)
 *
 * @param sourcePath - Absolute path to source hook.cjs
 * @param targetPath - Absolute path to deployment target
 */
export function deployHook(sourcePath: string, targetPath: string): void {
	// Validate target path (T-04-06: prevent path traversal)
	validateTargetPath(targetPath);

	// Ensure target directory exists
	fs.mkdirSync(path.dirname(targetPath), { recursive: true });

	// Copy file (overwrites if exists — upgrade scenario)
	fs.copyFileSync(sourcePath, targetPath);

	// Set executable permission on Unix
	if (process.platform !== "win32") {
		try {
			fs.chmodSync(targetPath, 0o755);
		} catch {
			// Non-fatal: file will still be runnable via `node <path>`
		}
	}
}
