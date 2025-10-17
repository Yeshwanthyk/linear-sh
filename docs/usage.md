# Usage Guide

## Global Flags

- `--json` – Emit machine-readable JSON where supported.
- `--no-cache` – Disable metadata caching (workflow states, users) for the command.

## Configuration Quick Reference

- Drop your Linear credentials into `~/.config/linear-sh/config.json`. For testing, you can use:

  ```json
  {
    "apiKey": "lin_api_1bmEVZGXcNwEptAv9KbZlzc6P5soX43xFQNFKt3e",
    "defaults": {
      "teamId": "bfdd5200-c3bb-4b68-b75d-9943a66c15b6",
      "projectId": "09f67dce-5202-45c8-b8f2-a474b114a27e",
      "workflowStateId": "fefb35cc-3eaf-44e9-a81c-74c8fb548884"
    }
  }
  ```

- Inside Linear, press `⌘K` / `Ctrl+K`, search for `Dev: Copy model UUID…`, and select the entity to copy its UUID for use as a default team, project, or workflow-state ID.

## Commands

### `linear-sh issue view [identifier]`

Display issue details. If no identifier is provided the CLI attempts to infer one from the current Git branch.

Options:

- `--json` – Output structured JSON.
- `--web, -w` – Open the issue in the default browser after printing details.

### `linear-sh issue list`

List issues with optional filters.

Options:

- `--team <team-id>` – Restrict to a team.
- `--state <name|id>` – Filter by workflow state (matches by name or ID).
- `--assignee <name|email|id>` – Only show issues assigned to the given user.
- `--project <project-id>` – Filter by project ID (config option available for future use, project filtering not yet supported by Linear API).
- `--limit <number>` – Number of issues to fetch (defaults to 50).
- `--json` – JSON output.

### `linear-sh issue id|title|url [identifier]`

Convenience commands to print a singular value. Helpful when composing shell pipelines:

```bash
ISSUE=$(linear-sh issue id)
gh pr view "$ISSUE"
```

### `linear-sh issue create`

Create a new issue. Missing required fields fallback to interactive prompts when available.

Options:

- `--title, -t <text>` – Issue title (required unless provided via prompt).
- `--description, -d <text>` – Markdown description.
- `--team <team-id>` – Team to create the issue in (defaults to config).
- `--assignee <name|email|id>` – Assign issue on creation.
- `--label <label-id>` – Apply label(s). Flag can be repeated.

### `linear-sh issue update <identifier>`

Update issue metadata.

Options:

- `--title <text>` – Replace title.
- `--description <text>` – Replace description.
- `--status <name|id>` – Move to a workflow state.
- `--assignee <name|email|id>` – Reassign issue.
- `--label <label-id>` – Replace labels with the provided set.
- `--comment <text>` – Append a comment after applying updates.

### `linear-sh issue start [identifier]`

Create/switch branches and transition the issue into an active state.

Behaviour:

1. Resolves the issue (argument or inferred from branch).
2. Determines a branch name using the Linear `branchName` suggestion or falls back to `identifier/title` slug.
3. Creates and checks out the branch if it does not exist.
4. Transitions the issue to `--state` (defaults to “In Progress”).
5. If `--assign` is provided, assigns the issue to the configured or explicit user.

Options:

- `--state <name|id>` – Override the target workflow state.
- `--assign` – Assign the issue to the configured default (or `--assignee`).
- `--assignee <name|email|id>` – Explicit assignee when `--assign` is set.
- `--branch <branch-name>` – Force a specific branch name.

### `linear-sh issue pr [identifier]`

Open a GitHub pull request with Linear context.

Requirements: GitHub CLI (`gh`) configured for the repository.

Options:

- `--draft` – Create the PR as a draft.

Generated PR title: `[ISSUE-KEY] Issue title`

Generated body:

```
Issue Title

https://linear.app/...
```

## Caching

Workflow state and user lookups are cached under `~/.cache/linear-sh/` for five minutes. Disable caching per command with `--no-cache` or globally by removing the cache directory.

## Git Integration

`linear-sh issue start` uses the following heuristics to infer issue identifiers from Git branches:

- Uppercase identifier patterns like `ENG-1234` anywhere in the branch name.
- Lowercase slugs such as `eng-1234-feature` (converted to uppercase).

Branch names are sanitized using lowercase alphanumerics, `/`, and `-`.

## Error Handling

All commands output actionable error messages. When using `--json`, errors follow the structure:

```json
{
  "status": "error",
  "error": {
    "name": "LinearApiError",
    "message": "...",
    "code": "LINEAR_API_ERROR"
  }
}
```
