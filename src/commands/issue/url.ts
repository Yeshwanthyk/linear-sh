import { Command } from "clipanion";
import { Effect } from "effect";

import { ValidationError } from "../../errors";
import { getIssue, write } from "../../services";
import { ISSUE_USAGE_CATEGORY, IssueBaseCommand } from "./base";

export class IssueUrlCommand extends IssueBaseCommand {
	static override paths = [["issue", "url"]];

	static override usage = Command.Usage({
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

		return this.run(
			Effect.gen(function* () {
				const issueRef = yield* self.resolveIssueRefEffect();
				const issue = yield* getIssue(issueRef);

				if (!issue.url) {
					return yield* Effect.fail(ValidationError("Issue does not have a URL", "url"));
				}

				if (self.json) {
					yield* write({ identifier: issue.identifier, url: issue.url });
				} else {
					yield* write(issue.url);
				}

				return 0;
			}),
		);
	}
}
