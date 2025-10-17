import { Command } from "clipanion";

import { IssueBaseCommand, ISSUE_USAGE_CATEGORY } from "./base";

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
    return this.withContext(async (context) => {
      const issueRef = this.resolveIssueRef(context);
      const issue = await context.service.getIssue(issueRef);

      if (!issue.url) {
        context.output.error(new Error("Issue does not have a URL"));
        return 1;
      }

      if (this.json) {
        context.output.write({ identifier: issue.identifier, url: issue.url });
      } else {
        context.output.write(issue.url);
      }

      return 0;
    });
  }
}
