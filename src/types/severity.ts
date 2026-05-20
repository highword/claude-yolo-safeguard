export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export type Action = "block" | "warn" | "log" | "off";

export type SeverityActionMap = Record<Severity, Action>;

export const DEFAULT_SEVERITY_ACTIONS: SeverityActionMap = {
	CRITICAL: "block",
	HIGH: "block",
	MEDIUM: "warn",
	LOW: "log",
	INFO: "off",
};
