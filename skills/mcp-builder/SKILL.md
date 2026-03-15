---
name: mcp-builder
description: Use when designing or implementing an MCP server, tool surface, or integration with an external API or service. Best for MCP architecture, tool design, transport decisions, and server implementation in TypeScript or Python.
---

# MCP Builder

Adapted for Codex from Anthropic's `mcp-builder` skill.

Use this skill when the task is to build an MCP server that agents can use effectively, not just to wrap an API mechanically.

## Goal

Design MCP servers that are discoverable, composable, and practical for real agent workflows.

## Workflow

### 1. Understand the External System

Before writing code, establish:
- authentication model
- key resources and operations
- pagination and filtering behavior
- rate limits
- write vs read risk
- common user workflows

### 2. Design the Tool Surface

Prefer tools that are:
- clearly named
- action-oriented
- scoped to a real task
- easy for agents to discover

Balance two patterns:
- lower-level API coverage for flexibility
- higher-level workflow tools for repeated multi-step operations

If unsure, start with strong low-level coverage and add workflow tools where repeated friction appears.

### 3. Keep Tool Contracts Tight

- Use precise input schemas.
- Make optional fields truly optional.
- Return concise, structured data.
- Paginate or limit large result sets.
- Include actionable errors with next steps.

### 4. Choose the Right Transport

- Use `stdio` for local development tools.
- Use HTTP transport for remote or shared services.
- Keep auth and configuration explicit.

### 5. Implement and Test

- Start with a thin vertical slice.
- Verify one read path and one write path end to end.
- Test invalid auth, empty results, and malformed input.
- Confirm the server is usable by an agent, not just by a human reading logs.

## Implementation Guidance

- TypeScript is usually the default choice unless the integration is clearly Python-centric.
- Name tools consistently, usually with a shared prefix.
- Avoid giant catch-all tools that multiplex many unrelated actions.
- Avoid returning raw API payloads when a smaller structured response is enough.

## Review Checklist

Before calling the server done, check:
- Can an agent find the right tool by name?
- Are descriptions specific enough to guide tool choice?
- Are dangerous actions explicit?
- Are results small enough to fit context comfortably?
- Do error messages help the next step?

## Output Expectation

A good MCP server should make the agent more capable with minimal ambiguity, not just mirror an API one endpoint at a time.
