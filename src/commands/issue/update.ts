import { Command, Option } from "clipanion";
import { Effect } from "effect";
import enquirer from "enquirer";

import { CliContext, runCommandEffect } from "../../runtime/effect";
import type { CommandContext } from "../base-command";
import { ISSUE_USAGE_CATEGORY, IssueBaseCommand } from "./base";
import {
	normalizeOptionString,
	normalizeOptionStringArray,
	resolveAssigneeId,
	resolveStateId,
} from "./helpers";

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
  - When no update flags are provided and stdin is interactive, prompts for a comment.
  - Executes comment creation only when the initial update succeeds.

Outputs:

  - Plain mode prints "Issue updated" with identifier and state ID.
  - --json returns \`{ issue: IssueSummary }\`.

Failure Modes:

  - Warns and exits 0 when no actionable flags are provided and no comment is entered.
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
			const command = this;
			const program = Effect.gen(function* (_) {
				const ctx = yield* _(CliContext);
				const issueRef = command.resolveIssueRef(ctx);
				const issue = yield* _(
					Effect.promise(() => ctx.service.getIssue(issueRef)),
				);

				let updateInput = yield* _(
					command.buildUpdateInputEffect(ctx, issue.id, issue.teamId),
				);

				if (!updateInput) {
					const interactive = yield* _(
						Effect.sync(() => process.stdin.isTTY === true),
					);
					if (interactive) {
						const comment = yield* _(command.promptForCommentEffect());
						if (comment) {
							updateInput = { fields: {}, comment };
						}
					}
				}

				if (!updateInput) {
					ctx.output.warn("No update options provided");
					return 0;
				}

				const hasFieldUpdates = Object.keys(updateInput.fields).length > 0;
				const updated = hasFieldUpdates
					? yield* _(
							Effect.promise(() =>
								ctx.service.updateIssue(issue.id, updateInput!.fields),
							),
						)
					: issue;

				if (updateInput.comment) {
					yield* _(
						Effect.promise(() =>
							ctx.service.createComment({
								issueId: issue.id,
								body: updateInput!.comment!,
							}),
						),
					);
				}

				if (command.json) {
					ctx.output.write({ issue: updated });
				} else {
					ctx.output.success("Issue updated", {
						identifier: updated.identifier,
						stateId: updated.stateId,
					});
				}

				return 0;
			});

			return runCommandEffect(context, program);
		});
	}

	private promptForCommentEffect() {
		const enquirerModule = enquirer as unknown as {
			prompt<T>(questions: unknown): Promise<T>;
		};

		return Effect.tryPromise({
			try: () =>
				enquirerModule
					.prompt<{ comment: string }>([
						{
							type: "input",
							name: "comment",
							message: "Add a note or comment",
							required: false,
						},
					])
					.then((responses) => responses.comment?.trim() || undefined),
			catch: () => undefined,
		});
	}

	private buildUpdateInputEffect(
		context: CommandContext,
		issueId: string,
		teamId?: string | null,
	) {
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

		return Effect.gen(
			function* (_) {
				const targetTeam = teamId ?? context.config.defaults.teamId;
				const statusValue = normalizeOptionString(this.status);
				if (statusValue) {
					const stateId = yield* _(
						Effect.promise(() =>
							resolveStateId(context, statusValue, targetTeam),
						),
					);
					fields.stateId = stateId;
				}

				const assigneeValue = normalizeOptionString(this.assignee);
				if (assigneeValue) {
					const assigneeId = yield* _(
						Effect.promise(() =>
							resolveAssigneeId(context, assigneeValue, targetTeam),
						),
					);
					fields.assigneeId = assigneeId;
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
			}.bind(this),
		);
	}
}
