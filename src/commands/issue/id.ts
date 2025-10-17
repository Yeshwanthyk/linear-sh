import { Command } from "clipanion";

import { IssueBaseCommand, ISSUE_USAGE_CATEGORY } from "./base";

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
      const issueRef = this.resolveIssueRef(context);
      const issue = await context.service.getIssue(issueRef);
      const identifier = issue.identifier ?? issue.id;

      if (this.json) {
        context.output.write({ identifier, id: issue.id });
      } else {
        context.output.write(identifier);
      }

      return 0;
    });
  }
}
