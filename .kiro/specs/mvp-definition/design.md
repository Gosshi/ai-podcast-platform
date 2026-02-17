# MVP Implementation Design

Principles:
- Local-first development
- External dependencies may be mocked
- Stability over optimization

Architecture:
- Next.js for UI/API
- Supabase (local) for DB and Edge Functions
- Kiro specs as source of truth

Build System:
- CI enforces npm ci and npm run build
- tsconfig excludes supabase/functions

Testing:
- scripts/e2e-local.sh defines PASS/FAIL
- SQL verification required

Error Handling:
- Fail fast
- Log all job_runs
