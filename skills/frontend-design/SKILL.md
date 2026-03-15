---
name: frontend-design
description: Use when building or revising web pages, UI components, or application interfaces and you want distinctive, production-grade frontend design instead of generic layouts. Best for React, Next.js, HTML/CSS, and app UX polish work.
---

# Frontend Design

Adapted for Codex from Anthropic's `frontend-design` skill and aligned to this environment.

Use this skill when the task is not just "make it work" but "make it feel intentionally designed."

## Goal

Ship working UI with a strong visual point of view:
- clear hierarchy
- memorable typography and color choices
- layouts that fit the product context
- motion used intentionally
- production-quality responsiveness

## Workflow

1. Read the surrounding app first.
2. Identify the existing design language.
3. If the product already has a clear system, preserve it.
4. If the UI is weak or generic, choose one deliberate aesthetic direction before coding.
5. Implement real code, not mockups.
6. Verify desktop and mobile behavior.

## Design Standards

### Typography

- Avoid default-feeling stacks like Inter, Roboto, Arial, or bare system fonts unless the repo already standardizes on them.
- Prefer one display face plus one quieter text face.
- Use scale, spacing, and weight contrast to create hierarchy.

### Color

- Commit to a palette with a dominant tone and a small number of accents.
- Use CSS variables or theme tokens for consistency.
- Avoid generic purple-on-white gradient aesthetics.

### Layout

- Avoid cookie-cutter centered cards unless the product language already uses them.
- Use asymmetry, density, negative space, layering, or framing when it helps the concept.
- Keep the layout legible at narrow widths without losing the visual idea.

### Motion

- Add a few meaningful transitions or reveals rather than many shallow micro-interactions.
- Prefer CSS-based motion unless the app already uses a React animation library.
- Motion should support hierarchy, not distract from it.

### Product Fit

- Match the interface to the domain.
- A finance dashboard, creative tool, and consumer landing page should not feel interchangeable.

## Implementation Rules

- Preserve the repo's component structure and design tokens when they already exist.
- When introducing new styling patterns, keep them localized and readable.
- Use comments sparingly and only for non-obvious structure.
- Do not add decorative complexity that fights usability.
- Always check mobile and tablet layouts, not just desktop.

## Codex-Specific Validation

- For static inspection, read the component and stylesheet files together.
- For browser verification, prefer the built-in browser tools available in Codex.
- If the task is substantial, verify key states after editing: default, hover/focus, active, empty, loading, and small-screen layout when relevant.

## Output Expectation

The result should feel designed by a person with taste and intent, not generated from a generic component template.
