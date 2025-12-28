import { Command } from "clipanion";
import { Effect } from "effect";

import { getIssue, write } from "../../services";
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

		return this.run(
			Effect.gen(function* () {
				const issueRef = yield* self.resolveIssueRefEffect();
				const issue = yield* getIssue(issueRef);

				if (self.json) {
					yield* write({
						identifier: issue.identifier,
						title: issue.title,
					});
				} else {
					yield* write(issue.title);
				}

				return 0;
			}),
		);
	}
}
