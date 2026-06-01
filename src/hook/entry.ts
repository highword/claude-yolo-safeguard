import * as fs from "node:fs";
import { processHookEvent } from "./process";

try {
	// Read stdin synchronously (per RESEARCH.md Pattern 1)
	const raw = fs.readFileSync(0, "utf8");
	const result = processHookEvent(raw);
	if (result.output) {
		process.stdout.write(result.output);
	}
	process.exit(result.exitCode);
} catch {
	// D-66: Any uncaught error = fail-open (allow operation)
	process.exit(0);
}
