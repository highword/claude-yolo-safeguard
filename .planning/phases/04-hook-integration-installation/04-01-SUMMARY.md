---
phase: "04"
plan: "01"
subsystem: "hook-integration"
tags: [hook, entry-point, structured-output, build, fail-open]
dependency_graph:
  requires: [pipeline, decision-engine, config-loader, audit-logger]
  provides: [hook-entry-point, structured-hook-output, dual-bundle-build]
  affects: [format.ts, hook.ts, build.ts]
tech_stack:
  added: []
  patterns: [synchronous-stdin-read, hookSpecificOutput-protocol, fail-open-try-catch, dual-entrypoint-bundle]
key_files:
  created:
    - src/hook/entry.ts
    - src/hook/process.ts
    - src/cli/init.ts
    - tests/hook/entry.test.ts
  modified:
    - src/decision/format.ts
    - src/types/hook.ts
    - tests/decision/format.test.ts
    - build.ts
decisions:
  - "Use StructuredHookOutput with hookSpecificOutput.permissionDecision for Claude Code protocol"
  - "Extract processHookEvent into separate process.ts for testability"
  - "CLI stub in src/cli/init.ts placeholder for plan 04-02"
metrics:
  duration: "10m 9s"
  completed: "2026-06-01"
  tasks_completed: 3
  tasks_total: 3
  tests_added: 17
  tests_total: 204
  files_created: 4
  files_modified: 4
---

# Phase 4 Plan 1: Hook Entry Point & Output Format Summary

**One-liner:** Hook entry point reading stdin synchronously, routing Bash-only to analysis pipeline, outputting structured hookSpecificOutput JSON with fail-open error handling and dual-bundle build.

## What Was Built

### Task 1: Structured hookSpecificOutput Format
Rewrote `src/decision/format.ts` to emit the Claude Code structured hook protocol format instead of the legacy `{decision, reason, rule}` shape:
- Block: `{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny"}, systemMessage: "..."}` + exit 2
- Warn: `{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "allow", additionalContext: "..."}}` + exit 0
- Log/Off/Empty: no output + exit 0

Added `StructuredHookOutput` interface to `src/types/hook.ts`.

### Task 2: Hook Entry Point
Created the runtime entry point that Claude Code spawns as a child process:
- `src/hook/entry.ts`: Thin wrapper reading stdin via `fs.readFileSync(0, "utf8")`, calling `processHookEvent`, writing stdout, exiting
- `src/hook/process.ts`: Exported `processHookEvent(raw)` containing the full pipeline: parse JSON -> route by tool_name -> analyzeCommand -> applyAllowList -> makeDecision -> writeAuditLog -> formatHookOutput
- Only Bash tool gets full analysis (D-65); Write/Edit immediately return exit 0
- Global try-catch ensures fail-open on any error (D-66)

### Task 3: Dual-Entrypoint Build
Updated `build.ts` to produce two separate bundles:
- `dist/hook.cjs` (18KB) — runtime hook invoked by Claude Code
- `dist/cli.cjs` (134B) — stub CLI installer for plan 04-02

Created `src/cli/init.ts` stub placeholder.

## Test Results

- 204 tests passing across 12 files (0 failures)
- 17 new tests added (9 format tests rewritten + 8 entry tests)
- Build produces both bundles successfully

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

| File | Line | Stub | Reason |
|------|------|------|--------|
| src/cli/init.ts | 2 | `console.log("...not yet implemented")` | Placeholder for plan 04-02 CLI installer |

## Threat Surface Scan

No new threat surfaces beyond what was documented in the plan's threat model. All stdin parsing is inside try-catch (T-04-01, T-04-02 mitigated). Output is constructed from trusted internal data (T-04-03 accepted).

## Self-Check: PASSED

- [x] src/hook/entry.ts exists
- [x] src/hook/process.ts exists
- [x] src/cli/init.ts exists
- [x] tests/hook/entry.test.ts exists
- [x] Commit b1c5992 exists (Task 1)
- [x] Commit 2f4fae9 exists (Task 2)
- [x] Commit e3065bd exists (Task 3)
- [x] dist/hook.cjs exists after build
- [x] dist/cli.cjs exists after build
- [x] All 204 tests pass
