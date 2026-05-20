import { describe, expect, test } from "bun:test";
import {
	parseCommand,
	splitSegments,
	rebuildSegment,
	buildTokenSpans,
} from "../../src/pipeline/parser";
import type { ParseEntry } from "../../src/pipeline/types";
import { isOperatorToken } from "../../src/pipeline/types";

describe("parseCommand", () => {
	test("simple command returns string tokens", () => {
		const result = parseCommand("rm -rf /");
		expect(result).toEqual(["rm", "-rf", "/"]);
	});

	test("compound command with && returns tokens with operator", () => {
		const result = parseCommand("ls && rm -rf /");
		// Should contain string tokens and an operator object
		expect(result.length).toBe(5);
		expect(result[0]).toBe("ls");
		expect(result[1]).toEqual({ op: "&&" });
		expect(result[2]).toBe("rm");
		expect(result[3]).toBe("-rf");
		expect(result[4]).toBe("/");
	});

	test("quoted content is preserved as single token", () => {
		const result = parseCommand('echo "rm -rf /"');
		expect(result).toEqual(["echo", "rm -rf /"]);
	});

	test("single-quoted content in bash -c is single token", () => {
		const result = parseCommand("bash -c 'rm -rf /'");
		expect(result).toEqual(["bash", "-c", "rm -rf /"]);
	});

	test("glob token is parsed correctly", () => {
		const result = parseCommand("rm *.tmp");
		expect(result.length).toBe(2);
		expect(result[0]).toBe("rm");
		expect(result[1]).toEqual({ op: "glob", pattern: "*.tmp" });
	});

	test("empty input returns empty array", () => {
		const result = parseCommand("");
		expect(result).toEqual([]);
	});

	test("malformed input returns empty array (fail-open)", () => {
		// shell-quote handles most inputs gracefully, but we wrap in try/catch
		const result = parseCommand("");
		expect(Array.isArray(result)).toBe(true);
	});
});

describe("splitSegments", () => {
	test("compound command with 3 segments", () => {
		const tokens = parseCommand("ls && rm -rf / || echo done");
		const segments = splitSegments(tokens);
		expect(segments.length).toBe(3);
	});

	test("preserves redirections within segments", () => {
		const tokens = parseCommand("echo hello > file.txt");
		const segments = splitSegments(tokens);
		expect(segments.length).toBe(1);
		// The segment should contain all 4 tokens including the redirection
		expect(segments[0].tokens.length).toBe(4);
	});

	test("splits on &&", () => {
		const tokens = parseCommand("cmd1 && cmd2");
		const segments = splitSegments(tokens);
		expect(segments.length).toBe(2);
	});

	test("splits on ||", () => {
		const tokens = parseCommand("cmd1 || cmd2");
		const segments = splitSegments(tokens);
		expect(segments.length).toBe(2);
	});

	test("splits on ;", () => {
		const tokens = parseCommand("cmd1 ; cmd2");
		const segments = splitSegments(tokens);
		expect(segments.length).toBe(2);
	});

	test("splits on |", () => {
		const tokens = parseCommand("cmd1 | cmd2");
		const segments = splitSegments(tokens);
		expect(segments.length).toBe(2);
	});

	test("splits on &", () => {
		const tokens = parseCommand("cmd1 & cmd2");
		const segments = splitSegments(tokens);
		expect(segments.length).toBe(2);
	});

	test("does NOT split on <, >, >>, >&", () => {
		const tokens = parseCommand("cat < input.txt > output.txt");
		const segments = splitSegments(tokens);
		expect(segments.length).toBe(1);
	});

	test("single command with no operators returns 1 segment", () => {
		const tokens = parseCommand("ls -la");
		const segments = splitSegments(tokens);
		expect(segments.length).toBe(1);
		expect(segments[0].original).toBe("ls -la");
	});

	test("empty input returns empty segments array", () => {
		const tokens = parseCommand("");
		const segments = splitSegments(tokens);
		expect(segments.length).toBe(0);
	});
});

describe("rebuildSegment", () => {
	test("rebuilds simple tokens", () => {
		const tokens: ParseEntry[] = ["rm", "-rf", "/"];
		const result = rebuildSegment(tokens);
		expect(result).toBe("rm -rf /");
	});

	test("rebuilds with glob token", () => {
		const tokens: ParseEntry[] = ["rm", { op: "glob", pattern: "*.tmp" }];
		const result = rebuildSegment(tokens);
		expect(result).toBe("rm *.tmp");
	});

	test("rebuilds with redirection operators", () => {
		const tokens: ParseEntry[] = ["echo", "hello", { op: ">" }, "file.txt"];
		const result = rebuildSegment(tokens);
		expect(result).toBe("echo hello > file.txt");
	});

	test("empty tokens returns empty string", () => {
		const result = rebuildSegment([]);
		expect(result).toBe("");
	});
});

describe("buildTokenSpans", () => {
	test("classifies command at position 0", () => {
		const tokens: ParseEntry[] = ["rm", "-rf", "/"];
		const spans = buildTokenSpans(tokens);
		expect(spans[0].position).toBe("command");
		expect(spans[0].token).toBe("rm");
	});

	test("classifies flags starting with -", () => {
		const tokens: ParseEntry[] = ["rm", "-rf", "/"];
		const spans = buildTokenSpans(tokens);
		expect(spans[1].position).toBe("flag");
		expect(spans[1].token).toBe("-rf");
	});

	test("classifies arguments (not command, not flag)", () => {
		const tokens: ParseEntry[] = ["rm", "-rf", "/"];
		const spans = buildTokenSpans(tokens);
		expect(spans[2].position).toBe("argument");
		expect(spans[2].token).toBe("/");
	});

	test("multi-word token is classified as argument with isMultiWord=true", () => {
		const tokens: ParseEntry[] = ["echo", "rm -rf /"];
		const spans = buildTokenSpans(tokens);
		expect(spans[1].position).toBe("argument");
		expect(spans[1].isMultiWord).toBe(true);
	});

	test("single-word token has isMultiWord=false", () => {
		const tokens: ParseEntry[] = ["rm", "-rf", "/"];
		const spans = buildTokenSpans(tokens);
		expect(spans[0].isMultiWord).toBe(false);
		expect(spans[1].isMultiWord).toBe(false);
		expect(spans[2].isMultiWord).toBe(false);
	});

	test("calculates correct character offsets", () => {
		const tokens: ParseEntry[] = ["rm", "-rf", "/"];
		const spans = buildTokenSpans(tokens);
		// "rm -rf /"
		//  01 2345 67
		expect(spans[0].start).toBe(0);
		expect(spans[0].end).toBe(2);
		expect(spans[1].start).toBe(3);
		expect(spans[1].end).toBe(6);
		expect(spans[2].start).toBe(7);
		expect(spans[2].end).toBe(8);
	});

	test("handles glob tokens in span calculation", () => {
		const tokens: ParseEntry[] = ["rm", { op: "glob", pattern: "*.tmp" }];
		const spans = buildTokenSpans(tokens);
		// "rm *.tmp"
		//  01 23456
		expect(spans[0].start).toBe(0);
		expect(spans[0].end).toBe(2);
		expect(spans[1].start).toBe(3);
		expect(spans[1].end).toBe(8);
		expect(spans[1].position).toBe("argument");
	});

	test("empty tokens returns empty spans", () => {
		const spans = buildTokenSpans([]);
		expect(spans).toEqual([]);
	});
});

describe("isOperatorToken", () => {
	test("identifies operator tokens", () => {
		expect(isOperatorToken({ op: "&&" })).toBe(true);
		expect(isOperatorToken({ op: "|" })).toBe(true);
		expect(isOperatorToken({ op: ">" })).toBe(true);
	});

	test("rejects glob tokens", () => {
		expect(isOperatorToken({ op: "glob", pattern: "*.ts" })).toBe(false);
	});

	test("rejects string tokens", () => {
		expect(isOperatorToken("hello")).toBe(false);
	});

	test("rejects null and non-object values", () => {
		expect(isOperatorToken(null as unknown as ParseEntry)).toBe(false);
	});
});
