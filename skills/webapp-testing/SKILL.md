---
name: webapp-testing
description: Use when testing or debugging a local web application through the browser. Best for UI verification, state inspection, console and network debugging, visual regression checks, and reproduction of user flows in running apps.
---

# Webapp Testing

Adapted for Codex from Anthropic's `webapp-testing` skill and rewritten for Codex browser tooling.

Use this skill when the user wants browser-level validation rather than static code review.

## Primary Tools

Prefer Codex browser tools over custom scripts when available:
- Playwright browser tools for robust interaction flows
- Chrome DevTools tools for DOM snapshots, console logs, network inspection, screenshots, and performance checks

## Workflow

### 1. Establish the App State

- Confirm the app URL or local route.
- If the app is not running, start it from the repo and note the command used.
- Identify whether the page is static, hydrated, or highly dynamic.

### 2. Reconnaissance Before Interaction

Before clicking through the flow:
- take a DOM/accessibility snapshot
- inspect visible text and controls
- check console messages if behavior looks wrong
- inspect network requests if the issue may be data-driven

Do not guess selectors before inspecting the rendered page.

### 3. Execute the Smallest Useful Flow

Reproduce the task directly:
- navigation
- form entry
- button clicks
- modal handling
- responsive checks

Keep the path short and deterministic.

### 4. Validate the Result

Depending on the task, verify:
- visible text or state changes
- URL changes
- network success/failure
- console errors
- layout integrity on narrow and wide viewports

### 5. Capture Evidence

When useful, return:
- screenshots
- console findings
- failing request details
- exact reproduction steps

## Heuristics

- For flaky UI, inspect console and network before blaming selectors.
- For layout bugs, resize to the target breakpoint and inspect the DOM snapshot before changing CSS.
- For app-router flows, verify both UI state and URL state.
- For data issues, inspect API payloads instead of only the rendered UI.

## Output Expectation

The result should leave a clear answer: reproduced or not, what was observed, and what exact UI evidence supports the conclusion.
