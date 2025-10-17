# linear-sh

`linear-sh` is a Bun-based CLI for browsing and automating Linear issues from the terminal. It provides fast issue lookups, scripted updates, git branch helpers, and GitHub PR bootstrapping in one tool.

## Quick Start

1. **Install prerequisites**
   - [Bun](https://bun.sh) v1.1 or newer
   - A Linear workspace personal API key (and optionally the GitHub CLI `gh` for PR commands)
2. **Install dependencies**
   ```bash
   bun install
   ```
3. **Configure credentials**
   - Export `LINEAR_API_KEY`, or
   - Create `~/.config/linear-sh/config.json` with:
     ```json
     {
       "apiKey": "lin_api_your_key",
       "defaults": { "teamId": "team-uuid" }
     }
     ```
4. **Run the CLI**
   ```bash
   bunx ./bin/linear.mjs --help
   ```
   To build a standalone bundle run `bun run build`; for a global-style dev install use `bun link`.

## Configure

Configuration is loaded in the following order (first match wins):

1. Environment variables
2. `.linearrc.json` in the repository
3. `~/.config/linear-sh/config.json`

Common environment variables:

- `LINEAR_API_HOST` (defaults to `https://api.linear.app/graphql`)
- `LINEAR_OUTPUT_FORMAT` (`plain` | `json`)
- `LINEAR_DEFAULT_TEAM_ID`, `LINEAR_DEFAULT_ASSIGNEE_ID`, `LINEAR_DEFAULT_WORKFLOW_STATE_ID`, `LINEAR_DEFAULT_PROJECT_ID`

## Usage

Run `linear-sh --help` for the full command tree. Popular commands:

- `linear-sh issue view [id]` — detailed issue summary, with `--json` or `--web`
- `linear-sh issue list [--team ENG --state InProgress]` — filtered summaries
- `linear-sh issue create --title "..." [--description "..."]` — new issue via flags or interactive prompts
- `linear-sh issue start [id]` — create/check out a branch and move the issue in Linear
- `linear-sh issue pr [id]` — open a GitHub pull request seeded from the issue

Additional examples live in `docs/usage.md`.

## Development

```bash
bun run lint      # Biome check
bun run format    # Biome write
bun run typecheck # TypeScript
bun test          # Bun test runner
bun run build     # Bundle CLI
```

## License

MIT © 2025
