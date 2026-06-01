# Phase 4: Hook Integration & Installation - Pattern Map

**Mapped:** 2026-06-01
**Files analyzed:** 8 new/modified files
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/hook/entry.ts` | controller | request-response | `src/pipeline/index.ts` | role-match |
| `src/cli/init.ts` | controller | file-I/O | `src/config/loader.ts` | role-match |
| `src/cli/settings.ts` | service | file-I/O | `src/config/loader.ts` | exact |
| `src/cli/deploy.ts` | service | file-I/O | `src/decision/logger.ts` | role-match |
| `src/decision/format.ts` | service | transform | `src/decision/format.ts` | exact (modify) |
| `build.ts` | config | batch | `build.ts` | exact (modify) |
| `tests/hook/entry.test.ts` | test | request-response | `tests/decision/format.test.ts` | role-match |
| `tests/cli/settings.test.ts` | test | file-I/O | `tests/decision/logger.test.ts` | exact |

## Pattern Assignments

### `src/hook/entry.ts` (controller, request-response)

**Analog:** `src/pipeline/index.ts` — same pattern of orchestrating multiple subsystems with early-exit paths

**Imports pattern** (lines 1-7 of `src/pipeline/index.ts`):
```typescript
import type { Rule, RuleMatch } from "../types/rule";
import type { AnalysisResult, AnalysisFrame, ParseEntry, TokenSpan } from "./types";
import { parseCommand, splitSegments, buildTokenSpans } from "./parser";
import { extractNestedCommands, extractSubshells } from "./nested";
import { matchRules, COMPILED_SHELL_RULES, compileRules } from "./matcher";
import { quickReject } from "../rules/index";
```

**Adapt to hook entry:**
```typescript
import * as fs from "node:fs";
import { loadConfig } from "../config/loader";
import { analyzeCommand } from "../pipeline/index";
import { applyAllowList } from "../decision/allow-list";
import { makeDecision } from "../decision/decide";
import { formatHookOutput } from "../decision/format";
import { writeAuditLog } from "../decision/logger";
import type { ClaudeCodeHookEvent } from "../types/hook";
```

**Core pattern — early-exit with multiple bail-out paths** (lines 89-105 of `src/pipeline/index.ts`):
```typescript
export function analyzeCommand(
    command: string,
    customRules?: Rule[],
): AnalysisResult {
    // Step 1: Quick Reject - if no keywords found, guaranteed no match
    if (quickReject(command)) {
        if (!customRules) {
            return { matches: [], segmentCount: 0, maxDepth: 0 };
        }
        // ...
    }
```

**Apply this pattern for tool routing (D-65):** Early exit for Write/Edit tools, early exit for missing command, then proceed with full pipeline.

**Error handling — fail-open convention** (from `src/decision/logger.ts` lines 74-84):
```typescript
try {
    // ... all logic ...
} catch {
    // Fail-open: never block a command because logging broke (D-55)
}
```

**Apply as global try-catch wrapping entire entry point (D-66):**
```typescript
try {
    // ... all hook logic ...
} catch {
    // Any error = allow the operation (fail-open)
    process.exit(0);
}
```

---

### `src/cli/init.ts` (controller, file-I/O)

**Analog:** `src/config/loader.ts` — same pattern of resolving cross-platform paths + reading/writing JSON files

**Imports pattern** (lines 1-7 of `src/config/loader.ts`):
```typescript
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { Config, AllowListEntry } from "../types/config";
import type { Rule } from "../types/rule";
import type { Action, Severity, SeverityActionMap } from "../types/severity";
import { getDefaults } from "./defaults";
```

**Core pattern — cross-platform path resolution** (lines 126-143 of `src/config/loader.ts`):
```typescript
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
```

**Apply this pattern for:** Resolving hook target path (global vs project-local), resolving settings.json path, orchestrating the install flow.

---

### `src/cli/settings.ts` (service, file-I/O)

**Analog:** `src/config/loader.ts` — exact match for JSON file read/parse/modify/write

**Core pattern — safe JSON read with try-catch** (lines 30-41 of `src/config/loader.ts`):
```typescript
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
```

**Apply this pattern for:** Reading settings.json, modifying the hooks field, writing back with formatting preserved. Same try-catch + null-return pattern for missing/corrupt files.

---

### `src/cli/deploy.ts` (service, file-I/O)

**Analog:** `src/decision/logger.ts` — same pattern of ensuring directories exist + writing files

**Core pattern — ensureDirectory + write** (lines 20-25 of `src/decision/logger.ts`):
```typescript
function ensureDirectory(filePath: string): void {
    try {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
    } catch {
        // fail-open
    }
}
```

**Core pattern — expandPath for ~ handling** (lines 13-18 of `src/decision/logger.ts`):
```typescript
function expandPath(p: string): string {
    if (p.startsWith("~/") || p === "~") {
        return path.join(os.homedir(), p.slice(2));
    }
    return p;
}
```

**Apply this pattern for:** Creating `~/.claude/hooks/yolo-safeguard/` directory, copying hook.cjs to target path.

---

### `src/decision/format.ts` (service, transform) — MODIFY

**Analog:** Self — this file is being modified to use structured `hookSpecificOutput` format

**Current pattern** (lines 19-57 of `src/decision/format.ts`):
```typescript
export function formatHookOutput(decision: Decision): FormattedOutput {
    if (
        decision.action === "off" ||
        decision.action === "log" ||
        decision.matchedRules.length === 0
    ) {
        return { output: "", exitCode: 0 };
    }

    const primary = decision.matchedRules[0];

    if (decision.action === "block") {
        const hookOutput: HookOutput = {
            decision: "block",
            reason: decision.message,
            rule: primary?.rule.id,
            severity: decision.severity,
            category: primary?.rule.category,
            suggestion: decision.suggestion || undefined,
            matchedPatterns: decision.matchedRules.map((m) => m.rule.id),
        };
        return { output: JSON.stringify(stripUndefined(hookOutput)), exitCode: 2 };
    }
    // ...
}
```

**Target pattern** (from RESEARCH.md — structured `hookSpecificOutput` format):
```typescript
if (decision.action === "block") {
    const output = {
        hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
        },
        systemMessage: decision.message || "Command blocked by yolo-safeguard",
    };
    return { output: JSON.stringify(output), exitCode: 2 };
}

if (decision.action === "warn") {
    const output = {
        hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "allow",
            additionalContext: decision.message || "Warning from yolo-safeguard",
        },
    };
    return { output: JSON.stringify(output), exitCode: 0 };
}
```

**Keep:** The `stripUndefined` helper, the early-return for off/log/empty matches, the `FormattedOutput` interface.

---

### `build.ts` (config, batch) — MODIFY

**Analog:** Self — this file is being modified to add dual-entrypoint builds

**Current pattern** (lines 1-29 of `build.ts`):
```typescript
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
```

**Apply same pattern for second build (cli.cjs):** Duplicate the Bun.build call with different entrypoint (`./src/cli/init.ts`) and naming (`[dir]/cli.[ext]`). Same error handling + rename logic.

---

### `tests/hook/entry.test.ts` (test, request-response)

**Analog:** `tests/decision/format.test.ts` — same pattern of testing a function that takes structured input and returns structured output

**Test file structure** (lines 1-30 of `tests/decision/format.test.ts`):
```typescript
import { describe, expect, test } from "bun:test";
import { formatHookOutput } from "../../src/decision/format";
import type { Decision } from "../../src/types/decision";
import type { RuleMatch } from "../../src/types/rule";
import type { Rule } from "../../src/types/rule";
import type { Severity } from "../../src/types/severity";

const mockRule = (id: string, severity: Severity = "HIGH"): Rule => ({
    id,
    category: "shell",
    severity,
    pattern: ".*",
    keywords: ["test"],
    description: `Rule ${id}`,
    suggestion: "Use safer alternative",
    platforms: ["posix"],
    builtin: true,
});

const mockMatch = (
    ruleId: string,
    text: string,
    severity: Severity = "HIGH",
): RuleMatch => ({
    rule: mockRule(ruleId, severity),
    matchedText: text,
    index: 0,
});
```

**Test assertion pattern** (lines 31-45 of `tests/decision/format.test.ts`):
```typescript
describe("formatHookOutput", () => {
    test("block decision -> exitCode 2, JSON with decision='block'", () => {
        const decision: Decision = {
            action: "block",
            severity: "CRITICAL",
            matchedRules: [mockMatch("shell.rm-recursive-root", "rm -rf /", "CRITICAL")],
            message: "Blocked: rm -rf / -- Rule shell.rm-recursive-root.",
            suggestion: "Use safer alternative",
            timestamp: "2024-01-15T10:30:00.000Z",
        };
        const result = formatHookOutput(decision);
        expect(result.exitCode).toBe(2);
        const parsed = JSON.parse(result.output);
        expect(parsed.decision).toBe("block");
    });
});
```

**Apply this pattern for:** Testing the hook entry point by providing mock `ClaudeCodeHookEvent` objects and verifying exit code + stdout JSON.

---

### `tests/cli/settings.test.ts` (test, file-I/O)

**Analog:** `tests/decision/logger.test.ts` — exact match for testing file I/O with temp directories

**Test setup pattern** (lines 1-37 of `tests/decision/logger.test.ts`):
```typescript
import { describe, expect, test, beforeEach } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync, statSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeAuditLog } from "../../src/decision/logger";
import type { Decision } from "../../src/types/decision";
import type { LoggingConfig } from "../../src/types/config";

let tempDir: string;

beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "audit-test-"));
});
```

**File I/O assertion pattern** (lines 40-60 of `tests/decision/logger.test.ts`):
```typescript
describe("writeAuditLog", () => {
    test("block action writes detailed JSONL record", () => {
        const logPath = join(tempDir, "audit.jsonl");
        const config: LoggingConfig = { enabled: true, path: logPath, maxSizeMb: 10 };
        // ... invoke function ...
        writeAuditLog(decision, config, { command: "rm -rf /", cwd: "/home/user" });
        const content = readFileSync(logPath, "utf-8").trim();
        const record = JSON.parse(content);
        expect(record.timestamp).toBe("2024-01-15T10:30:00.000Z");
    });
});
```

**Apply this pattern for:** Testing settings.json read/write/append with temp directories, verifying hook entry creation, testing deduplication logic.

---

## Shared Patterns

### Fail-Open Error Handling
**Source:** `src/decision/logger.ts` lines 74-84
**Apply to:** `src/hook/entry.ts` (global try-catch), `src/cli/settings.ts` (file read), `src/cli/deploy.ts` (file copy)
```typescript
try {
    // ... operation ...
} catch {
    // Fail-open: never block user workflow on internal error
}
```

### Cross-Platform Path Resolution
**Source:** `src/config/loader.ts` lines 126-143
**Apply to:** `src/hook/entry.ts` (cwd resolution), `src/cli/init.ts` (target path), `src/cli/settings.ts` (settings path)
```typescript
import * as os from "node:os";
import * as path from "node:path";

// Global path: os.homedir() + fixed relative path
const globalPath = path.join(os.homedir(), ".claude", "hooks", "yolo-safeguard", "hook.cjs");

// Project path: cwd + fixed relative path
const projectPath = path.join(process.cwd(), ".claude", "hooks", "yolo-safeguard", "hook.cjs");
```

### Safe JSON File Read
**Source:** `src/config/loader.ts` lines 30-41
**Apply to:** `src/cli/settings.ts` (read settings.json), `src/hook/entry.ts` (parse stdin)
```typescript
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
```

### Directory Ensure + File Write
**Source:** `src/decision/logger.ts` lines 20-25
**Apply to:** `src/cli/deploy.ts` (create hook directory + copy file)
```typescript
function ensureDirectory(filePath: string): void {
    try {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
    } catch {
        // fail-open
    }
}
```

### Test Mock Factories
**Source:** `tests/decision/format.test.ts` lines 8-28
**Apply to:** `tests/hook/entry.test.ts`, `tests/cli/settings.test.ts`
```typescript
const mockRule = (id: string, severity: Severity = "HIGH"): Rule => ({
    id,
    category: "shell",
    severity,
    pattern: ".*",
    keywords: ["test"],
    description: `Rule ${id}`,
    suggestion: "Use safer alternative",
    platforms: ["posix"],
    builtin: true,
});
```

### Test Temp Directory Setup
**Source:** `tests/decision/logger.test.ts` lines 33-37
**Apply to:** `tests/cli/settings.test.ts`, `tests/cli/init.test.ts`
```typescript
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tempDir: string;
beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "settings-test-"));
});
```

### Bun Build Pattern
**Source:** `build.ts` lines 3-11
**Apply to:** `build.ts` modification (duplicate for cli entrypoint)
```typescript
const result = await Bun.build({
    entrypoints: ["./src/index.ts"],
    outdir: "./dist",
    target: "node",
    format: "cjs",
    minify: true,
    sourcemap: "external",
    naming: "[dir]/hook.[ext]",
});
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `tests/hook/performance.test.ts` | test | benchmark | No performance/benchmark tests exist yet in the codebase. Use `bun:test` with `performance.now()` timing assertions. |
| `tests/build.test.ts` | test | batch | No build verification tests exist yet. Use `Bun.build` in test + `statSync` for size assertions. |

## Metadata

**Analog search scope:** `src/`, `tests/`, root (`build.ts`, `package.json`)
**Files scanned:** 28 source files + 11 test files
**Pattern extraction date:** 2026-06-01
