import { Command } from "clipanion";
import { Effect } from "effect";

import { CliContext, runCommandEffect } from "../../runtime/effect";
import { ISSUE_USAGE_CATEGORY, IssueBaseCommand } from "./base";

export class IssueTitleCommand extends IssueBaseCommand {
	static paths = [["issue", "title"]];

	static usage = Command.Usage({
		description: "Print the Linear issue title",
		category: ISSUE_USAGE_CATEGORY,
		details: `
Return the human-readable title associated with an issue.

Inputs:

  - issueRef (optional): Key or ID; inferred from the current Git branch when omitted.
  - --json: Emit \`{ identifier, title }\`.

Behavior:

  - Resolves the issue and prints the title verbatim.
  - Useful for templating commit messages or summaries.

Failure Modes:

  - Errors when the issue cannot be located or access is denied.
`,
	});

	async execute(): Promise<number> {
		const self = this;
		return this.withContext(async (context) => {
			const program = Effect.gen(function* () {
				const ctx = yield* CliContext;
				const issueRef = yield* self.resolveIssueRefEffect();
				const issue = yield* Effect.promise(() => ctx.service.getIssue(issueRef));

				if (self.json) {
					ctx.output.write({
						identifier: issue.identifier,
						title: issue.title,
					});
				} else {
					ctx.output.write(issue.title);
				}

				return 0;
			});

			return runCommandEffect(context, program);
		});
	}
}
