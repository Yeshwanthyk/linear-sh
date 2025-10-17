# Ticket: Linear CLI for Agents

## Summary
Create a command-line interface that coding agents can use to interact with Linear: create tickets, update ticket details, and change ticket status.

## Goals
- Provide simple commands to create new Linear issues with title, description, and labels.
- Support updating existing Linear issues (add comments, change status, assign users, update metadata).
- Ensure the CLI works well for automated usage by coding agents (non-interactive friendly).

## Constraints & Considerations
- Must authenticate against Linear securely (prefer environment variables or config file; avoid interactive prompts where possible).
- Design for scripting: commands should be deterministic and return machine-readable output (JSON) when requested.
- Follow existing repository tooling conventions (use `uv` for Python, `ruff` for linting/formatting if applicable).
- Offer clear error handling and exit codes for automation.

## Open Questions
- Which programming language / runtime should the CLI use? (Python with `uv`? Node? Rust?)
- Do we need support for additional Linear operations (e.g., listing issues, searching)?
- Should the CLI manage auth tokens per user or rely on project-level secrets?

## References
- Linear API docs: https://developers.linear.app/docs/graphql/getting-started
