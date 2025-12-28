import { Command, Option } from "clipanion";
import { Effect } from "effect";

import { getIssueDetails, write, type IssueDetails } from "../../services";
import { openInBrowser } from "../../utils/open";
import { ISSUE_USAGE_CATEGORY, IssueBaseCommand } from "./base";

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
		examples: [
			["View current branch issue", "linear-sh issue view"],
			["View specific issue", "linear-sh issue view ENG-123"],
			["Open in browser", "linear-sh issue view -w"],
		],
	});

	open = Option.Boolean("-w,--web", false, {
		description: "Open the issue in the default browser",
	});

	async execute(): Promise<number> {
		const self = this;

		return this.run(
			Effect.gen(function* () {
				const issueRef = yield* self.resolveIssueRefEffect();
				const details = yield* getIssueDetails(issueRef);

				if (self.open && details.url) {
					yield* Effect.promise(() => openInBrowser(details.url!));
				}

				if (self.json) {
					yield* write({ issue: details });
				} else {
					yield* write(formatIssueDetails(details));
				}

				return 0;
			}),
		);
	}
}

function formatIssueDetails(details: IssueDetails): string {
	const lines = [`${details.identifier ?? details.id} — ${details.title}`];

	if (details.stateName) {
		lines.push(`Status: ${details.stateName}`);
	}

	if (details.assigneeName) {
		lines.push(`Assignee: ${details.assigneeName}`);
	}

	if (details.labels.length > 0) {
		lines.push(`Labels: ${details.labels.map((label) => label.name).join(", ")}`);
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
