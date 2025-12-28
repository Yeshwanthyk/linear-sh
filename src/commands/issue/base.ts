import { Option } from "clipanion";
import { Effect } from "effect";

import { inferIssueKeyFromRepository } from "../../git/branch";
import { CliContext } from "../../runtime/effect";
import type { CommandContext } from "../base-command";
import { BaseCommand } from "../base-command";

export const ISSUE_USAGE_CATEGORY = "Issue workflows";

export abstract class IssueBaseCommand extends BaseCommand {
	issueRef = Option.String({ required: false });

	protected resolveIssueRef(context: CommandContext, fallbackToGit = true): string {
		if (this.issueRef) {
			return this.issueRef;
		}
		if (!fallbackToGit) {
			throw new Error("Issue reference is required");
		}
		const inferred = inferIssueKeyFromRepository();
		if (!inferred) {
			throw new Error("Issue reference not provided and could not infer from Git branch");
		}
		context.logger.debug("Inferred issue from branch", { inferred });
		return inferred;
	}

	protected resolveIssueRefEffect(fallbackToGit = true) {
		const self = this;
		return Effect.gen(function* () {
			const ctx = yield* CliContext;

			if (self.issueRef) {
				return self.issueRef;
			}
			if (!fallbackToGit) {
				return yield* Effect.fail(new Error("Issue reference is required"));
			}
			const inferred = inferIssueKeyFromRepository();
			if (!inferred) {
				return yield* Effect.fail(
					new Error("Issue reference not provided and could not infer from Git branch"),
				);
			}
			ctx.logger.debug("Inferred issue from branch", { inferred });
			return inferred;
		});
	}
}
