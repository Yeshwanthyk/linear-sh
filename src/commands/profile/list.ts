import { Command } from "clipanion";
import { Effect } from "effect";

import { type ProfileSummary, listProfiles } from "../../config/index";
import { write } from "../../services";
import { BaseCommand } from "../base-command";

export class ProfileListCommand extends BaseCommand {
	static override paths = [["profile", "list"]];

	static override usage = Command.Usage({
		description: "List configured profiles",
		examples: [["List all profiles", "linear-sh profile list"]],
	});

	async execute(): Promise<number> {
		const self = this;

		return this.run(
			Effect.gen(function* () {
				const profiles = listProfiles();

				if (self.json) {
					yield* write({ profiles });
				} else {
					if (profiles.length === 0) {
						yield* write("No profiles configured. Run `linear-sh profile add` to create one.");
					} else {
						const lines = profiles.map((p: ProfileSummary) => {
							const active = p.isActive ? " (active)" : "";
							const org = p.orgName ? ` [${p.orgName}]` : "";
							return `${p.name}${org}${active}`;
						});
						yield* write(lines.join("\n"));
					}
				}

				return 0;
			}),
			{ requireApiKey: false },
		);
	}
}
