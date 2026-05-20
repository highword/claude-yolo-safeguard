import type { Config } from "../types/config";
import { DEFAULT_SEVERITY_ACTIONS } from "../types/severity";

export function getDefaults(): Config {
	return {
		severityActions: { ...DEFAULT_SEVERITY_ACTIONS },
		customRules: [],
		allowList: [],
		logging: {
			enabled: true,
			path: "~/.local/share/yolo-safeguard/audit.jsonl",
			maxSizeMb: 10,
		},
	};
}
