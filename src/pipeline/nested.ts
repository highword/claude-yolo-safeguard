import type { ParseEntry } from "./types";
import { isOperatorToken } from "./types";

/**
 * Represents a nested command extracted from a shell wrapper, interpreter, or subshell.
 */
export interface NestedCommand {
	command: string;
	source: "shell-wrapper" | "subshell" | "interpreter";
}

/** Shell wrapper commands that use -c to execute a string as shell code */
export const SHELL_WRAPPERS = new Set([
	"bash",
	"sh",
	"zsh",
	"dash",
	"/bin/bash",
	"/bin/sh",
	"/bin/zsh",
	"/bin/dash",
	"/usr/bin/bash",
	"/usr/bin/sh",
	"/usr/bin/zsh",
]);

/** Commands that delegate to another command (env) */
export const ENV_COMMANDS = new Set(["/usr/bin/env", "env"]);

/** Interpreter commands and their exec flags */
export const INTERPRETERS: Record<string, string[]> = {
	python: ["-c"],
	python3: ["-c"],
	node: ["-e", "--eval"],
	ruby: ["-e"],
	perl: ["-e"],
};

/**
 * Extract nested commands from a token array.
 * Detects shell wrappers (bash -c), env wrappers (/usr/bin/env bash -c),
 * and interpreter one-liners (python -c, node -e, ruby -e, perl -e).
 *
 * Per D-28: This module extracts one level; caller handles recursion stack and depth limit.
 *
 * @param tokens - ParseEntry array from shell-quote parse
 * @returns Array of nested commands found
 */
export function extractNestedCommands(
	tokens: ParseEntry[],
): NestedCommand[] {
	// Filter to string tokens only for pattern detection
	const stringTokens: string[] = [];
	for (const t of tokens) {
		if (typeof t === "string") {
			stringTokens.push(t);
		}
	}

	if (stringTokens.length < 2) {
		return [];
	}

	const results: NestedCommand[] = [];

	for (let i = 0; i < stringTokens.length; i++) {
		const current = stringTokens[i];

		// Pattern 1: env <shell> -c <command>
		if (ENV_COMMANDS.has(current)) {
			const next = stringTokens[i + 1];
			if (next && SHELL_WRAPPERS.has(next)) {
				const flag = stringTokens[i + 2];
				const arg = stringTokens[i + 3];
				if (flag === "-c" && arg !== undefined) {
					results.push({ command: arg, source: "shell-wrapper" });
					i += 3; // Skip past consumed tokens
					continue;
				}
			}
			continue;
		}

		// Pattern 2: shell -c <command>
		if (SHELL_WRAPPERS.has(current)) {
			const flag = stringTokens[i + 1];
			const arg = stringTokens[i + 2];
			if (flag === "-c" && arg !== undefined) {
				results.push({ command: arg, source: "shell-wrapper" });
				i += 2; // Skip past consumed tokens
				continue;
			}
			continue;
		}

		// Pattern 3: interpreter <flag> <code>
		const interpreterFlags = INTERPRETERS[current];
		if (interpreterFlags) {
			const flag = stringTokens[i + 1];
			const arg = stringTokens[i + 2];
			if (flag && interpreterFlags.includes(flag) && arg !== undefined) {
				results.push({ command: arg, source: "interpreter" });
				i += 2; // Skip past consumed tokens
				continue;
			}
		}
	}

	return results;
}

/**
 * Extract subshell expressions from a token array.
 * Detects $(...) patterns where shell-quote decomposes them into:
 * "$" (or string ending with "$"), {op:"("}, ...tokens..., {op:")"}
 *
 * @param tokens - ParseEntry array from shell-quote parse
 * @returns Array of subshell commands found
 */
export function extractSubshells(tokens: ParseEntry[]): NestedCommand[] {
	const results: NestedCommand[] = [];

	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];

		// Look for "$" (or string ending with "$") followed by {op: "("}
		if (typeof token === "string" && (token === "$" || token.endsWith("$"))) {
			const next = tokens[i + 1];
			if (next && isOperatorToken(next) && next.op === "(") {
				// Found $( — collect tokens until matching )
				const innerTokens: ParseEntry[] = [];
				let depth = 1;
				let j = i + 2;

				while (j < tokens.length && depth > 0) {
					const t = tokens[j];
					if (isOperatorToken(t)) {
						if (t.op === "(") {
							depth++;
							if (depth > 1) innerTokens.push(t);
						} else if (t.op === ")") {
							depth--;
							if (depth > 0) innerTokens.push(t);
						} else {
							innerTokens.push(t);
						}
					} else {
						innerTokens.push(t);
					}
					j++;
				}

				// Rebuild inner tokens into a command string
				if (innerTokens.length > 0) {
					const command = rebuildInnerTokens(innerTokens);
					if (command) {
						results.push({ command, source: "subshell" });
					}
				}

				// Skip past the consumed tokens
				i = j - 1;
			}
		}
	}

	return results;
}

/**
 * Rebuild inner tokens of a subshell into a command string.
 * Only uses string tokens and glob patterns, joined by spaces.
 */
function rebuildInnerTokens(tokens: ParseEntry[]): string {
	const parts: string[] = [];

	for (const token of tokens) {
		if (typeof token === "string") {
			parts.push(token);
		} else if (typeof token === "object" && token !== null) {
			if ("pattern" in token && "op" in token) {
				parts.push((token as { op: "glob"; pattern: string }).pattern);
			} else if ("op" in token) {
				parts.push((token as { op: string }).op);
			}
		}
	}

	return parts.join(" ");
}
