---
title: "Multi-Platform Expansion"
trigger_condition: "When Claude Code MVP reaches stable release (v1.0) with positive user feedback"
planted_date: 2026-05-18
---

# Seed: Expand yolo-safeguard to Other AI Platforms

## Trigger Conditions

Activate this when ANY of:
- MVP (Claude Code plugin) reaches v1.0 stable
- Users request support for other platforms in GitHub issues
- A competitor fills the gap on other platforms first

## Context from Exploration

All major AI coding tools have hook systems that support third-party interception:

| Platform | Hook Point | Protocol | Integration Effort |
|----------|------------|----------|-------------------|
| Gemini CLI | BeforeTool | JSON deny response | Low (similar to Claude) |
| Codex CLI | PreToolUse | JSON permissionDecision | Low (similar to Claude) |
| Cursor | beforeShellExecution | JSON allow/deny/ask | Medium (richer protocol) |
| Windsurf | pre_run_command | Exit code 2 = block | Low (simplest) |

## Architecture Requirement

Core analysis engine must be platform-agnostic from day 1:
- Input: command string + context (cwd, tool_name, file_content)
- Output: { decision: allow/warn/ask/deny, reason, suggestion }
- Platform adapters: thin wrappers that translate hook protocols

## Priority Order for Expansion

1. Gemini CLI (most similar hook protocol to Claude Code)
2. Codex CLI (similar protocol, growing user base)
3. Cursor (largest IDE user base, richer integration)
4. Windsurf (simplest protocol, smaller market)

## Reference

- claude-code-safety-net already supports 5 platforms — proves multi-platform is viable
- Each platform adapter is typically <200 lines of code
