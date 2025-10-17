import { Command, Option } from "clipanion";
import enquirer from "enquirer";

import type { CommandContext } from "../base-command";
import { BaseCommand } from "../base-command";
import { normalizeOptionString, normalizeOptionStringArray, resolveAssigneeId } from "./helpers";
import { ISSUE_USAGE_CATEGORY } from "./base";

export class IssueCreateCommand extends BaseCommand {
  static paths = [["issue", "create"]];

  static usage = Command.Usage({
    description: "Create a new Linear issue",
    category: ISSUE_USAGE_CATEGORY,
    details: `
Use this when you need to draft a brand-new issue without leaving the terminal.

Inputs:

  - --title / --description: Provide upfront, or omit to trigger interactive prompts (requires TTY).
  - --team: Target team ID; defaults to config.defaults.teamId and is required either via flag or config.
  - --assignee: Resolve by ID, email, or name; falls back to config.defaults.assigneeId when provided.
  - --label: Repeatable flag that accepts label IDs (values are normalised to strings).

Behavior:

  - Collects missing fields with \`enquirer\` prompts when stdin is interactive.
  - Posts a create mutation to Linear and echoes the new issue identifier and URL.

Outputs:

  - Plain mode emits a success message with key + URL.
  - --json prints \`{ issue: IssueSummary }\`.

Failure Modes:

  - Throws if no team ID can be determined.
  - Propagates Linear API errors (auth, validation, etc.).
`,
    examples: [
      ["Non-interactive creation", "linear-sh issue create --title \"Ship onboarding\" --description \"Checklist for new teammates\" --team eng"],
      ["Interactive creation with defaults", "linear-sh issue create"],
    ],
  });

  title = Option.String("-t,--title", {
    description: "Issue title",
    required: false,
  });

  description = Option.String("-d,--description", {
    description: "Issue description",
    required: false,
  });

  team = Option.String("--team", {
    description: "Team ID (defaults to config)",
    required: false,
  });

  assignee = Option.String("--assignee", {
    description: "Assign to user (ID, email, or name)",
    required: false,
  });

  labels = Option.Array("--label", {
    description: "Label IDs to attach",
    required: false,
  });

  async execute(): Promise<number> {
    return this.withContext(async (context) => {
      const input = await this.collectInput(context);
      const issue = await context.service.createIssue(input);

      if (this.json) {
        context.output.write({ issue });
      } else {
        context.output.success("Issue created", {
          identifier: issue.identifier,
          url: issue.url,
        });
      }

      return 0;
    });
  }

  private async collectInput(context: CommandContext) {
    let title = this.title;
    let description = this.description;

    const enquirerModule = enquirer as unknown as {
      prompt<T>(questions: unknown): Promise<T>;
    };

    if (!title || !description) {
      const responses = await enquirerModule.prompt<{ title: string; description: string }>([
        {
          type: "input",
          name: "title",
          message: "Issue title",
          initial: title ?? "",
          required: true,
        },
        {
          type: "input",
          name: "description",
          message: "Issue description",
          initial: description ?? "",
        },
      ]);
      title = responses.title?.trim() ?? title;
      description = responses.description?.trim() ?? description;
    }

    if (!title) {
      throw new Error("Issue title is required");
    }

    const teamId = normalizeOptionString(this.team) ?? context.config.defaults.teamId;
    if (!teamId) {
      throw new Error("Team ID is required (set via --team or config)");
    }

    const assigneeId = await resolveAssigneeId(
      context,
      normalizeOptionString(this.assignee) ?? context.config.defaults.assigneeId,
      teamId,
    );

    const labelIds = normalizeOptionStringArray(this.labels) ?? undefined;

    const projectId = context.config.defaults.projectId;

    return {
      teamId,
      title,
      description,
      assigneeId,
      labelIds,
      projectId,
    };
  }
}
