import { Command, Option } from "clipanion";
import { Effect } from "effect";

import { getConfig, getUsers, write } from "../../services";
import { BaseCommand } from "../base-command";

export class UserListCommand extends BaseCommand {
	static paths = [["user", "list"]];

	static usage = Command.Usage({
		description: "List users in the organization",
		examples: [
			["List all users", "linear-sh user list"],
			["List as JSON", "linear-sh user list --json"],
		],
	});

	team = Option.String("--team", {
		description: "Filter by team ID (not currently implemented by API)",
		required: false,
	});

	async execute(): Promise<number> {
		const self = this;

		return this.run(
			Effect.gen(function* () {
				const config = yield* getConfig();
				const teamId = self.team ?? config.profile.defaults.teamId;

				const users = yield* getUsers(teamId);

				if (self.json) {
					yield* write({ users });
				} else {
					if (users.length === 0) {
						yield* write("No users found.");
					} else {
						const lines = users.map(
							(u) => `${u.name.padEnd(25)} ${(u.email ?? "").padEnd(30)} ${u.id}`,
						);
						yield* write(lines.join("\n"));
					}
				}

				return 0;
			}),
		);
	}
}
