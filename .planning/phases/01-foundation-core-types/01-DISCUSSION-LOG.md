# Phase 1: Foundation & Core Types - Discussion Log

**Date:** 2026-05-19
**Mode:** Interactive (default)
**Areas discussed:** 4 initial + 3 follow-up

## Area 1: Rule Definition Structure

### Question 1.1: Rule matching approach
- **Options:** Pure regex + regex pattern | Hybrid (builtin functions + user regex) | Multi-pattern declarative
- **User response:** Requested competitor research before deciding
- **Research conducted:** Analyzed 4 competitors (shellfirm, safety-net, DCG, hol-guard)
- **Findings presented:** shellfirm uses regex+filters (YAML); safety-net uses function-based; DCG uses multi-stage (memchr→regex→AST)

### Question 1.2: Final rule matching approach (post-research)
- **Options:** Declarative regex + extended Filters | Hybrid (builtin functions + user regex) | Pure function-based
- **Selected:** Declarative regex + extended Filters (three-layer pipeline variant → later simplified to two-layer)

## Area 2: Configuration Hierarchy & Merge Strategy

### Question 2.1: Trust model
- **User response:** Requested competitor research
- **Findings:** shellfirm=project only escalates; safety-net=project can override; DCG=project can allowlist but CRITICAL immutable
- **Options:** Project only escalates (shellfirm) | Project can allowlist but CRITICAL immutable (DCG) | Full override (safety-net)
- **Selected:** Project can allowlist but CRITICAL not exemptable (DCG model)

## Area 3: Hook I/O Contract

### Question 3.1: stdout output format
- **User response:** Requested competitor research
- **Findings:** safety-net=minimal (reason only); DCG=structured (reason+rule+severity+suggestion)
- **Options:** Structured (DCG) | Minimal (reason only)
- **Selected:** Structured (DCG mainstream model)

## Area 4: Project Scaffold

### Question 4.1: Directory structure
- **Options:** By responsibility + colocated tests | Flat src/ + separate tests/ | Claude decides
- **Selected:** By responsibility + colocated tests

## Area 5 (follow-up): Filter Type Set

### Question 5.1: Filter definition scope for Phase 1
- **Options:** Phase 1 minimal set + extensible interface | Phase 1 complete definition of all types
- **Selected:** Phase 1 minimal set + extensible interface

## Area 6 (follow-up): Fast Path Details

### Question 6.1: Quick Reject keyword source
- **Options:** Rules declare keywords (auto-extract) | Manual global list | Build-time auto-extract from regex
- **Selected:** Rules declare keywords (auto-extract)

### Question 6.2: Safe Patterns layer necessity
- **User response:** Requested analysis of cost/benefit
- **Analysis provided:** <0.5ms savings (1% of 50ms budget), added maintenance burden, security risk of false-safe
- **Options:** Not needed, two layers sufficient | Keep for future expansion
- **Selected:** Not needed, two layers sufficient

## Area 7 (follow-up): Severity System

### Question 7.1: Severity levels
- **Options:** 4-level (matches REQUIREMENTS.md) | 5-level (competitor mainstream)
- **Selected:** 5-level (competitor mainstream — adds INFO)

### Question 7.2: Default severity-action mapping
- **Selected:** CRITICAL=block(immutable), HIGH=block(configurable), MEDIUM=warn, LOW=log, INFO=off

---

*Discussion completed: 2026-05-19*
