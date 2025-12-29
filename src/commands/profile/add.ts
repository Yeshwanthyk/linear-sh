import { Command, Option } from "clipanion";
import { Effect } from "effect";
import Enquirer from "enquirer";

import { addProfile } from "../../config/index";
import { success, write } from "../../services";
import { BaseCommand } from "../base-command";

interface PromptResponses {
	name?: string;
	apiKey?: string;
}

export class ProfileAddCommand extends BaseCommand {
	static override paths = [["profile", "add"]];

	static override usage = Command.Usage({
		description: "Add a new profile",
		examples: [
			["Interactive", "linear-sh profile add"],
			["With options", "linear-sh profile add --name work --api-key lin_api_xxx --set-active"],
		],
	});

	name = Option.String("--name", {
		description: "Profile name",
		required: false,
	});

	apiKey = Option.String("--api-key", {
		description: "Linear API key",
		required: false,
	});

	setActive = Option.Boolean("--set-active", false, {
		description: "Set as active profile after adding",
	});

	async execute(): Promise<number> {
		const self = this;

		return this.run(
			Effect.gen(function* () {
				let name = self.name;
				let apiKey = self.apiKey;

				// Interactive prompts if needed
				if (!name || !apiKey) {
					const prompts: Array<{
						type: string;
						name: string;
						message: string;
						initial?: string;
					}> = [];

					if (!name) {
						prompts.push({
							type: "input",
							name: "name",
							message: "Profile name",
							initial: "default",
						});
					}

					if (!apiKey) {
						prompts.push({
							type: "password",
							name: "apiKey",
							message: "Linear API key",
						});
					}

					if (prompts.length > 0) {
						const responses = yield* Effect.promise(() =>
							Enquirer.prompt<PromptResponses>(prompts),
						);

						name = name ?? responses.name;
						apiKey = apiKey ?? responses.apiKey;
					}
				}

				if (!name || !apiKey) {
					yield* write("Profile name and API key are required.");
					return 1;
				}

				const profile = yield* addProfile({
					name,
					apiKey,
					setActive: self.setActive,
				});

				if (self.json) {
					yield* write({
						profile: { name, orgId: profile.orgId, orgName: profile.orgName },
					});
				} else {
					yield* success(`Profile "${name}" added`, {
						organization: profile.orgName ?? profile.orgId,
						active: self.setActive,
					});
				}

				return 0;
			}),
			{ requireApiKey: false },
		);
	}
}
