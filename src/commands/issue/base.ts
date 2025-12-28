import { Option } from "clipanion";
import { Effect } from "effect";

import { ValidationError, type LinearError } from "../../errors";
import { inferIssueKey, logDebug } from "../../services";
import type { CommandContext } from "../base-command";
import { BaseCommand } from "../base-command";

export const ISSUE_USAGE_CATEGORY = "Issue workflows";

export abstract class IssueBaseCommand extends BaseCommand {
	issueRef = Option.String({ required: false });

	/**
	 * @deprecated Use resolveIssueRefEffect instead
	 */
	protected resolveIssueRef(context: CommandContext, fallbackToGit = true): string {
		if (this.issueRef) {
			return this.issueRef;
		}
		if (!fallbackToGit) {
			throw new Error("Issue reference is required");
		}
		// Legacy path - use sync git inference
		const { execSync } = require("node:child_process");
		try {
			const branch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
			const match = branch.match(/([A-Z]+-\d+)/i);
			if (match?.[0]) {
				context.logger.debug("Inferred issue from branch", { inferred: match[0] });
				return match[0];
			}
		} catch {
			// Not in a git repo
		}
		throw new Error("Issue reference not provided and could not infer from Git branch");
	}

	/**
	 * Resolve issue reference from argument or git branch.
	 * Returns an Effect that yields the issue key.
	 */
	protected resolveIssueRefEffect(
		fallbackToGit = true,
	): Effect.Effect<string, LinearError, import("../../services").GitService | import("../../services").LoggerService> {
		const ref = this.issueRef;

		return Effect.gen(function* () {
			if (ref) {
				return ref;
			}
			if (!fallbackToGit) {
				return yield* Effect.fail(ValidationError("Issue reference is required", "issueRef"));
			}

			const inferred = yield* inferIssueKey();

			if (!inferred) {
				return yield* Effect.fail(
					ValidationError(
						"Issue reference not provided and could not infer from Git branch",
						"issueRef",
					),
				);
			}

			yield* logDebug("Inferred issue from branch", { inferred });
			return inferred;
		});
	}
}
