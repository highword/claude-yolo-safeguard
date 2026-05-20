---
phase: 02-shell-command-analysis
plan: 02
subsystem: pipeline-nested-matcher
tags: [nested-extraction, regex-matching, filter-system, token-position, tdd]
dependency_graph:
  requires: [src/pipeline/types.ts, src/pipeline/parser.ts, src/rules/index.ts]
  provides: [src/pipeline/nested.ts, src/pipeline/matcher.ts]
  affects: [src/pipeline/index.ts]
tech_stack:
  added: []
  patterns: [pre-compiled-regex, token-position-verification, fail-open-depth-limit, shell-wrapper-detection]
key_files:
  created:
    - src/pipeline/nested.ts
    - src/pipeline/matcher.ts
    - tests/pipeline/nested.test.ts
    - tests/pipeline/matcher.test.ts
  modified: []
decisions:
  - "D-25 implemented: depth >= 10 bails with empty array (fail-open)"
  - "D-26 implemented: shell wrappers bash/sh/zsh/dash -c with /bin/* paths"
  - "D-27 implemented: interpreter detection python -c, node -e/--eval, ruby -e, perl -e"
  - "D-33/D-34 implemented: multi-word argument tokens suppress regex matches"
  - "D-36 implemented: notContains/contains post-match filter guards"
  - "D-39 implemented: isShellWrapperArg bypasses token position suppression"
  - "D-43 implemented: COMPILED_SHELL_RULES pre-compiled at module load"
  - "Case-sensitive regex: removed 'i' flag from compileRules to preserve -D vs -d distinction"
metrics:
  duration: "4m46s"
  completed: "2026-05-20T09:38:26Z"
  tasks_completed: 2
  tasks_total: 2
  test_count: 43
  test_pass: 43
  files_created: 4
  files_modified: 0
---

# Phase 2 Plan 02: Nested Extraction & Regex Matching Engine Summary

Nested command extraction for shell wrappers/interpreters/subshells plus regex matching engine with pre-compilation, filter guards, and token-position false-positive suppression.

## Task Completion

| Task | Name | Type | Commit | Status |
|------|------|------|--------|--------|
| 1 | Nested command extraction module (TDD) | auto/tdd | 7b51a0b (RED), 3d6925d (GREEN) | DONE |
| 2 | Regex matching engine with filter and token position (TDD) | auto/tdd | f882521 (RED), 1898fe4 (GREEN) | DONE |

## TDD Gate Compliance

### Task 1 (nested.ts)
- RED gate: `7b51a0b` (test commit - module not found, all tests fail)
- GREEN gate: `3d6925d` (feat commit - all 21 tests passing)
- REFACTOR gate: Not needed (implementation is clean and minimal)

### Task 2 (matcher.ts)
- RED gate: `f882521` (test commit - module not found, all tests fail)
- GREEN gate: `1898fe4` (feat commit - all 22 tests passing)
- REFACTOR gate: Not needed (implementation is clean and minimal)

## Implementation Details

### src/pipeline/nested.ts (6 exports)
- `NestedCommand` - Interface for extracted nested commands (command + source)
- `SHELL_WRAPPERS` - Set of known shell wrapper names (bash, sh, zsh, dash + paths)
- `ENV_COMMANDS` - Set of env commands (/usr/bin/env, env)
- `INTERPRETERS` - Map of interpreter names to their exec flags
- `extractNestedCommands(tokens, currentDepth?)` - Extracts shell wrappers and interpreter one-liners
- `extractSubshells(tokens)` - Extracts $(...) subshell patterns from token arrays

### src/pipeline/matcher.ts (4 exports)
- `compileRules(rules)` - Pre-compiles Rule patterns into RegExp objects (case-sensitive)
- `applyFilters(rule, segmentStr)` - Post-match filter guards (notContains/contains)
- `matchRules(segmentStr, spans, compiledRules, isShellWrapperArg?)` - Full matching with suppression
- `COMPILED_SHELL_RULES` - Pre-compiled shell-category rules (14 rules from fs/git/db/exec)

### tests/pipeline/nested.test.ts (21 tests)
- Shell wrapper detection: 5 tests (bash, sh, /bin/bash, env bash, env sh)
- Interpreter detection: 6 tests (python, python3, node -e, node --eval, ruby, perl)
- Non-nested commands: 3 tests (echo, ls, empty)
- Subshell extraction: 3 tests ($() pattern, no pattern, multi-token)
- Depth limiting: 2 tests (bail at 10, works within limit)
- Export validation: 2 tests (SHELL_WRAPPERS, INTERPRETERS)

### tests/pipeline/matcher.test.ts (22 tests)
- compileRules: 3 tests (shell rules, empty input, pattern verification)
- matchRules: 10 tests (rm -rf /, node_modules filter, force push, force-with-lease, branch -D/-d, DROP DATABASE, rm file.tmp, checkout -b, stash drop)
- applyFilters: 4 tests (notContains reject, no filters, contains reject, contains pass)
- Token position suppression: 3 tests (multi-word arg suppressed, shell wrapper bypass, command position)
- COMPILED_SHELL_RULES: 2 tests (shell-only, no content rules)

## Verification Results

- `bun test tests/pipeline/nested.test.ts` - 21/21 pass (23ms)
- `bun test tests/pipeline/matcher.test.ts` - 22/22 pass (28ms)
- `bun test` (full suite) - 107/107 pass (49ms) - no regressions
- `bun run typecheck` - clean (0 errors)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed case-insensitive "i" flag from regex compilation**
- **Found during:** Task 2 (GREEN phase)
- **Issue:** Plan specified `new RegExp(rule.pattern, "i")` but the `git branch -D` rule uses case-sensitive uppercase D to distinguish from safe lowercase -d. The "i" flag caused false positives on `git branch -d`.
- **Fix:** Compile without "i" flag — patterns are already case-correct as written; DB rules (DROP DATABASE) work because their patterns use uppercase
- **Files modified:** src/pipeline/matcher.ts
- **Commit:** 1898fe4

## Known Stubs

None - all functions are fully implemented with no placeholder logic.

## Threat Flags

None found - no new network endpoints, auth paths, or trust boundaries introduced.

## Self-Check: PASSED

- [x] src/pipeline/nested.ts exists
- [x] src/pipeline/matcher.ts exists
- [x] tests/pipeline/nested.test.ts exists
- [x] tests/pipeline/matcher.test.ts exists
- [x] Commit 7b51a0b exists (Task 1 RED)
- [x] Commit 3d6925d exists (Task 1 GREEN)
- [x] Commit f882521 exists (Task 2 RED)
- [x] Commit 1898fe4 exists (Task 2 GREEN)
