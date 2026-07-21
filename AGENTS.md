# AGENTS.md

Operating rules for AI agents working in this repository. These rules are
mandatory and apply to every agent and every task.

## Rules

### 1. Every task must be tracked in FDM

If you are handed work that does **not** already have a corresponding FDM task,
create one **before** you start working on it.

- A task is a **GitHub Issue** in `Alemy75/friends-discovery-monorepo`, added to
  the board (GitHub Projects v2, user project #1). Its FDM number **is** the
  issue number (`FDM-16` = issue `#16`).
- Never file a Projects "draft" item — always create a real issue, so a PR's
  `Closes #N` can auto-close it.
- Set the task's **Status** to `In progress` when you pick it up.
- Follow the `writing-board-tasks` skill in `.claude/skills/` for the full
  workflow (issue template, board fields, status rules).

### 2. Every task ships as a pull request

When you finish the work for a task, open a **pull request** linked to its FDM
task — never merge work straight to `main`.

- One PR per FDM task; open it against `main` from a `feat/…`, `chore/…`, or
  `fix/…` branch.
- The PR **title** carries `[FDM-N]` and the **body** contains `Closes #N`, so
  merging auto-closes the issue and moves its board card to Done.
- Follow the `creating-pull-requests` skill in `.claude/skills/` for the full
  title/body template and workflow.

### 3. English only

All text and comments in the codebase must be written in **English** — code
comments, commit messages, issue and PR titles/descriptions, documentation, log
messages, and identifiers. This keeps the project consistent and reviewable by
everyone.

## Related

- `.claude/skills/writing-board-tasks/` — how to file an FDM task.
- `.claude/skills/creating-pull-requests/` — how to open a PR linked to an FDM task.
