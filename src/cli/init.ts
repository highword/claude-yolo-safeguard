import * as fs from "node:fs";
import { getSettingsPath, buildHookCommand, registerHook } from "./settings";
import { getHookTargetPath, resolveHookSource, deployHook } from "./deploy";

/**
 * CLI entry point for `npx claude-yolo-safeguard init`.
 *
 * Orchestrates the installation flow:
 * 1. Parse args (--project flag)
 * 2. Resolve source hook.cjs from npm package
 * 3. Deploy hook.cjs to target directory
 * 4. Register hook in Claude Code settings.json
 * 5. Print success message
 */
function main(): void {
	// Parse args: check for --project flag
	const args = process.argv.slice(2);
	const isProject = args.includes("--project");
	const mode = isProject ? "project" : "global";

	console.log(`claude-yolo-safeguard: Installing in ${mode} mode...`);

	// Step 1: Resolve source hook.cjs
	const sourcePath = resolveHookSource();
	if (!fs.existsSync(sourcePath)) {
		console.error(`Error: hook.cjs not found at ${sourcePath}`);
		console.error(
			"This may indicate a corrupted installation. Try reinstalling:",
		);
		console.error("  npm install -g claude-yolo-safeguard");
		process.exit(1);
	}

	// Step 2: Deploy hook to target directory
	const targetPath = getHookTargetPath(mode);
	deployHook(sourcePath, targetPath);
	console.log(`  Hook deployed to: ${targetPath}`);

	// Step 3: Register in settings.json
	const settingsPath = getSettingsPath();
	const hookCommand = buildHookCommand(targetPath);
	registerHook(settingsPath, hookCommand);
	console.log(`  Hook registered in: ${settingsPath}`);

	// Step 4: Success message
	console.log("");
	console.log("Done! yolo-safeguard is now active.");
	console.log(
		"Claude Code will intercept dangerous Bash commands automatically.",
	);
	console.log("");
	console.log(
		"To verify: ask Claude to run 'rm -rf /' — it should be blocked.",
	);
}

main();
