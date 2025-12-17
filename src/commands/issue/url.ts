import { Command } from "clipanion";
import { Effect } from "effect";

import { CliContext, runCommandEffect } from "../../runtime/effect";
import { ISSUE_USAGE_CATEGORY, IssueBaseCommand } from "./base";

export class IssueUrlCommand extends IssueBaseCommand {
	static paths = [["issue", "url"]];

	static usage = Command.Usage({
		description: "Print the Linear issue URL",
		category: ISSUE_USAGE_CATEGORY,
		details: `
Retrieve the canonical web URL for an issue—ideal for dropping into PR descriptions or chat.

Inputs:

  - issueRef (optional): Inferred from the current branch when omitted.
  - --json: Emit \`{ identifier, url }\`.

Behavior:

  - Looks up the issue and prints its \`issue.url\` field.
  - If the issue lacks a URL (e.g. insufficient permissions), the command exits with code 1 and a descriptive error.
`,
	});

	async execute(): Promise<number> {
		const self = this;
		return this.withContext(async (context) => {
			const program = Effect.gen(function* () {
				const ctx = yield* CliContext;
				const issueRef = yield* self.resolveIssueRefEffect();
				const issue = yield* Effect.promise(() =>
					ctx.service.getIssue(issueRef),
				);

				if (!issue.url) {
					ctx.output.error(new Error("Issue does not have a URL"));
					return 1;
				}

				if (self.json) {
					ctx.output.write({ identifier: issue.identifier, url: issue.url });
				} else {
					ctx.output.write(issue.url);
				}

				return 0;
			});

			return runCommandEffect(context, program);
		});
	}
}
