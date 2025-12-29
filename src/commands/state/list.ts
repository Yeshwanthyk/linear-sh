import { Command, Option } from "clipanion";
import { Effect } from "effect";

import { getConfig, getWorkflowStates, write } from "../../services";
import { BaseCommand } from "../base-command";

export class StateListCommand extends BaseCommand {
	static paths = [["state", "list"]];

	static usage = Command.Usage({
		description: "List workflow states",
		examples: [
			["List all states", "linear-sh state list"],
			["List for team", "linear-sh state list --team TEAM-ID"],
		],
	});

	team = Option.String("--team", {
		description: "Filter by team ID",
		required: false,
	});

	async execute(): Promise<number> {
		const self = this;

		return this.run(
			Effect.gen(function* () {
				const config = yield* getConfig();
				const teamId = self.team ?? config.profile.defaults.teamId;

				const states = yield* getWorkflowStates(teamId);

				if (self.json) {
					yield* write({ states });
				} else {
					if (states.length === 0) {
						yield* write("No workflow states found.");
					} else {
						const lines = states.map((s) => `${s.name.padEnd(20)} [${s.type.padEnd(10)}] ${s.id}`);
						yield* write(lines.join("\n"));
					}
				}

				return 0;
			}),
		);
	}
}
