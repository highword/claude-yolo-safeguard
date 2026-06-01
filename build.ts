import { existsSync, renameSync, rmSync } from "node:fs";

// Build 1: Hook bundle (runtime, invoked by Claude Code)
const hookResult = await Bun.build({
	entrypoints: ["./src/hook/entry.ts"],
	outdir: "./dist",
	target: "node",
	format: "cjs",
	minify: true,
	sourcemap: "external",
	naming: "[dir]/hook.[ext]",
});

if (!hookResult.success) {
	console.error("Hook build failed:");
	for (const log of hookResult.logs) {
		console.error(log);
	}
	process.exit(1);
}

// Rename .js to .cjs for explicit CommonJS identification
if (existsSync("./dist/hook.js")) {
	if (existsSync("./dist/hook.cjs")) rmSync("./dist/hook.cjs");
	renameSync("./dist/hook.js", "./dist/hook.cjs");
}
if (existsSync("./dist/hook.js.map")) {
	if (existsSync("./dist/hook.cjs.map")) rmSync("./dist/hook.cjs.map");
	renameSync("./dist/hook.js.map", "./dist/hook.cjs.map");
}

// Build 2: CLI bundle (installer, invoked via npx)
const cliResult = await Bun.build({
	entrypoints: ["./src/cli/init.ts"],
	outdir: "./dist",
	target: "node",
	format: "cjs",
	minify: true,
	sourcemap: "external",
	naming: "[dir]/cli.[ext]",
});

if (!cliResult.success) {
	console.error("CLI build failed:");
	for (const log of cliResult.logs) {
		console.error(log);
	}
	process.exit(1);
}

if (existsSync("./dist/cli.js")) {
	if (existsSync("./dist/cli.cjs")) rmSync("./dist/cli.cjs");
	renameSync("./dist/cli.js", "./dist/cli.cjs");
}
if (existsSync("./dist/cli.js.map")) {
	if (existsSync("./dist/cli.cjs.map")) rmSync("./dist/cli.cjs.map");
	renameSync("./dist/cli.js.map", "./dist/cli.cjs.map");
}

console.log("Build complete: dist/hook.cjs + dist/cli.cjs");
