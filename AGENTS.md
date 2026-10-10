# L Driving Academy: continuity and recovery

## Identify the real project before acting

- Canonical Windows checkout: `C:\Users\Joshu\LDA-Work\LDA`.
- Expected canonical branch: `main`. GitHub: `https://github.com/LDrivingAcademy/LDA.git`.
- The root app is deployed; `lda-web/` is legacy/reference material. Follow existing [workspace guidance](docs/codex-workspace-safety.md), subject to the preservation rules below.
- The recovered baseline was `7d3c08d85619f3b302175c75e1f9bed677157bb8`. On 2026-10-10, this checkout was fast-forwarded by 104 commits to `a3aedc5fbc5ebf672f19526335fc9e3260c3403f`. These are historical checkpoints, never instructions to reset to them.
- Canonical Git/GitHub history and legitimate local changes are authoritative. Chat history, Codex configuration, caches and worktree registrations are not.

## Start with read-only verification

Run from the canonical folder, using `git --no-optional-locks` for inspection:

```powershell
Get-Location
git --no-optional-locks rev-parse --show-toplevel
git --no-optional-locks branch --show-current
git --no-optional-locks rev-parse HEAD
git --no-optional-locks status --porcelain=v2 --branch --untracked-files=all
git --no-optional-locks ls-files --others --ignored --exclude-standard --directory
git --no-optional-locks worktree list --porcelain
git --no-optional-locks log -5 --format='%H %ci %s'
git --no-optional-locks for-each-ref --format='%(refname) %(objectname)' refs/heads refs/remotes
```

Verify origin points to `LDrivingAcademy/LDA` without printing credential-bearing URLs. Read live GitHub `main` through the LDA connector or `git ls-remote origin refs/heads/main`; cached `origin/main` alone does not establish freshness. Compare ancestry and file changes, CI status and deployed release. Inspect other branches/worktrees and relevant reflogs before deciding work is absent. Neither a later timestamp nor chat recollection proves a branch is complete or canonical.

## Preserve work and secrets

- Preserve existing modifications, staged work, untracked files and ignored files. Ignored does not mean disposable. Never use blanket staging.
- A pre-existing unstaged `.gitignore` change appends `.vercel` and `.env*`. Do not edit, stage, commit, discard or overwrite it without explicit approval specific to that file. Its original working-file SHA-256 is `F53F2A1396DF69457C6DCF671C975EC4D1CE23CDF2DF7F59127E10B57433DD9D`.
- Never expose, copy into reports, print or commit secrets, credentials, tokens or `.env` contents. Do not export Codex credentials or environment files as backups.
- Require explicit authorization before reset, clean, restore/discard, deletion/moving of existing files, history rewriting, remote changes, branch/worktree changes, fetch/pull/push or recovery operations. Existing authorization within the current task counts; no blanket approval carries into future chats.
- Cleanup suggestions in other documents do not override these preservation rules.
- Codex state is replaceable only after unique work in its worktrees has been inspected and safely preserved. Never delete a worktree merely because its registration is stale.

## After Codex authentication, reinstall or configuration failure

1. Open the canonical folder in a terminal independently of Codex and perform the read-only checks above. An app login failure does not require Git recovery.
2. Inventory local changes by path; compare GitHub's actual checkpoint. Stop on unexpected folder, remote, branch or divergence and explain the discrepancy.
3. Repair/re-authenticate Codex separately. Do not relocate or rebuild the repository to repair app configuration. Never clone over an existing folder.
4. If synchronization is approved, fetch and inspect first, then fast-forward only when compatible with preserved local changes. On conflicts, stop; do not auto-stash or reset.
5. If the canonical folder is genuinely unavailable, propose recovery into a new empty folder from the verified GitHub repository. Separately account for unpushed commits and local files before declaring recovery complete.

## End-of-work checkpoint and backup

- Record full HEAD, branch, files changed, checks actually run, unresolved issues and remaining staged/unstaged/untracked state.
- Review and stage only specifically authorized non-secret paths. Verify the `.gitignore` baseline stayed unchanged. Commit/push when authorized and verify the resulting GitHub SHA and CI; local commits alone are not an off-device backup.
- GitHub stores committed/pushed source. It does not back up local changes, ignored environment files, the production database, uploaded documents or external service configuration. Arrange separately approved, encrypted backups for legitimate local data and provider-supported database/storage backups; do not claim these exist without evidence. Secret recovery belongs in the user's secure credential manager/provider controls.
- Keep durable unresolved work in this file or an existing appropriate document when authorized; avoid competing handoff documents.

## Monthly maintenance

- `.github/workflows/monthly-lda-redeploy-keepalive.yml` is the existing cloud workflow, scheduled for the first day of each month at 03:17 UTC, with manual dispatch available on `main`.
- It deploys the exact GitHub `main` commit captured when the run starts, checks the homepage and robots file, and records success/failure in `.github/keepalive/last-monthly-redeploy.txt`. It also runs when its workflow file changes on `main`. Pinning the source avoids selecting an older domain release during a concurrent Git deployment. The record commit provides repository activity even when the deploy fails. It uses the per-run `GITHUB_TOKEN`, not an additional stored personal access token. Only the checkpoint job can write repository contents.
- A maintenance record is not proof all application features work. Check the linked workflow run and individual job results. Branch protection or token policy can block record writes; never weaken protection automatically.
- Public GitHub scheduled workflows can be disabled after 60 days without repository activity. Runs can also be delayed or fail. If a checkpoint is older than 40 days, inspect the workflow state and runs, report the failure, and obtain authorization for any necessary repair. Avoid adding duplicate redeploy schedulers.
- The existing token-renewal workflow warns about Vercel credential renewal. A monthly redeploy does not extend credential expiry or guarantee indefinite free hosting. Keep the owner email and account recovery methods available.
- This chat's monthly follow-up is supplementary; local scheduled tasks require the computer and app to be available. GitHub cloud jobs do not depend on Codex being installed or signed in.
- GitHub's inactivity rule concerns scheduled workflows, not deletion of repository history. Standard hosted Actions runners are free for this public repository. Supabase Free may pause after a week of low database activity; monthly web redeploys do not guarantee database availability. No paid plan or billing changes are authorized by these instructions.

## Verification and outstanding application work

- Use the committed dependency lock with `npm ci`, then `npm run test:monitor`, `npm run typecheck` and `npm run build`. Review security advisories separately. A successful build is not an end-to-end product sign-off.
- `npm run monitor:once` and `npm run auto-guard:once` run read-only public availability checks. Their continuous versions repeat every 30 minutes while running. The guard never edits or deploys. Stress tests are deliberately refused without a separate plan.
- As of 2026-10-10, the application still requires a separate remediation/testing phase: booking cancellation lacks caller/ownership verification before administrative writes; booking/payment confirmation and authoritative server-side pricing need review; instant lessons use demo instructor data; account, payment, refund, notification and instructor journeys are not yet verified end to end. Do not exercise these issues on real users or live payments.
- The inherited `lint` command requires a proper ESLint setup; do not report it passing merely because the Next build succeeds.

References: [GitHub inactivity](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows), [runner costs](https://docs.github.com/en/actions/concepts/billing-and-usage), [Supabase pausing](https://supabase.com/docs/guides/platform/free-project-pausing).
