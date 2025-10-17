# Linear CLI (`linear`)

A Bun-powered TypeScript CLI that helps coding agents interact with Linear issues directly from the terminal. The tool wraps the Linear GraphQL API with automation-friendly commands, Git branch helpers, and GitHub PR integration.

## Installation

Prerequisites:

- [Bun](https://bun.sh) v1.1 or newer
- A Linear workspace with a personal API key
- Optional: the GitHub CLI (`gh`) for PR automation

Clone the repository and install dependencies:

```bash
bun install
```

Build the executable:

```bash
bun run build
```

You can run the CLI without linking via:

```bash
bunx ./bin/linear.mjs --help
```

For a global-style install during development:

```bash
bun link
linear-sh --help
```

## Configuration

The CLI loads configuration from (highest precedence first):

1. Environment variables
2. Repository-level `.linearrc.json`
3. User config `~/.config/linear-sh/config.json`

Example config file:

```json
{
  "apiKey": "lin_api_your_key",
  "defaults": {
    "teamId": "team-uuid",
    "assigneeId": "user-uuid",
    "workflowStateId": "state-uuid"
  }
}
```

Environment variables:

- `LINEAR_API_KEY` (required)
- `LINEAR_API_HOST` (optional, defaults to `https://api.linear.app/graphql`)
- `LINEAR_OUTPUT_FORMAT` (`plain` | `json`)
- `LINEAR_DEFAULT_TEAM_ID`, `LINEAR_DEFAULT_ASSIGNEE_ID`, `LINEAR_DEFAULT_WORKFLOW_STATE_ID`

## Commands

Run `linear-sh --help` for a high-level overview. Key commands:

- `linear-sh issue view [identifier]` – Show detailed issue information, optionally open in browser (`--web`) or emit JSON (`--json`).
- `linear-sh issue list` – List issues with filters (`--team`, `--state`, `--assignee`, `--limit`).
- `linear-sh issue id|title|url [identifier]` – Quick accessors useful in scripts.
- `linear-sh issue create` – Create a new issue via flags (`--title`, `--description`, `--team`, `--assignee`, `--label`). Missing fields fall back to interactive prompts when attached to a TTY.
- `linear-sh issue update <identifier>` – Update title, description, state (`--status`), labels, or assignee; optionally append a comment (`--comment`).
- `linear-sh issue start [identifier]` – Infer or create a Git branch, move the issue into an “In Progress” state, and optionally assign it to the current user.
- `linear-sh issue pr [identifier]` – Generate a GitHub pull request seeded with the issue title, identifier, and URL (requires `gh`).

Refer to [`docs/usage.md`](docs/usage.md) for a complete command reference and examples.

## Development

Common workflows:

```bash
# Formatting and linting
bun run lint

# Type checking
bun run typecheck

# Unit tests
bun test

# Build bundle
bun run build
```

### Release Flow

Use the helper script to run release checks:

```bash
bun run scripts/release.ts --dry-run
```

By default the script performs a build, runs tests, and executes `bun publish --dry-run`. Remove the flag to run the publish step for real.

## License

MIT License © 2025
