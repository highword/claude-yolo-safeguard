import { existsSync, renameSync, rmSync } from "node:fs";

const result = await Bun.build({
	entrypoints: ["./src/index.ts"],
	outdir: "./dist",
	target: "node",
	format: "cjs",
	minify: true,
	sourcemap: "external",
	naming: "[dir]/hook.[ext]",
});

if (!result.success) {
	console.error("Build failed:");
	for (const log of result.logs) {
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
