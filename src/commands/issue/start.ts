import { Command, Option } from "clipanion";
import { Effect } from "effect";

import type { CommandContext } from "../base-command";
import { IssueBaseCommand, ISSUE_USAGE_CATEGORY } from "./base";
import { normalizeOptionString, resolveAssigneeId, resolveStateId } from "./helpers";
import {
  branchExists,
  checkoutBranch,
  createBranch,
  sanitizeBranchName,
} from "../../git/branch";
import { CliContext, runCommandEffect } from "../../runtime/effect";
import type { IssueSummary } from "../../linear/client";

export class IssueStartCommand extends IssueBaseCommand {
  static paths = [["issue", "start"]];

  static usage = Command.Usage({
    description: "Start working on an issue: create branch and transition state",
    category: ISSUE_USAGE_CATEGORY,
    details: `
Kick off active work on an issue by aligning Git and Linear in one step.

Behavior:

  - Resolves the issue (defaults to branch key) and derives a branch name from the identifier/title unless \`--branch\` overrides it.
  - Creates the branch if missing, otherwise checks it out (unless \`--no-branch\` is set).
  - Transitions the issue to \`--state\` (default "In Progress") and optionally assigns it.

Inputs:

  - --state: Human name or ID; looked up within the issue's team or config.defaults.teamId.
  - --assign: Toggle to assign to the default assignee (config or flag).
  - --assignee: Explicit user to assign instead of defaults.
  - --branch: Override generated branch name.
  - --no-branch: Skip branch creation/checkout, only update issue state.

Outputs:

  - Plain mode prints the branch + identifier via "Issue started" (or "Issue updated" if --no-branch).
  - --json yields \`{ branch, issue: { id, identifier } }\` (branch omitted if --no-branch).

Failure Modes:

  - Fails if no API key, issue not found, or state/assignee cannot be resolved.
  - Git errors bubble up if branch creation or checkout fails (only if --no-branch is not set).
`,
  });

  static git = {
    branchExists,
    createBranch,
    checkoutBranch,
  };

  state = Option.String("--state", {
    description: "Workflow state to transition into",
    required: false,
  });

  assign = Option.Boolean("--assign", false, {
    description: "Assign issue to default assignee or --assignee",
  });

  assignee = Option.String("--assignee", {
    description: "Assign to specific user (ID, email, or name)",
    required: false,
  });

  branch = Option.String("--branch", {
    description: "Override branch name",
    required: false,
  });

  noBranch = Option.Boolean("--no-branch", false, {
    description: "Skip branch creation/checkout",
  });

  async execute(): Promise<number> {
    return this.withContext(async (context) => {
      const command = this;
      const program = Effect.gen(function* (_) {
        const ctx = yield* _(CliContext);
        const issueRef = command.resolveIssueRef(ctx);
        const details = yield* _(Effect.promise(() => ctx.service.getIssue(issueRef)));

        const branchName = yield* _(command.handleBranchEffect(details));
        const updates = yield* _(command.prepareUpdatesEffect(details, ctx));

        if (updates.stateId || updates.assigneeId) {
          yield* _(Effect.promise(() => ctx.service.updateIssue(details.id, updates)));
        }

        if (command.json) {
          const output: Record<string, unknown> = {
            issue: { id: details.id, identifier: details.identifier },
          };
          if (branchName) {
            output.branch = branchName;
          }
          ctx.output.write(output);
        } else {
          const message = command.noBranch === true ? "Issue updated" : "Issue started";
          const payload: Record<string, string> = { identifier: details.identifier };
          if (branchName) {
            payload.branch = branchName;
          }
          ctx.output.success(message, payload);
        }

        return 0;
      });

      return runCommandEffect(context, program);
    });
  }

  private handleBranchEffect(details: IssueSummary) {
    const command = this;
    return Effect.gen(function* (_) {
      if (command.noBranch === true) {
        return undefined;
      }

      const branchOverride = normalizeOptionString(command.branch);
      const branchName = branchOverride ?? deriveBranchName(details.identifier, details.branchName, details.title);

      yield* _(Effect.sync(() => {
        if (!IssueStartCommand.git.branchExists(branchName)) {
          IssueStartCommand.git.createBranch(branchName);
        } else {
          IssueStartCommand.git.checkoutBranch(branchName);
        }
      }));

      return branchName;
    });
  }

  private prepareUpdatesEffect(
    details: IssueSummary,
    context: CommandContext,
  ) {
    const command = this;
    const updates: { stateId?: string; assigneeId?: string } = {};

    const targetTeam = details.teamId ?? context.config.defaults.teamId;

    const effect = Effect.gen(function* (_) {
      const desiredState = normalizeOptionString(command.state) ?? "In Progress";
      const stateId = yield* _(Effect.promise(() =>
        resolveStateId(context, desiredState, targetTeam),
      ));
      if (stateId) {
        updates.stateId = stateId;
      }

      if (command.assign || command.assignee) {
        const assigneeSource = normalizeOptionString(command.assignee) ?? context.config.defaults.assigneeId;
        if (assigneeSource) {
          const assigneeId = yield* _(Effect.promise(() =>
            resolveAssigneeId(context, assigneeSource, targetTeam),
          ));
          if (assigneeId) {
            updates.assigneeId = assigneeId;
          }
        }
      }

      return updates;
    });

    return effect;
  }
}

function deriveBranchName(
  identifier: string,
  suggested?: string | null,
  title?: string,
): string {
  if (suggested) {
    return suggested;
  }

  const slug = title ? sanitizeBranchName(title) : identifier.toLowerCase();
  return `${identifier.toLowerCase()}/${slug}`;
}
