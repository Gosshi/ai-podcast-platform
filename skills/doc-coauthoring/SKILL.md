---
name: doc-coauthoring
description: Use when the user wants to draft or improve a spec, RFC, proposal, decision memo, PRD, internal write-up, or other structured documentation. Guides collaborative writing from context gathering through refinement and reader validation.
---

# Doc Co-Authoring

Adapted for Codex from Anthropic's `doc-coauthoring` skill.

Use this skill when the user is writing a substantial document and would benefit from a structured authoring workflow instead of ad hoc editing.

## Workflow

### 1. Gather Context

Establish:
- document type
- audience
- desired outcome
- constraints or template requirements
- relevant background, history, and dependencies

Encourage the user to dump context without over-structuring it first.

### 2. Build the Structure

Turn the raw context into a concrete outline.

For most technical docs, default to:
- problem
- goals / non-goals
- current state
- proposal
- tradeoffs
- rollout / operations
- open questions

If the user already has a template, follow it instead of imposing this outline.

### 3. Draft Iteratively

Work section by section:
- propose a concise structure
- draft
- tighten for clarity
- remove repetition
- make assumptions explicit

Prefer short, concrete prose over abstract filler.

### 4. Reader Test

Before calling the document done, verify:
- can a new reader understand the problem quickly?
- are key decisions justified?
- are important assumptions and risks explicit?
- is anything missing that only the author currently knows?

## Writing Standards

- Optimize for fast comprehension.
- Prefer concrete nouns, dates, owners, thresholds, and decisions.
- Distinguish facts, assumptions, and recommendations.
- If the document drives execution, include clear next steps and ownership.
- If the document compares options, state why alternatives were rejected.

## Codex Behavior

- If the user gives rough notes, transform them into structure.
- If the user gives an existing draft, critique clarity first, then rewrite.
- If the user asks for review, prioritize gaps, ambiguity, and missing decisions over copy edits.

## Output Expectation

The finished document should be easy for another engineer, PM, or stakeholder to read without additional verbal context.
