import { Command, Option } from "clipanion";

import type { CommandContext } from "../base-command";
import { BaseCommand } from "../base-command";
import type { IssueSummary } from "../../linear/client";
import { normalizeOptionString, resolveAssigneeId, resolveStateId } from "./helpers";
import { ISSUE_USAGE_CATEGORY } from "./base";

export class IssueListCommand extends BaseCommand {
  static paths = [["issue", "list"]];

  static usage = Command.Usage({
    description: "List Linear issues",
    category: ISSUE_USAGE_CATEGORY,
    details: `
Pull a short, filterable list of recent Linear issues—ideal for choosing the correct issue before running another subcommand.

Filters:

  - --team: Restrict to a specific team (defaults to config.defaults.teamId when absent).
  - --state: Accepts workflow state name or ID; resolved within the selected team.
  - --assignee: Match by user ID, email, or display name.
  - --project: Filter by project ID (config option available for future Linear API support).
  - --limit: Cap the number of results (defaults to 50 when omitted).

Outputs:

  - Plain mode prints a padded table with key, state, assignee, and title.
  - --json returns \`{ issues: IssueSummary[] }\` for scripting.

Failure Modes:

  - Requires a valid Linear API key.
  - Returns "No issues found." when filters yield an empty set.
`,
    examples: [["List recent issues", "linear-sh issue list"], ["Filter by state", "linear-sh issue list --state in-progress"], ["JSON output", "linear-sh issue list --json"]],
  });

  team = Option.String("--team", {
    description: "Filter by team ID",
    required: false,
  });

  state = Option.String("--state", {
    description: "Filter by workflow state ID or name",
    required: false,
  });

  assignee = Option.String("--assignee", {
    description: "Filter by assignee ID, name, or email",
    required: false,
  });

  limit = Option.String("--limit", {
    description: "Maximum number of issues to return",
    required: false,
  });

  project = Option.String("--project", {
    description: "Filter by project ID",
    required: false,
  });

  async execute(): Promise<number> {
    return this.withContext(async (context) => {
      const teamFilter = normalizeOptionString(this.team) ?? context.config.defaults.teamId;
      const stateFilter = normalizeOptionString(this.state) ?? context.config.defaults.workflowStateId;
      const assigneeFilter = normalizeOptionString(this.assignee);
      const projectFilter = normalizeOptionString(this.project) ?? context.config.defaults.projectId;
      const limitValue = normalizeOptionString(this.limit);
      const limit = limitValue ? Number.parseInt(limitValue, 10) : undefined;

      const issues = await context.service.listIssues({
        teamId: teamFilter,
        stateId: await resolveStateId(context, stateFilter, teamFilter),
        assigneeId: await resolveAssigneeId(context, assigneeFilter, teamFilter),
        projectId: projectFilter,
        limit,
      });

      if (this.json) {
        context.output.write({ issues });
        return 0;
      }

      const summary = await this.enrichIssues(context, issues);
      context.output.write(formatIssueTable(summary));
      return 0;
    });
  }

  private async enrichIssues(
    context: CommandContext,
    issues: IssueSummary[],
  ) {
    const states = await context.service.getWorkflowStates();
    const users = await context.service.getUsers();

    const stateMap = new Map(states.map((state) => [state.id, state.name]));
    const userMap = new Map(users.map((user) => [user.id, user.name]));

    return issues.map((issue) => ({
      identifier: issue.identifier,
      title: issue.title,
      state: issue.stateId ? stateMap.get(issue.stateId) ?? issue.stateId : "",
      assignee: issue.assigneeId
        ? userMap.get(issue.assigneeId) ?? issue.assigneeId
        : "",
      updatedAt: issue.updatedAt,
    }));
  }
}

interface IssueListView {
  readonly identifier: string;
  readonly title: string;
  readonly state: string;
  readonly assignee: string;
  readonly updatedAt?: string | null;
}

function formatIssueTable(rows: IssueListView[]): string {
  if (rows.length === 0) {
    return "No issues found.";
  }

  const headers = ["Key", "State", "Assignee", "Title"];
  const data = rows.map((row) => [
    row.identifier,
    row.state ?? "",
    row.assignee ?? "",
    row.title,
  ]);

  const widths = headers.map((header, index) =>
    Math.max(
      header.length,
      ...data.map((row) => row[index]?.length ?? 0),
    ),
  );

  const formatRow = (row: string[]) =>
    row.map((value, index) => value.padEnd(widths[index])).join("  ");

  const separator = widths.map((width) => "-".repeat(width));
  const lines = [formatRow(headers), formatRow(separator)];
  for (const row of data) {
    lines.push(formatRow(row));
  }
  return lines.join("\n");
}
