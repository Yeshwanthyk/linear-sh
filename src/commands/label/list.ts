import { Command, Option } from "clipanion";
import { Effect } from "effect";

import { getLabels, write } from "../../services";
import { BaseCommand } from "../base-command";

export class LabelListCommand extends BaseCommand {
	static override paths = [["label", "list"]];

	static override usage = Command.Usage({
		description: "List issue labels",
		examples: [
			["List all labels", "linear-sh label list"],
			["List labels usable by a team", "linear-sh label list --team TEAM-ID"],
			["Filter by exact label name", 'linear-sh label list --name "Sentry" --json'],
		],
	});

	team = Option.String("--team", {
		description: "Include workspace labels and labels for this team ID",
		required: false,
	});

	name = Option.String("--name", {
		description: "Filter by exact label name",
		required: false,
	});

	async execute(): Promise<number> {
		const self = this;

		return this.run(
			Effect.gen(function* () {
				const labels = yield* getLabels(self.team);
				const filtered = self.name
					? labels.filter((label) => label.name.toLowerCase() === self.name?.toLowerCase())
					: labels;

				if (self.json) {
					yield* write({ labels: filtered });
				} else if (filtered.length === 0) {
					yield* write("No labels found.");
				} else {
					const lines = filtered.map((label) => {
						const scope = label.teamId ? `team:${label.teamId}` : "workspace";
						return `${label.name.padEnd(25)} ${scope.padEnd(45)} ${label.id}`;
					});
					yield* write(lines.join("\n"));
				}

				return 0;
			}),
		);
	}
}
