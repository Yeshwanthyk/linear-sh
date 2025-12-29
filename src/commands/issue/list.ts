import { Command, Option } from "clipanion";
import { Effect } from "effect";

import {
	getDefaults,
	getUsers,
	getWorkflowStates,
	listIssues,
	write,
	type IssueSummary,
} from "../../services";
import { BaseCommand } from "../base-command";
import { ISSUE_USAGE_CATEGORY } from "./base";
import { normalizeOptionString, resolveAssigneeIdEffect, resolveStateIdEffect } from "./helpers";

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
		examples: [
			["List recent issues", "linear-sh issue list"],
			["Filter by state", "linear-sh issue list --state in-progress"],
			["JSON output", "linear-sh issue list --json"],
		],
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
		const self = this;

		return this.run(
			Effect.gen(function* () {
				const defaults = yield* getDefaults();

				const teamFilter = normalizeOptionString(self.team) ?? defaults.teamId;
				const stateFilter = normalizeOptionString(self.state) ?? defaults.workflowStateId;
				const assigneeFilter = normalizeOptionString(self.assignee);
				const projectFilter = normalizeOptionString(self.project) ?? defaults.projectId;
				const limitValue = normalizeOptionString(self.limit);
				const limit = limitValue ? Number.parseInt(limitValue, 10) : undefined;

				const resolvedStateId = yield* resolveStateIdEffect(stateFilter, teamFilter);
				const resolvedAssigneeId = yield* resolveAssigneeIdEffect(assigneeFilter, teamFilter);

				const issues = yield* listIssues({
					teamId: teamFilter,
					stateId: resolvedStateId,
					assigneeId: resolvedAssigneeId,
					projectId: projectFilter,
					limit,
				});

				if (self.json) {
					yield* write({ issues });
					return 0;
				}

				const summary = yield* enrichIssues(issues);
				yield* write(formatIssueTable(summary));
				return 0;
			}),
		);
	}
}

function enrichIssues(issues: IssueSummary[]) {
	return Effect.gen(function* () {
		const states = yield* getWorkflowStates();
		const users = yield* getUsers();

		const stateMap = new Map(states.map((state) => [state.id, state.name]));
		const userMap = new Map(users.map((user) => [user.id, user.name]));

		return issues.map((issue) => ({
			identifier: issue.identifier,
			title: issue.title,
			state: issue.stateId ? (stateMap.get(issue.stateId) ?? issue.stateId) : "",
			assignee: issue.assigneeId ? (userMap.get(issue.assigneeId) ?? issue.assigneeId) : "",
			updatedAt: issue.updatedAt,
		}));
	});
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
	const data = rows.map((row) => [row.identifier, row.state ?? "", row.assignee ?? "", row.title]);

	const widths = headers.map((header, index) =>
		Math.max(header.length, ...data.map((row) => row[index]?.length ?? 0)),
	);

	const formatRow = (row: string[]) =>
		row.map((value, index) => value.padEnd(widths[index] ?? 0)).join("  ");

	const separator = widths.map((width) => "-".repeat(width));
	const lines = [formatRow(headers), formatRow(separator)];
	for (const row of data) {
		lines.push(formatRow(row));
	}
	return lines.join("\n");
}
