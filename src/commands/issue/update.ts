import { Command, Option } from "clipanion";

import type { CommandContext } from "../base-command";
import { IssueBaseCommand, ISSUE_USAGE_CATEGORY } from "./base";
import { normalizeOptionString, normalizeOptionStringArray, resolveAssigneeId, resolveStateId } from "./helpers";

export class IssueUpdateCommand extends IssueBaseCommand {
  static paths = [["issue", "update"]];

  static usage = Command.Usage({
    description: "Update a Linear issue",
    category: ISSUE_USAGE_CATEGORY,
    details: `
Batch multiple Linear mutations (status, assignee, labels, etc.) into a single call.

Inputs:

  - issueRef (optional): Defaults to the current branch issue key.
  - --status: Workflow state (name or ID) to transition into.
  - --assignee: Target user (ID, email, or name).
  - --title / --description: Replace corresponding fields.
  - --label: Repeatable flag replacing the label set by ID.
  - --comment: Adds a follow-up comment after the update succeeds.

Behavior:

  - Builds a minimal update payload; skips the mutation if no fields or comment are supplied.
  - Resolves state/assignee IDs relative to the issue's team (falling back to config defaults).
  - Executes comment creation only when the initial update succeeds.

Outputs:

  - Plain mode prints "Issue updated" with identifier and state ID.
  - --json returns \`{ issue: IssueSummary }\`.

Failure Modes:

  - Warns and exits 0 when no actionable flags are provided.
  - Surfaces Linear API validation errors (e.g. bad state/assignee).
`,
  });

  status = Option.String("--status", {
    description: "Set workflow state (name or ID)",
    required: false,
  });

  comment = Option.String("--comment", {
    description: "Add a comment after updating",
    required: false,
  });

  assignee = Option.String("--assignee", {
    description: "Assign to user (ID, email, or name)",
    required: false,
  });

  titleUpdate = Option.String("--title", {
    description: "Update issue title",
    required: false,
  });

  descriptionUpdate = Option.String("--description", {
    description: "Update issue description",
    required: false,
  });

  labels = Option.Array("--label", {
    description: "Replace labels with provided IDs",
    required: false,
  });

  async execute(): Promise<number> {
    return this.withContext(async (context) => {
      const issueRef = this.resolveIssueRef(context);
      const issue = await context.service.getIssue(issueRef);

      const updateInput = await this.buildUpdateInput(context, issue.id, issue.teamId);

      if (!updateInput) {
        context.output.warn("No update options provided");
        return 0;
      }

      const updated = await context.service.updateIssue(issue.id, updateInput.fields);

      if (updateInput.comment) {
        await context.service.createComment({
          issueId: issue.id,
          body: updateInput.comment,
        });
      }

      if (this.json) {
        context.output.write({ issue: updated });
      } else {
        context.output.success("Issue updated", {
          identifier: updated.identifier,
          stateId: updated.stateId,
        });
      }

      return 0;
    });
  }

  private async buildUpdateInput(
    context: CommandContext,
    issueId: string,
    teamId?: string | null,
  ): Promise<{ fields: Record<string, unknown>; comment?: string } | undefined> {
    const fields: Record<string, unknown> = {};

    const titleValue = normalizeOptionString(this.titleUpdate);
    if (titleValue) {
      fields.title = this.titleUpdate;
    }

    if (this.descriptionUpdate !== undefined) {
      fields.description = this.descriptionUpdate;
    }

    const labelIds = normalizeOptionStringArray(this.labels);
    if (labelIds) {
      fields.labelIds = labelIds;
    }

    const statusValue = normalizeOptionString(this.status);
    if (statusValue) {
      const stateId = await resolveStateId(
        context,
        statusValue,
        teamId ?? context.config.defaults.teamId,
      );
      fields.stateId = stateId;
    }

    const assigneeValue = normalizeOptionString(this.assignee);
    if (assigneeValue) {
      fields.assigneeId = await resolveAssigneeId(
        context,
        assigneeValue,
        teamId ?? context.config.defaults.teamId,
      );
    }

    const hasChanges = Object.keys(fields).length > 0;
    const comment = this.comment;

    if (!hasChanges && !comment) {
      return undefined;
    }

    return {
      fields,
      comment,
    };
  }
}
