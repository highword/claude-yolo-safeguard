import type { Rule, RuleMatch } from "../types/rule";

/** Re-export shell-quote's parse entry type for internal use */
export type ParseEntry =
	| string
	| { op: string }
	| { op: "glob"; pattern: string }
	| { comment: string };

/** A single segment from a compound command, split at operators */
export interface Segment {
	tokens: ParseEntry[];
	original: string; // rebuilt string from tokens
}

/** Character span mapping a token to its position in the rebuilt string */
export interface TokenSpan {
	token: ParseEntry;
	start: number;
	end: number;
	position: "command" | "argument" | "flag";
	isMultiWord: boolean; // true if token contains spaces (was quoted)
}

/** Pre-compiled rule for matching performance */
export interface CompiledRule {
	rule: Rule;
	regex: RegExp;
}

/** Frame in the recursive analysis stack */
export interface AnalysisFrame {
	command: string;
	depth: number;
	source: "root" | "shell-wrapper" | "subshell" | "interpreter";
}

/** Result from the full analysis pipeline */
export interface AnalysisResult {
	matches: RuleMatch[];
	segmentCount: number;
	maxDepth: number;
}
