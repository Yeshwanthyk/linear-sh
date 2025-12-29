import { Command } from "clipanion";
import { Effect } from "effect";

import { getIssue, write } from "../../services";
import { ISSUE_USAGE_CATEGORY, IssueBaseCommand } from "./base";

export class IssueIdCommand extends IssueBaseCommand {
	static override paths = [["issue", "id"]];

	static override usage = Command.Usage({
		description: "Print the Linear issue identifier",
		category: ISSUE_USAGE_CATEGORY,
		details: `
Resolve an issue reference to its canonical key—handy for scripts that need a stable identifier.

Inputs:

  - issueRef (optional): Key or ID. When omitted, we infer from the current Git branch if it contains an issue key.
  - --json: Emit \`{ identifier, id }\` for downstream tooling.

Behavior:

  - Fetches the issue metadata and prints the identifier (e.g. ENG-123) in plain mode.
  - Exits non-zero if the issue cannot be found or no API key is configured.
`,
	});

	async execute(): Promise<number> {
		const self = this;

		return this.run(
			Effect.gen(function* () {
				const issueRef = yield* self.resolveIssueRefEffect();
				const issue = yield* getIssue(issueRef);
				const identifier = issue.identifier ?? issue.id;

				if (self.json) {
					yield* write({ identifier, id: issue.id });
				} else {
					yield* write(identifier);
				}

				return 0;
			}),
		);
	}
}
