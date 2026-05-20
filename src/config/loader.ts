import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { Config, AllowListEntry } from "../types/config";
import type { Rule } from "../types/rule";
import type { Action, Severity, SeverityActionMap } from "../types/severity";
import { getDefaults } from "./defaults";

/**
 * Action strictness ranking: higher = stricter.
 */
const ACTION_RANK: Record<Action, number> = {
	off: 0,
	log: 1,
	warn: 2,
	block: 3,
};

/**
 * Returns true if the proposed action is stricter than the current action.
 */
function isEscalation(current: Action, proposed: Action): boolean {
	return ACTION_RANK[proposed] > ACTION_RANK[current];
}

/**
 * Reads and parses a JSON file. Returns null if file is missing or contains invalid JSON.
 * Uses synchronous read for <50ms performance requirement.
 */
function readJsonFile(filePath: string): Record<string, unknown> | null {
	try {
		const content = fs.readFileSync(filePath, "utf-8");
		const parsed = JSON.parse(content);
		if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
			return parsed as Record<string, unknown>;
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Merges three configuration layers with escalation-only enforcement for project-level.
 *
 * - User-level (layer 2) can override anything in base (unrestricted).
 * - Project-level (layer 3) has restrictions:
 *   - severityActions: only escalation allowed (stricter), CRITICAL is immutable
 *   - customRules: appended additively
 *   - allowList: appended additively
 *   - logging: project cannot change logging config
 */
export function mergeConfigs(
	base: Config,
	user: Partial<Config> | null,
	project: Partial<Config> | null,
): Config {
	// Start with a deep copy of base
	const merged: Config = {
		severityActions: { ...base.severityActions },
		customRules: [...base.customRules],
		allowList: [...base.allowList],
		logging: { ...base.logging },
	};

	// Step 1: Apply user-level overrides (unrestricted)
	if (user) {
		if (user.severityActions) {
			for (const [sev, action] of Object.entries(user.severityActions)) {
				merged.severityActions[sev as Severity] = action as Action;
			}
		}
		if (user.customRules) {
			merged.customRules.push(...(user.customRules as Rule[]));
		}
		if (user.allowList) {
			merged.allowList.push(...(user.allowList as AllowListEntry[]));
		}
		if (user.logging) {
			merged.logging = { ...merged.logging, ...user.logging };
		}
	}

	// Step 2: Apply project-level with restrictions
	if (project) {
		if (project.severityActions) {
			for (const [sev, action] of Object.entries(project.severityActions)) {
				const severity = sev as Severity;
				const proposedAction = action as Action;

				// CRITICAL is immutable by project-level config (D-13)
				if (severity === "CRITICAL") {
					continue;
				}

				// Only allow escalation (stricter action)
				if (isEscalation(merged.severityActions[severity], proposedAction)) {
					merged.severityActions[severity] = proposedAction;
				}
				// Silently ignore de-escalation attempts
			}
		}

		if (project.customRules) {
			merged.customRules.push(...(project.customRules as Rule[]));
		}

		if (project.allowList) {
			merged.allowList.push(...(project.allowList as AllowListEntry[]));
		}

		// project cannot change logging config (intentionally no logging merge here)
	}

	return merged;
}

/**
 * Loads configuration using the 3-layer merge strategy:
 * 1. Built-in defaults
 * 2. User-level config (~/.config/yolo-safeguard/config.json)
 * 3. Project-level config (.safeguard.json in cwd)
 *
 * Returns sensible defaults if no config files exist (zero-config per INST-03).
 */
export function loadConfig(cwd: string): Config {
	const defaults = getDefaults();

	// Layer 2: User-level config
	const userConfigPath = path.join(
		os.homedir(),
		".config",
		"yolo-safeguard",
		"config.json",
	);
	const userConfig = readJsonFile(userConfigPath) as Partial<Config> | null;

	// Layer 3: Project-level config
	const projectConfigPath = path.join(cwd, ".safeguard.json");
	const projectConfig = readJsonFile(projectConfigPath) as Partial<Config> | null;

	return mergeConfigs(defaults, userConfig, projectConfig);
}
