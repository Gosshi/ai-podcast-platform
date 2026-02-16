# Runbook: PR Lifecycle

## Create PR
git checkout -b <branch>
git push -u origin <branch>
gh pr create --fill

## Check PR
gh pr checks <PR>
gh pr view <PR>

## Merge PR
gh pr merge <PR> --squash --delete-branch

## Emergency Stop
Do NOT merge if:
- checks pending/fail
- spec mismatch
- secrets detected
