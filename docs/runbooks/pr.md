# Runbook: PR Lifecycle

## Create PR
git checkout -b <branch>
git push -u origin <branch>
gh pr create --fill

## Check PR
gh pr checks <PR>
gh pr view <PR>
- `daily-generate` 変更時は `polish-script-ja` / `polish-script-en` の `job_runs.payload` に
  `lang / attempt / before_chars / after_chars / parse_ok / fallback_used / skipped_reason` が残ることを確認

## Merge PR
gh pr merge <PR> --squash --delete-branch

## Emergency Stop
Do NOT merge if:
- checks pending/fail
- spec mismatch
- secrets detected
