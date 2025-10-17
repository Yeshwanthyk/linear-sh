import { Command } from "clipanion";

import { IssueBaseCommand, ISSUE_USAGE_CATEGORY } from "./base";

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
    return this.withContext(async (context) => {
      const issueRef = this.resolveIssueRef(context);
      const issue = await context.service.getIssue(issueRef);

      if (this.json) {
        context.output.write({ identifier: issue.identifier, title: issue.title });
      } else {
        context.output.write(issue.title);
      }

      return 0;
    });
  }
}
