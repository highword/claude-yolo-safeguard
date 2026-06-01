---
phase: 5
slug: code-content-security
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-01
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bun test (built-in) |
| **Config file** | bunfig.toml (existing) |
| **Quick run command** | `bun test --filter content` |
| **Full suite command** | `bun test` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test --filter content`
- **After every plan wave:** Run `bun test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | CODE-01 | T-5-01 | Hardcoded secrets detected via pattern + entropy | unit | `bun test tests/content/secrets.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | CODE-02 | T-5-02 | SQL injection patterns detected | unit | `bun test tests/content/sql-injection.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | CODE-03 | T-5-03 | XSS patterns detected | unit | `bun test tests/content/xss.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-04 | 01 | 1 | CODE-04 | T-5-04 | Dangerous function usage detected | unit | `bun test tests/content/dangerous-functions.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-05 | 01 | 1 | CODE-05 | T-5-05 | Insecure crypto detected | unit | `bun test tests/content/insecure-crypto.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | CODE-06 | — | Write/Edit tools routed through scanner | integration | `bun test tests/hook/content-hook.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 2 | CODE-01 | — | Path-based severity adjustment works | unit | `bun test tests/content/path-adjustment.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-03 | 02 | 2 | CODE-01 | — | Inline ignore markers respected | unit | `bun test tests/content/ignore-marker.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/content/secrets.test.ts` — stubs for CODE-01 (secret detection)
- [ ] `tests/content/sql-injection.test.ts` — stubs for CODE-02
- [ ] `tests/content/xss.test.ts` — stubs for CODE-03
- [ ] `tests/content/dangerous-functions.test.ts` — stubs for CODE-04
- [ ] `tests/content/insecure-crypto.test.ts` — stubs for CODE-05
- [ ] `tests/hook/content-hook.test.ts` — stubs for CODE-06
- [ ] `tests/content/path-adjustment.test.ts` — stubs for false-positive reduction
- [ ] `tests/content/ignore-marker.test.ts` — stubs for inline ignore

*Existing infrastructure covers test framework — only new test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Bundle size remains <100KB | INST constraint | Build output size varies | `bun run build && ls -la dist/hook.cjs` |
| Performance <50ms on typical files | PERF constraint | Microbenchmark variance | `bun test tests/performance/` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
