import type { Rule } from "../types/rule";

export const CONTENT_RULES: Rule[] = [
	{
		id: "content.hardcoded-secret",
		category: "content",
		severity: "HIGH",
		pattern:
			"(?:api[_-]?key|token|secret|password)\\s*[=:]\\s*['\"][^'\"]{8,}",
		keywords: ["key", "token", "secret", "password"],
		description: "Potential hardcoded credential (API key, token, or password)",
		suggestion:
			"Use environment variables or a secrets manager instead of hardcoding",
		builtin: true,
	},
	{
		id: "content.eval-usage",
		category: "content",
		severity: "HIGH",
		pattern: "\\beval\\s*\\(",
		keywords: ["eval"],
		description: "eval() executes arbitrary code — potential injection vector",
		suggestion: "Use JSON.parse for data, or a safe expression evaluator",
		builtin: true,
	},
	{
		id: "content.innerHTML",
		category: "content",
		severity: "HIGH",
		pattern: "\\.innerHTML\\s*=",
		keywords: ["innerHTML"],
		description: "Direct innerHTML assignment enables XSS attacks",
		suggestion:
			"Use textContent for text, or a sanitization library (DOMPurify) for HTML",
		builtin: true,
	},
	{
		id: "content.sql-concat",
		category: "content",
		severity: "HIGH",
		pattern: "(?:SELECT|INSERT|UPDATE|DELETE).*\\+\\s*\\w",
		keywords: ["SELECT", "INSERT", "UPDATE", "DELETE"],
		description: "SQL string concatenation enables SQL injection",
		suggestion:
			"Use parameterized queries or an ORM instead of string concatenation",
		builtin: true,
	},
	{
		id: "content.dangerouslySetInnerHTML",
		category: "content",
		severity: "HIGH",
		pattern: "dangerouslySetInnerHTML",
		keywords: ["dangerouslySetInnerHTML"],
		description: "React dangerouslySetInnerHTML bypasses XSS protection",
		suggestion:
			"Sanitize HTML with DOMPurify before passing to dangerouslySetInnerHTML",
		builtin: true,
	},
];
