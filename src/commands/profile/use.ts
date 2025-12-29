import { Command, Option } from "clipanion";
import { Effect } from "effect";

import { getProfile, setActiveProfile } from "../../config/index";
import { success, write } from "../../services";
import { BaseCommand } from "../base-command";

export class ProfileUseCommand extends BaseCommand {
	static override paths = [["profile", "use"]];

	static override usage = Command.Usage({
		description: "Switch active profile",
		examples: [["Switch to work", "linear-sh profile use work"]],
	});

	name = Option.String({ required: true, name: "profile-name" });

	async execute(): Promise<number> {
		const self = this;

		return this.run(
			Effect.gen(function* () {
				yield* setActiveProfile(self.name);

				const profile = getProfile(self.name);

				if (self.json) {
					yield* write({ activeProfile: self.name, orgName: profile?.orgName });
				} else {
					yield* success(`Switched to profile "${self.name}"`, {
						organization: profile?.orgName,
					});
				}

				return 0;
			}),
			{ requireApiKey: false },
		);
	}
}
