import { Command } from "clipanion";
import { Effect } from "effect";

import { getTeams, write } from "../../services";
import { BaseCommand } from "../base-command";

export class TeamListCommand extends BaseCommand {
	static override paths = [["team", "list"]];

	static override usage = Command.Usage({
		description: "List teams in the organization",
		examples: [
			["List teams", "linear-sh team list"],
			["List teams as JSON", "linear-sh team list --json"],
		],
	});

	async execute(): Promise<number> {
		const self = this;

		return this.run(
			Effect.gen(function* () {
				const teams = yield* getTeams();

				if (self.json) {
					yield* write({ teams });
				} else {
					if (teams.length === 0) {
						yield* write("No teams found.");
					} else {
						const lines = teams.map((t) => `${t.key.padEnd(8)} ${t.name} (${t.id})`);
						yield* write(lines.join("\n"));
					}
				}

				return 0;
			}),
		);
	}
}
