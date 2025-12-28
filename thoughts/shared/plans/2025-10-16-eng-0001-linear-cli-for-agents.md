# Linear CLI for Agents Implementation Plan

## Overview

Deliver a Bun-based TypeScript CLI named `linear` that coding agents can script against to create, view, list, start, update Linear issues, and open the relevant web/app pages while integrating with Git and GitHub tooling.

## Current State Analysis

- Repository contains only planning artifacts; no existing CLI code or package scaffolding is present (`thoughts/yesh/tickets/eng-0001-linear-cli-for-agents.md:1`).
- No configuration, build scripts, or dependency management files exist; Bun runtime is expected per stakeholder direction.
- Authentication and Linear API integration are undeveloped; agents will supply their personal API key via environment variables.

## Desired End State

- A Bun-distributed CLI (`bunx linear-sh` and optionally installed via `bun link`) that supports the agreed `linear-sh issue …` command set with deterministic exit codes and optional `--json` flag for machine-readable output.
- Shared config layer resolving environment variables and repo/user config files, plus lightweight caching for Linear metadata to reduce API calls.
- Robust API wrapper handling Linear GraphQL operations (create, update, list, view, workflow transitions) with consistent error surfaces.
- Git integration to infer current issue from branch names using Linear slugs; `linear-sh issue start` creates/checks out branches and updates Linear status.
- `linear-sh issue pr` leverages the `gh` CLI to open pull requests prefilled with issue context.
- Tests, linting, and documentation ensure agents can rely on the CLI without manual intervention.

### Key Discoveries:

- Stakeholder-provided ticket specifies core create/update requirements and automation constraints (`thoughts/yesh/tickets/eng-0001-linear-cli-for-agents.md:6`).
- Linear GraphQL API authenticates via personal API key in the `Authorization: Bearer <token>` header at `https://api.linear.app/graphql`, aligning with non-interactive usage.
- Bun and TypeScript ecosystem (e.g., `@linear/sdk`) provide official bindings suitable for rapid CLI development.

## What We're NOT Doing

- Implementing issue deletion or other resource management beyond the specified commands.
- Building multi-resource features (teams, projects, workflows) outside issue scope.
- Managing or rotating API secrets; configuration only reads user-provided tokens.
- Shipping installers/packages beyond Bun-managed distribution.

## Implementation Approach

Adopt a layered architecture: core CLI command definitions (Clipanion or Commander for Bun) delegate to a typed service layer wrapping the Linear SDK; shared utilities handle config resolution, output formatting, and Git/GitHub integrations. Ensure each command supports both human-readable text and JSON outputs, with isolated modules designed for unit testing via dependency injection and mocked Linear clients.

## Phase 1: Project Foundations & Configuration

### Overview

Scaffold the Bun TypeScript project, establish CLI entrypoint, and implement configuration loading (env, repo config, user config) plus shared utilities.

### Changes Required:

#### 1. Project Scaffolding

**File**: `package.json` (Bun-compatible) / `bunfig.toml`
**Changes**: Initialize Bun project, define `bin` entry (e.g., `./dist/index.js`), add scripts (`bun test`, `bun run lint`, `bun run build`).

```json
{
  "name": "linear-sh",
  "bin": {
    "linear": "./bin/linear.mjs"
  },
  "scripts": {
    "build": "bun build src/index.ts --outdir bin --target bun",
    "lint": "bunx biome check .",
    "test": "bun test"
  },
  "dependencies": {
    "@linear/sdk": "^<latest>",
    "clipanion": "^4.0.0",
    "zx": "^8.0.0"
  }
}
```

#### 2. Config Loader Module

**File**: `src/config.ts`
**Changes**: Implement config resolver merging env (`LINEAR_API_KEY`, optional overrides), repo-level `.linearrc.json`, user-level `~/.config/linear-sh/config.json`, and default settings (output format, default team/state).

```ts
export interface LinearConfig {
  apiKey: string;
  apiHost: string;
  output: "plain" | "json";
  defaults: {
    teamId?: string;
    assigneeId?: string;
    workflowStateId?: string;
  };
}
```

#### 3. Utility & Logging Setup

**File**: `src/utils/logger.ts`, `src/utils/output.ts`
**Changes**: Provide structured logging, standardized success/error output, and `--json` serializer ensuring consistent schema across commands.

### Success Criteria:

#### Automated Verification:

- [x] Bun project builds: `bun run build`
- [x] Lint passes: `bun run lint`
- [x] Unit tests for config loader succeed: `bun test src/config.test.ts`
- [x] Type checking passes (use `bunx tsc --noEmit`)

#### Manual Verification:

- [x] `linear --help` displays base usage and global flags (including `--json`)
- [x] Config precedence works by toggling env, repo, user settings
- [x] Missing API key yields clear actionable error message

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation from the human before proceeding to the next phase.

---

## Phase 2: Linear API Client & Data Layer

### Overview

Create a thin wrapper around the Linear SDK/GraphQL client to normalize authentication, retries, caching, and data transforms for issues, comments, workflow states, and users.

### Changes Required:

#### 1. API Client Wrapper

**File**: `src/linear/client.ts`
**Changes**: Instantiate `LinearClient` with API key/host, expose methods for issue `getIssue`, `createIssue`, `updateIssue`, `listIssues`, `createComment`, `transitionIssue` with typed responses and error translation.

```ts
export class LinearService {
  constructor(private readonly client = new LinearClient({ apiKey, baseUrl })) {}
  async getIssue(issueId: string) { /* ... */ }
}
```

#### 2. Metadata Cache

**File**: `src/linear/cache.ts`
**Changes**: Implement file-based cache under `~/.cache/linear-sh/` for workflow states/users; include TTL handling and cache invalidation CLI flag (`--no-cache`).

#### 3. Error Mapping

**File**: `src/errors.ts`
**Changes**: Define custom error types (e.g., `ConfigError`, `LinearApiError`, `GitIntegrationError`) with HTTP/status context for consistent CLI exit codes.

### Success Criteria:

#### Automated Verification:

- [x] Service layer unit tests cover happy/edge paths using mocked Linear SDK
- [x] Cache module tests validate read/write/TTL behavior
- [x] Error mapping snapshot tests ensure consistent output in plain vs JSON modes

#### Manual Verification:

- [ ] CLI can execute a dry-run command (`linear-sh issue view --json ENG-TEST`) using mocked/stubbed service (no real API key) and display structured error when API key missing
- [ ] Cache directory is created and respected when toggling `--no-cache`

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation from the human before proceeding to the next phase.

---

## Phase 3: Read Operations (`view`, `id`, `title`, `url`, `list`)

### Overview

Implement read-only commands, including branch inference, formatted output, and open-in-browser/app behaviors.

### Changes Required:

#### 1. Command Definitions

**File**: `src/commands/issue/view.ts`, `src/commands/issue/list.ts`, etc.
**Changes**: Use Clipanion command classes to register `linear issue view`, `linear issue list`, `linear issue id`, `linear issue title`, `linear issue url` with shared options (e.g., `--json`, `--state`, `--sort`).

#### 2. Git Branch Integration

**File**: `src/git/branch.ts`
**Changes**: Parse current branch (`git rev-parse --abbrev-ref HEAD`) to extract issue ID based on Linear slug patterns (`workspace-prefix/slug`), fallback to `.git/linear-sh.cache` mapping.

#### 3. Browser/App Open Handlers

**File**: `src/utils/open.ts`
**Changes**: Implement platform-aware open logic using `xdg-open`/`open`/`start`, plus support for `linear://` scheme when `-a` flag is passed.

### Success Criteria:

#### Automated Verification:

- [x] Command unit tests cover JSON/plain output formatting
- [x] Git branch parser tests confirm slug extraction for templates like `eng-1234-linear-cli` and namespaced branches
- [x] Snapshot tests for `linear issue list --json` ensure stable schema

#### Manual Verification:

- [ ] `linear-sh issue view ENG-123` prints formatted details including status, assignee, labels
- [ ] `linear-sh issue view -w ENG-123` opens default browser to issue URL
- [ ] `linear-sh issue list --state=in-progress` lists issues in table form; `--json` returns machine-readable output

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation from the human before proceeding to the next phase.

---

## Phase 4: Write Operations (`create`, `update`, `start`, `pr`)

### Overview

Add mutating commands enabling agents to create/update issues, manage branch workflows, and open GitHub PRs seeded with issue data.

### Changes Required:

#### 1. Issue Creation

**File**: `src/commands/issue/create.ts`
**Changes**: Support interactive prompts (using `enquirer`) and non-interactive flags (`-t`, `-d`, `--label`, `--assignee`, `--team`). Validate required inputs, call Linear service, and output created issue with slug.

#### 2. Issue Update

**File**: `src/commands/issue/update.ts`
**Changes**: Allow flag-based updates (`--status`, `--comment`, `--assignee`, `--title`, `--description`), ensure partial updates batch into GraphQL mutation, print updated details.

#### 3. Issue Start & Branching

**File**: `src/commands/issue/start.ts`
**Changes**: Create/switch to branch named after Linear suggested slug (e.g., `workspace/lowercase-hyphenated-title`), update issue status to “In Progress”, optionally assign current user.

#### 4. PR Creation Integration

**File**: `src/commands/issue/pr.ts`
**Changes**: Shell out to `gh pr create` with `--fill`, append issue title/description, set `--title`/`--body` including Linear link, handle `--draft` flag.

### Success Criteria:

#### Automated Verification:

- [x] Mutation commands covered by integration tests using mocked Linear service verifying payloads
- [x] Git branch creation logic tested with temporary repositories via `isomorphic-git` or shell fixtures
- [x] PR command unit tests ensure `gh` invocation is formed correctly with environment overrides

#### Manual Verification:

- [ ] `linear-sh issue create -t "Test" -d "desc" --json` returns created issue with slug/id
- [ ] `linear-sh issue update ENG-123 --status "In Progress" --comment "Starting"` posts comment and transitions issue
- [ ] `linear-sh issue start ENG-123` switches to branch and updates Linear status
- [ ] `linear-sh issue pr` on active branch opens GitHub PR draft prefilled with issue data

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation from the human before proceeding to the next phase.

---

## Phase 5: Quality, Testing & Documentation

### Overview

Finalize developer experience with comprehensive testing, documentation, and release packaging to ensure agents can adopt the CLI reliably.

### Changes Required:

#### 1. Test Suite Completion

**File**: `tests/issue/*.test.ts`
**Changes**: Add end-to-end Bun test harness hitting mocked Linear API server; include regression tests for JSON output schemas.

#### 2. Documentation & Examples

**File**: `README.md`, `docs/usage.md`
**Changes**: Document installation, configuration, command reference, automation tips, environment variable usage, and troubleshooting.

#### 3. Release & Distribution Scripts

**File**: `scripts/release.ts`
**Changes**: Provide script to bump version, update changelog, publish via `bun publish` (if desired), and create local symlink `bun link` instructions.

### Success Criteria:

#### Automated Verification:

- [x] Full test suite passes: `bun test`
- [x] Linting and formatting pass: `bun run lint`
- [x] Build artifact produced: `bun run build`
- [ ] Optional end-to-end smoke test script (`bun run e2e -- --with-api-mock`) succeeds

#### Manual Verification:

- [ ] README quick start instructions work on clean environment
- [ ] CLI successfully handles both plain text and JSON for each command
- [ ] Error messages documented and match runtime behavior
- [ ] Publishing workflow validated on a dry run (e.g., `bun publish --dry-run`)

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation from the human before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Validate config merging logic with env/repo/user combinations.
- Ensure Linear service methods map to correct GraphQL operations and handle errors gracefully.
- Cover command parsers for required flags and JSON/plain formatting output.

### Integration Tests:

- Use mocked GraphQL server (e.g., `msw`) to simulate Linear responses for create/update/list flows.
- Git branch integration tests using temporary repos to verify slug inference and branch creation.
- `gh` PR command executed in dry-run mode with stubbed `GH_TOKEN` to ensure command line arguments are correct.

### Manual Testing Steps:

1. Export `LINEAR_API_KEY` and create/list/update real issues in a sandbox workspace.
2. Run `linear-sh issue start` on a fresh repo to confirm branch creation and Linear status transition.
3. Trigger `linear-sh issue pr` to confirm PR body includes issue link and metadata.

## Performance Considerations

- Implement request batching or caching for workflow states/users to minimize repeated GraphQL calls.
- Rate-limit requests if agents execute multiple commands rapidly; consider exponential backoff on HTTP 429 responses.
- Ensure CLI startup time stays low by lazy-loading modules where practical.

## Migration Notes

- No database or schema migrations required; ensure introduction of config files includes samples and ignores sensitive data.

## References

- Original ticket: `thoughts/yesh/tickets/eng-0001-linear-cli-for-agents.md`
- Linear GraphQL Docs: `https://linear.app/developers/graphql`
- @linear/sdk package reference for TypeScript integrations
