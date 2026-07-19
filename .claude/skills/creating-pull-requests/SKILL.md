---
name: creating-pull-requests
description: Use when opening a pull request in friends-discovery-monorepo — creating a PR, writing its title and body, or linking it to an FDM board task. Triggers include "открой PR", "create a pull request", "make a PR", "raise a PR for this branch".
---

# Creating pull requests (friends.ai)

## Overview

Every PR in `Alemy75/friends-discovery-monorepo` is tied to an **FDM task** (a GitHub issue — see [[writing-board-tasks]]) and follows a fixed title and body shape so the board and history stay linked.

Core rule: the PR **title carries `[FDM-N]`** and the **body contains `Closes #N`**, where `N` is the linked issue number. `Closes #N` auto-closes the issue and moves its board card to Done on merge. No FDM task yet? Create one first with [[writing-board-tasks]] — the PR needs its number.

## When to use

- Opening a PR for a finished branch.
- Writing/normalizing a PR title or body for this repo.
- After finishing a task's implementation and integrating it (this is the integration step of a development branch).

Not for: pushing a branch without a PR; PRs in other repos (these conventions are friends.ai-specific).

## Quick reference

| Part | Convention |
|---|---|
| Base branch | `main` |
| Branch name | `feat/…`, `chore/…`, `fix/…` (kebab-case) |
| Title | `[FDM-<N>] <imperative summary>` (e.g. `[FDM-8] Add JWT refresh-token rotation`) |
| Link | `Closes #<N>` on its own line in the body (auto-closes issue + moves board to Done) |
| Body sections | `## Summary`, `## Testing`, `## Deferred` (optional) |
| Footer | Claude Code attribution footer |

## Steps

Use the **GitHub MCP** tools available in your session ("create pull request"). If the MCP isn't available, use the `gh` CLI fallback below.

1. **Confirm the FDM task exists.** You need the issue number `N`. If there's no task, create it first via [[writing-board-tasks]].
2. **Verify the branch is pushed** and green (tests/CI pass locally — don't open a PR on red).
3. **Open the PR against `main`** with the `[FDM-N]` title and the body template below (must include `Closes #N`).
4. **Confirm the board moved.** On PR open/merge the project workflow should move `FDM-N`'s Status; if the board isn't automated, set it (see [[writing-board-tasks]] Status step).

## PR body template

```markdown
## Summary
<what changed and why, in a few lines>

## Testing
<commands run + result, e.g. "unit 5/5, e2e 3/3 green locally; CI runs on this PR">

## Deferred
<optional: follow-ups intentionally out of scope>

Closes #<N>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Omit the `## Deferred` section entirely when there's nothing deferred (don't leave a "None" placeholder). `## Summary` and `## Testing` are always present; `Closes #<N>` is always the last content line before the footer.

## gh CLI fallback

```bash
git push -u origin <branch>
gh pr create --repo Alemy75/friends-discovery-monorepo \
  --base main --head <branch> \
  --title "[FDM-<N>] <imperative summary>" \
  --body-file pr-body.md      # pr-body.md must contain the "Closes #<N>" line
```

## Common mistakes

- **Missing `Closes #N`** — the issue won't auto-close and the board card won't move. Always include it, on its own line.
- **Wrong or guessed `N`** — the title says `[FDM-8]` but the body closes `#7`. Both must be the same real issue number.
- **`FDM-` prefix in the wrong place** — it goes in the *title* (`[FDM-N]`); the body uses the raw `Closes #N` (GitHub only understands `#N`, not `FDM-N`).
- **Opening against the wrong base** — always `main`.
- **PR on red** — don't open with failing tests/CI; fix or mark draft.
- **One giant PR for many FDM tasks** — one PR ↔ one FDM task. Split unrelated work.
