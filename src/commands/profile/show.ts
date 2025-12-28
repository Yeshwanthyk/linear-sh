import { Command } from "clipanion";
import { Effect } from "effect";

import { getConfig, write } from "../../services";
import { BaseCommand } from "../base-command";

export class ProfileShowCommand extends BaseCommand {
	static paths = [
		["profile", "show"],
		["config", "show"],
	];

	static usage = Command.Usage({
		description: "Show resolved configuration for active profile",
		examples: [["Show config", "linear-sh profile show"]],
	});

	async execute(): Promise<number> {
		const self = this;

		return this.run(
			Effect.gen(function* () {
				const config = yield* getConfig();

				if (self.json) {
					yield* write({
						activeProfile: config.activeProfile,
						profile: {
							orgId: config.profile.orgId,
							orgName: config.profile.orgName,
							apiHost: config.profile.apiHost,
							defaults: config.profile.defaults,
						},
						output: config.output,
						paths: config.paths,
					});
				} else {
					const lines = [
						`Profile: ${config.activeProfile}`,
						`Organization: ${config.profile.orgName ?? config.profile.orgId ?? "(unknown)"}`,
						`API Host: ${config.profile.apiHost}`,
						`Output Format: ${config.output}`,
						"",
						"Defaults:",
					];

					const defaults = config.profile.defaults;
					if (defaults.teamId) lines.push(`  Team: ${defaults.teamId}`);
					if (defaults.assigneeId) lines.push(`  Assignee: ${defaults.assigneeId}`);
					if (defaults.workflowStateId) lines.push(`  State: ${defaults.workflowStateId}`);
					if (defaults.projectId) lines.push(`  Project: ${defaults.projectId}`);

					if (Object.keys(defaults).length === 0) {
						lines.push("  (none)");
					}

					yield* write(lines.join("\n"));
				}

				return 0;
			}),
			{ requireApiKey: false },
		);
	}
}
