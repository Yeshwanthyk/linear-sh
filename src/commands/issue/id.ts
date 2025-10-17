import { Command } from "clipanion";
import { Effect } from "effect";

import { IssueBaseCommand, ISSUE_USAGE_CATEGORY } from "./base";
import { CliContext, runCommandEffect } from "../../runtime/effect";

export class IssueIdCommand extends IssueBaseCommand {
  static paths = [["issue", "id"]];

  static usage = Command.Usage({
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
    return this.withContext(async (context) => {
      const program = Effect.gen(function* (_) {
        const ctx = yield* _(CliContext);
        const issueRef = yield* _(this.resolveIssueRefEffect());
        const issue = yield* _(Effect.promise(() => ctx.service.getIssue(issueRef)));
        const identifier = issue.identifier ?? issue.id;

        if (this.json) {
          ctx.output.write({ identifier, id: issue.id });
        } else {
          ctx.output.write(identifier);
        }

        return 0;
      }.bind(this));

      return runCommandEffect(context, program);
    });
  }
}
