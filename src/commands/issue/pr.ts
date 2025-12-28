import { spawnSync } from "node:child_process";
import { Command, Option } from "clipanion";
import { Effect } from "effect";

import { CliContext, runCommandEffect } from "../../runtime/effect";
import { ISSUE_USAGE_CATEGORY, IssueBaseCommand } from "./base";

export class IssuePrCommand extends IssueBaseCommand {
	static paths = [["issue", "pr"]];

	static usage = Command.Usage({
		description: "Create a GitHub pull request seeded with Linear issue context",
		category: ISSUE_USAGE_CATEGORY,
		details: `
Use after preparing a branch to open a GitHub pull request that references the matching Linear issue.

Prerequisites:

  - Requires the GitHub CLI (\`gh\`) to be installed and authenticated.
  - Assumes the current repository already has commits ready for PR creation.

Inputs:

  - issueRef (optional): Defaults to the current branch-derived key.
  - --draft: Pass through to \`gh pr create\` to open the PR as a draft.

Behavior:

  - Fetches enriched issue details, builds a PR title like "[ENG-123] Summary", and a body linking to Linear.
  - Invokes \`gh pr create --fill\`, preserving your local PR template.

Outputs:

  - Plain mode prints "Pull request created" with the issue key.
  - --json includes \`{ status: "success", issue: { identifier } }\`.

Failure Modes:

  - Throws when the issue lacks a public URL or when \`gh pr create\` exits non-zero.
`,
	});

	static runGh = (args: string[]) => spawnSync("gh", args, { stdio: "inherit" });

	draft = Option.Boolean("--draft", false, {
		description: "Open PR as draft",
	});

	async execute(): Promise<number> {
		const self = this;
		return this.withContext(async (context) => {
			const program = Effect.gen(function* () {
				const ctx = yield* CliContext;
				const issueRef = yield* self.resolveIssueRefEffect();
				const issue = yield* Effect.promise(() => ctx.service.getIssueDetails(issueRef));

				if (!issue.url) {
					return yield* Effect.fail(new Error("Issue does not have a URL to include in PR body"));
				}

				const title = `[${issue.identifier}] ${issue.title}`;
				const body = `${issue.title}\n\n${issue.url}`;

				const args = ["pr", "create", "--fill", "--title", title, "--body", body];
				if (self.draft) {
					args.push("--draft");
				}

				const result = yield* Effect.sync(() => IssuePrCommand.runGh(args));
				if (result.status !== 0) {
					return yield* Effect.fail(new Error("gh pr create failed"));
				}

				ctx.output.success("Pull request created", {
					issue: issue.identifier,
				});

				return 0;
			});

			return runCommandEffect(context, program);
		});
	}
}
