import { Command, Option } from "clipanion";

import type { CommandContext } from "../base-command";
import { IssueBaseCommand, ISSUE_USAGE_CATEGORY } from "./base";
import { normalizeOptionString, resolveAssigneeId, resolveStateId } from "./helpers";
import {
  branchExists,
  checkoutBranch,
  createBranch,
  sanitizeBranchName,
} from "../../git/branch";

export class IssueStartCommand extends IssueBaseCommand {
  static paths = [["issue", "start"]];

  static usage = Command.Usage({
    description: "Start working on an issue: create branch and transition state",
    category: ISSUE_USAGE_CATEGORY,
    details: `
Kick off active work on an issue by aligning Git and Linear in one step.

Behavior:

  - Resolves the issue (defaults to branch key) and derives a branch name from the identifier/title unless \`--branch\` overrides it.
  - Creates the branch if missing, otherwise checks it out.
  - Transitions the issue to \`--state\` (default "In Progress") and optionally assigns it.

Inputs:

  - --state: Human name or ID; looked up within the issue's team or config.defaults.teamId.
  - --assign: Toggle to assign to the default assignee (config or flag).
  - --assignee: Explicit user to assign instead of defaults.
  - --branch: Override generated branch name.

Outputs:

  - Plain mode prints the branch + identifier via "Issue started".
  - --json yields \`{ branch, issue: { id, identifier } }\`.

Failure Modes:

  - Fails if no API key, issue not found, or state/assignee cannot be resolved.
  - Git errors bubble up if branch creation or checkout fails.
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

  async execute(): Promise<number> {
    return this.withContext(async (context) => {
      const issueRef = this.resolveIssueRef(context);
      const details = await context.service.getIssue(issueRef);

      const branchOverride = normalizeOptionString(this.branch);
      const branchName = branchOverride ?? deriveBranchName(details.identifier, details.branchName, details.title);

      if (!IssueStartCommand.git.branchExists(branchName)) {
        IssueStartCommand.git.createBranch(branchName);
      } else {
        IssueStartCommand.git.checkoutBranch(branchName);
      }

      const updates = await this.prepareUpdates(context, details.teamId ?? context.config.defaults.teamId);
      if (updates.stateId || updates.assigneeId) {
        await context.service.updateIssue(details.id, updates);
      }

      if (this.json) {
        context.output.write({ branch: branchName, issue: { id: details.id, identifier: details.identifier } });
      } else {
        context.output.success("Issue started", {
          branch: branchName,
          identifier: details.identifier,
        });
      }

      return 0;
    });
  }

  private async prepareUpdates(
    context: CommandContext,
    teamId?: string | null,
  ): Promise<{ stateId?: string; assigneeId?: string }> {
    const updates: { stateId?: string; assigneeId?: string } = {};

    const targetTeam = teamId ?? context.config.defaults.teamId;

    const desiredState = normalizeOptionString(this.state) ?? "In Progress";
    const stateId = await resolveStateId(context, desiredState, targetTeam);
    if (stateId) {
      updates.stateId = stateId;
    }

    if (this.assign || this.assignee) {
      const assigneeSource = normalizeOptionString(this.assignee) ?? context.config.defaults.assigneeId;
      if (assigneeSource) {
        const assigneeId = await resolveAssigneeId(context, assigneeSource, targetTeam);
        if (assigneeId) {
          updates.assigneeId = assigneeId;
        }
      }
    }

    return updates;
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
