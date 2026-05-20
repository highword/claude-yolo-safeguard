---
phase: 02-shell-command-analysis
plan: 01
subsystem: pipeline-parser
tags: [shell-quote, parser, segmentation, token-classification, tdd]
dependency_graph:
  requires: [src/types/rule.ts, shell-quote]
  provides: [src/pipeline/types.ts, src/pipeline/parser.ts]
  affects: [src/pipeline/index.ts]
tech_stack:
  added: []
  patterns: [shell-quote-integration, fail-open-error-handling, segment-splitting]
key_files:
  created:
    - src/pipeline/types.ts
    - src/pipeline/parser.ts
    - tests/pipeline/parser.test.ts
  modified: []
decisions:
  - "D-29 implemented: shell-quote parse() with no env argument for POSIX-only analysis"
  - "D-30 implemented: split at &&, ||, ;, |, & operators only"
  - "T-02-01 mitigated: try/catch wrapping parseCommand with empty array return on error"
metrics:
  duration: "2m47s"
  completed: "2026-05-20T09:30:16Z"
  tasks_completed: 1
  tasks_total: 1
  test_count: 29
  test_pass: 29
  files_created: 3
  files_modified: 0
---

# Phase 2 Plan 01: Pipeline Types & POSIX Shell Parser Summary

Shell-quote integration with compound command segmentation, token position classification, and fail-open error handling for the analysis pipeline foundation.

## Task Completion

| Task | Name | Type | Commit | Status |
|------|------|------|--------|--------|
| 1 | Define pipeline types and implement parser with segment splitting (TDD) | auto/tdd | e21b639, 2802769 | DONE |

## TDD Gate Compliance

- RED gate: `e21b639` (test commit - all tests failing, module not yet created)
- GREEN gate: `2802769` (feat commit - all 29 tests passing)
- REFACTOR gate: Not needed (implementation is already clean and minimal)

## Implementation Details

### src/pipeline/types.ts (7 exports)
- `ParseEntry` - Union type matching shell-quote's output format
- `Segment` - Compound command segment with tokens + rebuilt string
- `TokenSpan` - Character offset mapping with position classification
- `CompiledRule` - Pre-compiled regex for matching performance
- `AnalysisFrame` - Recursive analysis stack frame
- `AnalysisResult` - Full pipeline output type

### src/pipeline/parser.ts (4 exported functions)
- `parseCommand(cmd)` - Wraps shell-quote parse() with fail-open try/catch
- `splitSegments(tokens)` - Splits at &&, ||, ;, |, & boundaries; preserves redirections
- `rebuildSegment(tokens)` - Reconstructs segment string from token array (handles globs, operators)
- `buildTokenSpans(tokens)` - Maps tokens to character offsets with command/flag/argument classification

### tests/pipeline/parser.test.ts (29 tests)
- parseCommand: 7 tests (simple, compound, quoted, glob, empty, malformed)
- splitSegments: 10 tests (all operator types, redirections, edge cases)
- rebuildSegment: 4 tests (simple, glob, redirection, empty)
- buildTokenSpans: 8 tests (position classification, multi-word, offsets, glob spans)

## Verification Results

- `bun test tests/pipeline/parser.test.ts` - 29/29 pass (29ms)
- `bun test` (full suite) - 64/64 pass (52ms) - no regressions
- `bun run typecheck` - clean (0 errors)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all functions are fully implemented with no placeholder logic.

## Self-Check: PASSED

- [x] src/pipeline/types.ts exists
- [x] src/pipeline/parser.ts exists
- [x] tests/pipeline/parser.test.ts exists
- [x] Commit e21b639 exists (RED)
- [x] Commit 2802769 exists (GREEN)
