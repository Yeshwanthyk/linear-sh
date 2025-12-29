import { Command, Option } from "clipanion";
import { Effect } from "effect";

import { removeProfile } from "../../config/index";
import { success, write } from "../../services";
import { BaseCommand } from "../base-command";

export class ProfileRemoveCommand extends BaseCommand {
	static override paths = [["profile", "remove"]];

	static override usage = Command.Usage({
		description: "Remove a profile",
		examples: [["Remove old profile", "linear-sh profile remove old"]],
	});

	name = Option.String({ required: true, name: "profile-name" });

	async execute(): Promise<number> {
		const self = this;

		return this.run(
			Effect.gen(function* () {
				yield* removeProfile(self.name);

				if (self.json) {
					yield* write({ removed: self.name });
				} else {
					yield* success(`Removed profile "${self.name}"`);
				}

				return 0;
			}),
			{ requireApiKey: false },
		);
	}
}
