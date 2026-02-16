# Skills: PR / Merge Operations (ai-podcast-platform)

## Source of Truth
- Requirements/Design/Tasks live under: `.kiro/specs/**`
- `main` branch is the source of truth for specs and release history.

## Branch & PR Policy
- 1 PR = 1 concern (no mixed refactors)
- Branch naming:
  - `codex/<topic>` for agent branches
  - `fix/<topic>` for human-driven fixes
- PR title format:
  - `type: summary` (e.g., `fix: jobs orchestration ...`)
- PR must include:
  - Spec reference: `.kiro/specs/<spec>/...`
  - Acceptance checklist
  - Manual verification steps

## Merge Gate (must pass all)
1. CI checks: all PASS
2. Mergeable (no conflicts)
3. No secrets committed
4. Spec alignment
5. job_runs is insert-only

## Special Gates

### Jobs
- status='published'
- insert-only job_runs
- idempotent re-run

### DB
- published in status
- RLS MVP policy

### Stripe
- raw body verify
- duplicate no-op
- env documented

## Merge Strategy
- Default: squash
- Order: jobs → db → stripe
- Tag milestones

## Forbidden
- No force push
- No direct main commits
- No history rewrite
