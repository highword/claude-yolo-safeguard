---
title: "yolo-safeguard Exploration & Competitive Analysis"
date: 2026-05-18
context: Initial idea exploration for AI agent safety guardrail project
---

# yolo-safeguard Exploration Notes

## Core Concept

**Project:** yolo-safeguard
**Tagline:** YOLO without fear. Safe for efficiency.
**Positioning:** A universal, lightweight, zero-config AI agent safety guardrail that enables developers to confidently use YOLO/full-auto modes by intelligently intercepting only truly dangerous operations.

## Problem Statement

Developers face a binary choice:
- **Safe mode** = constant permission prompts = low efficiency
- **YOLO mode** = no safety net = risk of catastrophic operations

yolo-safeguard breaks this by providing invisible protection that only surfaces when real danger is detected.

## Target Users

1. Developers already using YOLO mode but feeling uneasy
2. Developers who want YOLO efficiency but are afraid to enable it

## Design Principles

- Zero-config: works immediately after install with sane defaults
- Lightweight: core analysis <50ms, no perceptible latency
- Graduated response: CRITICAL/HIGH/MEDIUM/LOW severity levels
- Full coverage: not just Bash, also Write/Edit/MCP tools + code content
- MVP on Claude Code, architecture supports multi-platform expansion

## Coverage Scope (Priority Order)

| Priority | Scope | Description |
|----------|-------|-------------|
| P0 | Shell command interception | Dangerous rm, git operations, DROP DATABASE etc. |
| P0 | Code content security | XSS, SQL injection, hardcoded secrets, eval, unsafe crypto |
| P0 | Full tool coverage | Hook Write/Edit/MCP, not just Bash |
| P1 | Graduated response system | CRITICAL=hard block, HIGH=confirm, MEDIUM=warn, LOW=log |
| P1 | Windows native support | PowerShell/cmd syntax understanding |
| P2 | Smart false-positive reduction | Context-aware, distinguish "execute" vs "mention" |
| P2 | Flexible allow-list/bypass | User-defined exceptions for specific scenarios |
| P2 | Network security | Detect data exfiltration, malicious downloads |

## Default Strategy: Graduated Response

- **CRITICAL** -> Hard block, requires human confirmation (irreversible destructive ops)
- **HIGH** -> Block + suggest safe alternative, confirm to proceed
- **MEDIUM** -> Warning but no block, logged
- **LOW** -> Silent log, viewable in reports

Fully configurable: users can tighten all levels to hard-block if desired.

## Competitive Landscape

### Primary Competitor: claude-code-safety-net (1,342 stars)

**What it does well:**
- Zero-config install (3 commands)
- Semantic command analysis (not simple regex)
- Recursive shell wrapper detection (10 layers deep)
- Multi-platform (Claude Code, Codex, Gemini, OpenCode, Copilot)
- Minimal dependencies (1 runtime dep: shell-quote)

**What it does NOT do (our opportunity):**
- No code content security (XSS, SQLi, secrets = completely blind)
- Only hooks Bash tool (Write/Edit/MCP = unprotected)
- No network security
- Hard block only (no graduated response)
- High false positive rate (string literals trigger blocks)
- No allow-list mechanism
- Weak Windows support (POSIX shell parser)
- No LLM-based contextual judgment

### Other Competitors

| Project | Stars | Gap vs us |
|---------|-------|-----------|
| shellfirm | 906 | Shell-only, no code content |
| hol-guard | 319 | Plugin scanner, not command guard |
| sh-guard | 18 | AST analysis but tiny community |

### Platform Safety Mechanisms

| Platform | YOLO Mode | Hook Point | Our Integration |
|----------|-----------|------------|-----------------|
| Claude Code | --dangerously-skip-permissions | PreToolUse (exit 2) | MVP target |
| Gemini CLI | --yolo | BeforeTool (JSON deny) | Phase 2 |
| Codex CLI | --full-auto | PreToolUse (JSON deny) | Phase 2 |
| Cursor | "Run Everything" | beforeShellExecution (JSON) | Phase 3 |
| Windsurf | "Turbo" | pre_run_command (exit 2) | Phase 3 |

## Claude Code security-guidance Plugin Analysis

Official plugin detects 9 patterns (command injection, XSS, eval, pickle, etc.) but:
- Only checks Write/Edit content (not Bash commands)
- One-time warning per session (second attempt passes through)
- Fixed 9 patterns, not extensible
- Can be disabled with a single env var
- No SQL injection, no secrets detection, no network security

## Key Technical Decisions (TBD)

- Language: TypeScript (match ecosystem) vs Rust (performance) vs Go (cross-platform binary)
- Detection: Rule-based core + optional LLM for edge cases?
- Distribution: Claude Code plugin + standalone CLI?
- State: Stateless per-command or session-aware?

## Naming

**Final name:** yolo-safeguard
**Rejected alternatives:** claude-safe-keeper, yolo-safe-mode, yolo-safe-booster, yolo-guard
**Reason:** No platform prefix (universal), combines "yolo" (searchable) + "safeguard" (real English word, professional)
