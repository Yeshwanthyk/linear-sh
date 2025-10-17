import { Command, Option } from "clipanion";

import { IssueBaseCommand, ISSUE_USAGE_CATEGORY } from "./base";
import type { IssueDetails } from "../../linear/client";
import { openInBrowser } from "../../utils/open";

export class IssueViewCommand extends IssueBaseCommand {
  static paths = [["issue", "view"]];

  static usage = Command.Usage({
    description: "Display Linear issue details",
    category: ISSUE_USAGE_CATEGORY,
    details: `
Use this command when you need the full context for a single Linear issue.

Inputs:

  - issueRef (optional): Linear issue key (e.g. ENG-123) or ID. When omitted we attempt to infer it from the current Git branch name.
  - --json: Emit a structured payload \`{ issue: IssueDetails }\` for scripts and LLM agents.
  - --no-cache: Force a fresh fetch instead of using any cached metadata.
  - -w,--web: Open the resolved issue URL in the default browser after fetching details.

Behavior:

  - Retrieves the issue, enriches it with workflow state, labels, team, and assignee data, and prints either a human summary or JSON.
  - Exits with a non-zero code if the issue cannot be found or no API key is configured.

Side Effects:

  - Launches the default browser when \`--web\` is provided.
`,
    examples: [["View current branch issue", "linear-sh issue view"], ["View specific issue", "linear-sh issue view ENG-123"], ["Open in browser", "linear-sh issue view -w"]],
  });

  open = Option.Boolean("-w,--web", false, {
    description: "Open the issue in the default browser",
  });

  async execute(): Promise<number> {
    return this.withContext(async (context) => {
      const issueRef = this.resolveIssueRef(context);
      const details = await context.service.getIssueDetails(issueRef);

      if (this.open && details.url) {
        await openInBrowser(details.url);
      }

      if (this.json) {
        context.output.write({ issue: details });
      } else {
        context.output.write(formatIssueDetails(details));
      }

      return 0;
    });
  }
}

function formatIssueDetails(details: IssueDetails): string {
  const lines = [
    `${details.identifier ?? details.id} — ${details.title}`,
  ];

  if (details.stateName) {
    lines.push(`Status: ${details.stateName}`);
  }

  if (details.assigneeName) {
    lines.push(`Assignee: ${details.assigneeName}`);
  }

  if (details.labels.length > 0) {
    lines.push(
      `Labels: ${details.labels.map((label) => label.name).join(", ")}`,
    );
  }

  if (details.priorityLabel) {
    lines.push(`Priority: ${details.priorityLabel}`);
  }

  if (details.url) {
    lines.push(`URL: ${details.url}`);
  }

  if (details.description) {
    lines.push("", details.description.trim());
  }

  return lines.join("\n");
}
