import { Command, Option } from "clipanion";
import { Effect } from "effect";
import enquirer from "enquirer";
import * as tty from "node:tty";

import { ValidationError } from "../../errors";
import { createIssue, getDefaults, success, write } from "../../services";
import { BaseCommand } from "../base-command";
import { ISSUE_USAGE_CATEGORY } from "./base";
import {
	normalizeOptionString,
	normalizeOptionStringArray,
	resolveAssigneeIdEffect,
} from "./helpers";

function isInteractive(): boolean {
	return tty.isatty(0) && tty.isatty(1);
}

export class IssueCreateCommand extends BaseCommand {
	static override paths = [["issue", "create"]];

	static override usage = Command.Usage({
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
			[
				"Non-interactive creation",
				'linear-sh issue create --title "Ship onboarding" --description "Checklist for new teammates" --team eng',
			],
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
		const self = this;

		return this.run(
			Effect.gen(function* () {
				const issueInput = yield* self.collectInputEffect();
				const issue = yield* createIssue(issueInput);

				if (self.json) {
					yield* write({ issue });
				} else {
					yield* success("Issue created", {
						identifier: issue.identifier,
						url: issue.url,
					});
				}

				return 0;
			}),
		);
	}

	private collectInputEffect() {
		const self = this;
		return Effect.gen(function* () {
			const defaults = yield* getDefaults();

			let title = self.title;
			let description = self.description;

			const enquirerModule = enquirer as unknown as {
				prompt<T>(questions: unknown): Promise<T>;
			};

			if (!title || !description) {
				if (!isInteractive()) {
					return yield* Effect.fail(
						ValidationError(
							"Cannot prompt for input in non-interactive mode. Provide --title and --description flags.",
							"title",
						),
					);
				}
				const responses = yield* Effect.promise(() =>
					enquirerModule.prompt<{ title: string; description: string }>([
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
					]),
				);
				title = responses.title?.trim() ?? title;
				description = responses.description?.trim() ?? description;
			}

			if (!title) {
				return yield* Effect.fail(ValidationError("Issue title is required", "title"));
			}

			const teamId = normalizeOptionString(self.team) ?? defaults.teamId;
			if (!teamId) {
				return yield* Effect.fail(
					ValidationError("Team ID is required (set via --team or config)", "teamId"),
				);
			}

			const assigneeId = yield* resolveAssigneeIdEffect(
				normalizeOptionString(self.assignee) ?? defaults.assigneeId,
				teamId,
			);

			const labelIds = normalizeOptionStringArray(self.labels) ?? undefined;
			const explicitTeamId = normalizeOptionString(self.team);
			const projectId =
				explicitTeamId && explicitTeamId !== defaults.teamId ? undefined : defaults.projectId;

			return {
				teamId,
				title,
				description,
				assigneeId,
				labelIds,
				projectId,
			};
		});
	}
}
