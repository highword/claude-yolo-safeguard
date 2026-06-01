---
phase: 04-hook-integration-installation
plan: 02
subsystem: cli-installer
tags: [cli, installer, settings, deployment, zero-config]
dependency_graph:
  requires: []
  provides: [cli-init, settings-manipulation, hook-deployment]
  affects: [hook-entry, build-system]
tech_stack:
  added: []
  patterns: [safe-json-read, append-semantics, path-traversal-validation, backup-before-write]
key_files:
  created:
    - src/cli/settings.ts
    - src/cli/deploy.ts
    - src/cli/init.ts
    - tests/cli/settings.test.ts
    - tests/cli/init.test.ts
  modified: []
decisions:
  - "buildHookCommand accepts platform/nodePath as parameters for testability (dependency injection)"
  - "Path traversal validation checks for .claude segment presence in target path"
  - "resolveHookSource accepts baseDir parameter for testability rather than relying solely on __dirname"
metrics:
  duration: "9m 25s"
  completed: "2026-06-01T05:54:37Z"
  tasks: 2
  tests_added: 24
  files_created: 5
---

# Phase 4 Plan 2: CLI Installer (init + settings + deploy) Summary

**One-liner:** Zero-config CLI installer with settings.json append/dedup and path-traversal-safe hook deployment.

## What Was Built

### src/cli/settings.ts
- `getSettingsPath()` — resolves `~/.claude/settings.json` with `CLAUDE_CONFIG_DIR` env override
- `buildHookCommand()` — platform-aware command string (Windows: quoted forward-slash paths; Unix: simple `node <path>`)
- `registerHook()` — reads/modifies/writes settings.json with:
  - Append semantics (preserves existing hooks)
  - Deduplication (detects `yolo-safeguard` in existing commands, updates in-place)
  - Backup to `.bak` before modification
  - JSON round-trip validation before write
  - 2-space indentation + trailing newline

### src/cli/deploy.ts
- `getHookTargetPath()` — returns `~/.claude/hooks/yolo-safeguard/hook.cjs` (global) or `.claude/hooks/yolo-safeguard/hook.cjs` (project)
- `resolveHookSource()` — finds bundled hook.cjs relative to CLI location with fallback path
- `deployHook()` — copies file with directory creation, upgrade overwrite, Unix chmod, and path traversal validation

### src/cli/init.ts
- CLI entry point orchestrating the full install flow
- `--project` flag for project-local installation mode
- User-friendly console output with verification instructions
- Error handling for missing source hook.cjs

## Test Coverage

| File | Tests | Patterns |
|------|-------|----------|
| tests/cli/settings.test.ts | 14 | Temp dir, JSON file I/O, env override, platform branching |
| tests/cli/init.test.ts | 10 | Temp dir, integration flow, path validation, upgrade scenario |

Total: 24 new tests, all passing. Full suite: 220 tests, 0 failures.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test paths missing .claude segment**
- **Found during:** Task 2 GREEN phase
- **Issue:** Initial test for `deployHook` used paths without `.claude` directory segment, which correctly triggered the path traversal validation (T-04-06)
- **Fix:** Updated test paths to include `.claude` segment, matching real deployment paths
- **Files modified:** tests/cli/init.test.ts
- **Commit:** 47e2ec3

## Threat Mitigations Implemented

| Threat ID | Mitigation |
|-----------|-----------|
| T-04-05 | Backup settings.json to .bak before modification; JSON.parse round-trip validation |
| T-04-06 | validateTargetPath checks for .claude segment; rejects path traversal attempts |
| T-04-07 | Read existing settings first; never truncate without valid replacement; backup ensures recovery |

## Self-Check: PASSED

- [x] src/cli/settings.ts exists and exports getSettingsPath, buildHookCommand, registerHook
- [x] src/cli/deploy.ts exists and exports getHookTargetPath, resolveHookSource, deployHook
- [x] src/cli/init.ts exists with --project flag and orchestration flow
- [x] tests/cli/settings.test.ts exists with 14 tests
- [x] tests/cli/init.test.ts exists with 10 tests
- [x] Commit 726cb0a exists (Task 1)
- [x] Commit 47e2ec3 exists (Task 2)
- [x] Full test suite passes (220/220)
