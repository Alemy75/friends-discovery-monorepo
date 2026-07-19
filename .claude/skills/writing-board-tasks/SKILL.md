---
name: writing-board-tasks
description: Use when creating or filing a task for the friends.ai project — turning a piece of work into an FDM task, filing a GitHub issue, adding it to the project board, or splitting a plan into board tasks. Triggers include "заведи задачу", "create a task", "new FDM", "add to the board".
---

# Writing board tasks (FDM)

## Overview

A task on this project is a **GitHub Issue** in `Alemy75/friends-discovery-monorepo`, added to the board (GitHub Projects v2, **user project #1**: https://github.com/users/Alemy75/projects/1). Its **FDM number is the issue number** — issue `#7` is referenced everywhere as `FDM-7`.

Core rule: **a task is a real issue, never a Projects "draft" item.** Only a real issue can be auto-closed by a PR's `Closes #N` and cross-linked from commits. Drafts break the link, so never file a draft when a task will have a PR.

## When to use

- Turning agreed work into a trackable task ("заведи FDM на …", "create a task for …").
- Splitting a spec/plan into board tasks before implementation.
- Before opening a PR that needs an `FDM-N` to reference (see [[creating-pull-requests]] — the PR needs the issue number this skill produces).

Not for: personal/session TODOs (use the in-session task list); tracking work that will never get a PR or board slot.

## Quick reference

| Thing | Value |
|---|---|
| Repo | `Alemy75/friends-discovery-monorepo` |
| Board | GitHub Projects v2, owner `Alemy75`, **project number 1** |
| Task = | a GitHub **Issue** (not a draft item) |
| `FDM-N` | the issue number `N` |
| Field to set | **Status** → `Todo` (or `In Progress` if starting immediately) |
| Title | imperative, concise, no `FDM-` prefix (the number is the issue #) |

## Steps

Use the **GitHub MCP** tools available in your session (capability names vary by server: "create issue", "add item to project", "update project field/status"). If the MCP isn't available, use the `gh` CLI fallback below.

1. **Write the issue** — title + body (template below).
2. **Create the issue** in `Alemy75/friends-discovery-monorepo`.
3. **Add the issue to the board** (user project #1).
4. **Set Status** — see the Status rule below.
5. **Report the issue number** — that number is the `FDM-N` the PR will carry.

## Status rule

The board's Status is a single-select field; confirm the exact option names on the
board or with `gh project field-list 1 --owner Alemy75` (typically `Todo` /
`In Progress` / `Done`). Pick by situation:

- **Filing ahead of the work** → `Todo`.
- **Picking it up now** (or filing a task for work already in progress / already
  finished but not yet merged) → `In Progress`.
- **`Done`** is set by the PR merge (`Closes #N`), **never manually at filing time.**

## Issue body template

```markdown
## Context
<1–3 sentences: why this task exists. If it comes from a spec/plan, link that
section (e.g. docs/superpowers/specs/... or docs/superpowers/plans/...).
The link is OPTIONAL — if there's no such doc, just state the motivating work.>

## Acceptance criteria
- [ ] <observable, checkable outcome>
- [ ] <...>

## Notes
<optional: constraints, dependencies on other FDM tasks, out-of-scope>
```

Keep the title a single imperative line ("Add JWT refresh-token rotation", not "FDM-8: auth stuff"). Acceptance criteria must be checkable — a reviewer should be able to tick each box from the diff or a demo.

## gh CLI fallback

Concrete commands (install/auth `gh` first: `gh auth status`). Project number is `1`, owner `Alemy75`:

```bash
# 1. create the issue → prints the URL / number
gh issue create --repo Alemy75/friends-discovery-monorepo \
  --title "Add JWT refresh-token rotation" \
  --body-file issue-body.md

# 2. add it to the board (use the issue URL from step 1)
gh project item-add 1 --owner Alemy75 \
  --url https://github.com/Alemy75/friends-discovery-monorepo/issues/<N>

# 3. set Status (find field/option IDs once, then reuse)
gh project field-list 1 --owner Alemy75            # find the Status field id + option ids
gh project item-list  1 --owner Alemy75            # find the item id for issue <N>
gh project item-edit --project-id <PROJECT_ID> --id <ITEM_ID> \
  --field-id <STATUS_FIELD_ID> --single-select-option-id <TODO_OPTION_ID>
```

`PROJECT_ID`, the Status `field-id`, and the option ids are stable — discover them
once (`gh project field-list`/`view`) and record them here so future runs skip the
lookup:

| ID | Value |
|---|---|
| `PROJECT_ID` | _(fill in on first run)_ |
| Status field id | _(fill in)_ |
| Status option ids | `Todo` = _…_, `In Progress` = _…_, `Done` = _…_ |

## Common mistakes

- **Filing a Projects draft instead of a real issue** — then `Closes #N` in a PR does nothing and the task never auto-closes. Always create a real issue.
- **Prefixing the title with `FDM-`** — redundant; `FDM-N` *is* the issue number. Keep the title clean.
- **Forgetting to add the issue to the board** — an issue not on project #1 won't show on the board.
- **Vague acceptance criteria** — "make auth work" isn't checkable. Write outcomes a reviewer can verify.
- **Not reporting the issue number** — the PR author needs `N` for `[FDM-N]` + `Closes #N`.
