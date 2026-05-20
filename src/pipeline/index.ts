import type { Rule, RuleMatch } from "../types/rule";
import type { AnalysisResult, AnalysisFrame, ParseEntry, TokenSpan } from "./types";
import { parseCommand, splitSegments, buildTokenSpans } from "./parser";
import { extractNestedCommands, extractSubshells } from "./nested";
import { matchRules, COMPILED_SHELL_RULES, compileRules } from "./matcher";
import { quickReject } from "../rules/index";

/** Maximum recursion depth for nested command analysis (per D-25, D-28) */
const MAX_DEPTH = 10;

/**
 * PowerShell command indicators for platform detection (per D-46).
 * If a command starts with these patterns, skip shell-quote parsing
 * and use regex-only fallback (best-effort until Phase 6).
 */
const POWERSHELL_PREFIXES = [
	"Remove-Item",
	"Get-",
	"Set-",
	"New-",
	"Invoke-",
	"Stop-",
	"Start-",
	"Test-",
	"Clear-",
	"Copy-Item",
	"Move-Item",
	"Write-",
	"Read-",
	"Out-",
	"Select-",
	"Where-Object",
	"ForEach-Object",
];

/**
 * Detect if a command string appears to be PowerShell syntax.
 * Uses simple heuristic: PascalCase cmdlet prefixes or PowerShell-specific flags.
 */
function isPowerShellCommand(command: string): boolean {
	const trimmed = command.trimStart();
	for (const prefix of POWERSHELL_PREFIXES) {
		if (trimmed.startsWith(prefix)) {
			return true;
		}
	}
	// Check for PowerShell-style flags with PascalCase
	if (
		trimmed.includes("-Recurse") ||
		trimmed.includes("-Force") ||
		trimmed.includes("-ErrorAction")
	) {
		// Only if it also has a PascalCase first word
		const firstWord = trimmed.split(/\s/)[0];
		if (firstWord && /^[A-Z][a-z]+(-[A-Z][a-z]+)+/.test(firstWord)) {
			return true;
		}
	}
	return false;
}

/**
 * Build a synthetic TokenSpan array for regex-only analysis (no shell-quote parsing).
 * Used for PowerShell commands and interpreter content where shell-quote is inappropriate.
 */
function buildSyntheticSpans(command: string): TokenSpan[] {
	return [
		{
			token: command,
			start: 0,
			end: command.length,
			position: "command",
			isMultiWord: command.includes(" "),
		},
	];
}

/**
 * Analyze a shell command for dangerous operations.
 *
 * This is the main entry point for the shell command analysis pipeline.
 * It orchestrates: Quick Reject -> Platform Detection -> Recursive Analysis
 * (parse -> segment -> nested extraction -> regex matching -> token position verification -> filters).
 *
 * @param command - Raw shell command string from Claude Code's Bash tool_input.command
 * @param customRules - Optional additional rules to include in matching
 * @returns AnalysisResult with matches, segment count, and max depth reached
 */
export function analyzeCommand(
	command: string,
	customRules?: Rule[],
): AnalysisResult {
	// Step 1: Quick Reject - if no keywords found, guaranteed no match
	if (quickReject(command)) {
		if (!customRules) {
			return { matches: [], segmentCount: 0, maxDepth: 0 };
		}
		const lower = command.toLowerCase();
		const hasCustomKeyword = customRules.some((rule) =>
			rule.keywords.some((kw) => lower.includes(kw.toLowerCase())),
		);
		if (!hasCustomKeyword) {
			return { matches: [], segmentCount: 0, maxDepth: 0 };
		}
	}

	// Step 2: Determine compiled rules set (built-in + optional custom)
	const allCompiledRules = customRules
		? [...COMPILED_SHELL_RULES, ...compileRules(customRules)]
		: COMPILED_SHELL_RULES;

	// Step 3: Platform detection (per D-46)
	if (isPowerShellCommand(command)) {
		// Regex-only fallback for PowerShell commands
		const spans = buildSyntheticSpans(command);
		const matches = matchRules(command, spans, allCompiledRules, true);
		return { matches, segmentCount: 1, maxDepth: 0 };
	}

	// Step 4: Recursive stack-based analysis (per D-28)
	const stack: AnalysisFrame[] = [
		{ command, depth: 0, source: "root" },
	];
	const allMatches: RuleMatch[] = [];
	let maxDepth = 0;
	let segmentCount = 0;

	while (stack.length > 0) {
		const frame = stack.pop()!;

		// Bail at depth limit (fail-open per D-25)
		if (frame.depth >= MAX_DEPTH) {
			continue;
		}

		maxDepth = Math.max(maxDepth, frame.depth);

		// For interpreter frames: regex-only analysis (not shell syntax per D-27)
		if (frame.source === "interpreter") {
			const spans = buildSyntheticSpans(frame.command);
			const matches = matchRules(
				frame.command,
				spans,
				allCompiledRules,
				true,
			);
			allMatches.push(...matches);

			// Also check for nested shell commands inside interpreter code
			// e.g., os.system('rm -rf /') - extract the shell command
			const shellCmdMatches = extractShellFromInterpreter(frame.command);
			for (const shellCmd of shellCmdMatches) {
				stack.push({
					command: shellCmd,
					depth: frame.depth + 1,
					source: "shell-wrapper",
				});
			}
			segmentCount += 1;
			continue;
		}

		// POSIX pipeline: parse -> segment -> analyze
		const tokens = parseCommand(frame.command);
		const segments = splitSegments(tokens);
		segmentCount += segments.length;

		for (const segment of segments) {
			// Extract nested commands and push to stack for recursive analysis
			const nested = extractNestedCommands(segment.tokens);
			const subshells = extractSubshells(segment.tokens);

			for (const n of nested) {
				stack.push({
					command: n.command,
					depth: frame.depth + 1,
					source: n.source,
				});
			}
			for (const s of subshells) {
				stack.push({
					command: s.command,
					depth: frame.depth + 1,
					source: s.source,
				});
			}

			// Build token spans and run matcher on current segment
			const spans = buildTokenSpans(segment.tokens);
			const matches = matchRules(
				segment.original,
				spans,
				allCompiledRules,
				false,
			);
			allMatches.push(...matches);
		}
	}

	// Step 5: Deduplicate matches (same rule at same index from recursive re-analysis)
	const deduped = deduplicateMatches(allMatches);

	return { matches: deduped, segmentCount, maxDepth };
}

/**
 * Extract shell commands from interpreter one-liner content.
 * Looks for common patterns like os.system('...'), exec('...'), system('...'),
 * child_process.exec('...'), etc.
 */
function extractShellFromInterpreter(code: string): string[] {
	if (code.length > 10000) {
		return [];
	}

	const results: string[] = [];

	// Match patterns like: os.system('cmd'), system('cmd'), exec('cmd'),
	// child_process.exec('cmd'), subprocess.run(['cmd'])
	const patterns = [
		/(?:os\.system|system|exec|popen|subprocess\.(?:run|call|Popen))\s*\(\s*['"`]([^'"`]+)['"`]/g,
		/(?:child_process['"]?\s*\)?\s*\.?\s*(?:exec|spawn|execSync))\s*\(\s*['"`]([^'"`]+)['"`]/g,
	];

	for (const pattern of patterns) {
		let match: RegExpExecArray | null;
		// biome-ignore lint/suspicious/noAssignInExpressions: intentional regex iteration
		while ((match = pattern.exec(code)) !== null) {
			if (match[1]) {
				results.push(match[1]);
			}
		}
	}

	return results;
}

/**
 * Deduplicate matches by rule.id + index.
 * Prevents duplicate reporting when the same command is analyzed
 * at multiple depths in the recursion stack.
 */
function deduplicateMatches(matches: RuleMatch[]): RuleMatch[] {
	const seen = new Set<string>();
	const result: RuleMatch[] = [];

	for (const match of matches) {
		const key = `${match.rule.id}:${match.index}`;
		if (!seen.has(key)) {
			seen.add(key);
			result.push(match);
		}
	}

	return result;
}
