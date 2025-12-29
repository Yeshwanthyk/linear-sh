import { Command, Option } from "clipanion";
import { Effect } from "effect";

import { sanitizeBranchName } from "../../services/git";
import {
	branchExists,
	checkoutBranch,
	createBranch,
	getDefaults,
	getIssue,
	success,
	updateIssue,
	write,
	type IssueSummary,
} from "../../services";
import { ISSUE_USAGE_CATEGORY, IssueBaseCommand } from "./base";
import { normalizeOptionString, resolveAssigneeIdEffect, resolveStateIdEffect } from "./helpers";

export class IssueStartCommand extends IssueBaseCommand {
	static override paths = [["issue", "start"]];

	static override usage = Command.Usage({
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
		const self = this;

		return this.run(
			Effect.gen(function* () {
				const issueRef = yield* self.resolveIssueRefEffect();
				const details = yield* getIssue(issueRef);

				const branchName = yield* self.handleBranchEffect(details);
				const updates = yield* self.prepareUpdatesEffect(details);

				if (updates.stateId || updates.assigneeId) {
					yield* updateIssue(details.id, updates);
				}

				if (self.json) {
					const output: Record<string, unknown> = {
						issue: { id: details.id, identifier: details.identifier },
					};
					if (branchName) {
						output.branch = branchName;
					}
					yield* write(output);
				} else {
					const message = self.noBranch === true ? "Issue updated" : "Issue started";
					const payload: Record<string, string> = {
						identifier: details.identifier,
					};
					if (branchName) {
						payload.branch = branchName;
					}
					yield* success(message, payload);
				}

				return 0;
			}),
		);
	}

	private handleBranchEffect(details: IssueSummary) {
		const self = this;
		return Effect.gen(function* () {
			if (self.noBranch === true) {
				return undefined;
			}

			const branchOverride = normalizeOptionString(self.branch);
			const branchName =
				branchOverride ?? deriveBranchName(details.identifier, details.branchName, details.title);

			const exists = yield* branchExists(branchName);
			if (!exists) {
				yield* createBranch(branchName);
			} else {
				yield* checkoutBranch(branchName);
			}

			return branchName;
		});
	}

	private prepareUpdatesEffect(details: IssueSummary) {
		const self = this;
		const updates: { stateId?: string; assigneeId?: string } = {};

		return Effect.gen(function* () {
			const defaults = yield* getDefaults();
			const targetTeam = details.teamId ?? defaults.teamId;

			const desiredState = normalizeOptionString(self.state) ?? "In Progress";
			const stateId = yield* resolveStateIdEffect(desiredState, targetTeam);
			if (stateId) {
				updates.stateId = stateId;
			}

			if (self.assign || self.assignee) {
				const assigneeSource = normalizeOptionString(self.assignee) ?? defaults.assigneeId;
				if (assigneeSource) {
					const assigneeId = yield* resolveAssigneeIdEffect(assigneeSource, targetTeam);
					if (assigneeId) {
						updates.assigneeId = assigneeId;
					}
				}
			}

			return updates;
		});
	}
}

function deriveBranchName(identifier: string, suggested?: string | null, title?: string): string {
	if (suggested) {
		return suggested;
	}

	const slug = title ? sanitizeBranchName(title) : identifier.toLowerCase();
	return `${identifier.toLowerCase()}/${slug}`;
}
