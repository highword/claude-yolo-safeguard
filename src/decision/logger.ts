import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { Decision } from "../types/decision";
import type { LoggingConfig } from "../types/config";

export interface AuditContext {
	command: string;
	cwd?: string;
	sessionId?: string;
}

function expandPath(p: string): string {
	if (p.startsWith("~/") || p === "~") {
		return path.join(os.homedir(), p.slice(2));
	}
	return p;
}

function ensureDirectory(filePath: string): void {
	try {
		fs.mkdirSync(path.dirname(filePath), { recursive: true });
	} catch {
		// fail-open
	}
}

function rotateIfNeeded(logPath: string, maxSizeMb: number): void {
	try {
		const stats = fs.statSync(logPath);
		if (stats.size > maxSizeMb * 1024 * 1024) {
			fs.renameSync(logPath, `${logPath}.1`);
		}
	} catch {
		// File doesn't exist yet or other error — no rotation needed
	}
}

function buildRecord(
	decision: Decision,
	context: AuditContext,
): Record<string, unknown> {
	if (decision.action === "block" || decision.action === "warn") {
		return {
			timestamp: decision.timestamp,
			action: decision.action,
			severity: decision.severity,
			command: context.command,
			cwd: context.cwd,
			sessionId: context.sessionId,
			rules: decision.matchedRules.map((m) => ({
				id: m.rule.id,
				matched: m.matchedText,
				description: m.rule.description,
			})),
			suggestion: decision.suggestion,
		};
	}

	return {
		timestamp: decision.timestamp,
		action: decision.action,
		command: context.command,
	};
}

export function writeAuditLog(
	decision: Decision,
	config: LoggingConfig,
	context: AuditContext,
): void {
	if (!config.enabled) return;

	try {
		const logPath = expandPath(config.path);
		ensureDirectory(logPath);
		rotateIfNeeded(logPath, config.maxSizeMb);

		const record = buildRecord(decision, context);
		fs.appendFileSync(logPath, `${JSON.stringify(record)}\n`);
	} catch {
		// Fail-open: never block a command because logging broke (D-55)
	}
}
