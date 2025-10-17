import { Option } from "clipanion";

import type { CommandContext } from "../base-command";
import { BaseCommand } from "../base-command";
import { inferIssueKeyFromRepository } from "../../git/branch";

export const ISSUE_USAGE_CATEGORY = "Issue workflows";

export abstract class IssueBaseCommand extends BaseCommand {
  issueRef = Option.String({ required: false });

  protected resolveIssueRef(
    context: CommandContext,
    fallbackToGit = true,
  ): string {
    if (this.issueRef) {
      return this.issueRef;
    }
    if (!fallbackToGit) {
      throw new Error("Issue reference is required");
    }
    const inferred = inferIssueKeyFromRepository();
    if (!inferred) {
      throw new Error(
        "Issue reference not provided and could not infer from Git branch",
      );
    }
    context.logger.debug("Inferred issue from branch", { inferred });
    return inferred;
  }
}
