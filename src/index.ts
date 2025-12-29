#!/usr/bin/env bun
import { Cli, Command } from "clipanion";
import { Effect } from "effect";

import packageJson from "../package.json" assert { type: "json" };
import { BaseCommand } from "./commands/base-command";
import { CompactHelpCommand, DetailedHelpCommand } from "./commands/help";
import { IssueCreateCommand } from "./commands/issue/create";
import { IssueIdCommand } from "./commands/issue/id";
import { IssueListCommand } from "./commands/issue/list";
import { IssuePrCommand } from "./commands/issue/pr";
import { IssueStartCommand } from "./commands/issue/start";
import { IssueTitleCommand } from "./commands/issue/title";
import { IssueUpdateCommand } from "./commands/issue/update";
import { IssueUrlCommand } from "./commands/issue/url";
import { IssueViewCommand } from "./commands/issue/view";
import { ProfileAddCommand } from "./commands/profile/add";
import { ProfileListCommand } from "./commands/profile/list";
import { ProfileRemoveCommand } from "./commands/profile/remove";
import { ProfileShowCommand } from "./commands/profile/show";
import { ProfileUseCommand } from "./commands/profile/use";
import { StateListCommand } from "./commands/state/list";
import { TeamListCommand } from "./commands/team/list";
import { UserListCommand } from "./commands/user/list";
import { getConfig, success, warn } from "./services";

class RootCommand extends BaseCommand {
	static paths = [[]];

	static usage = Command.Usage({
		description: "Linear CLI entrypoint",
		details: `
Run without subcommands to validate configuration.

Behavior:
  
  - Verifies that the Linear API key is available and prints active defaults.
  - Useful as a health check before automated workflows call other commands.

Outputs:
  
  - Plain mode logs "Linear CLI ready" with API host + defaults.
  - --json still works globally and affects any subcommand.
`,
	});

	async execute(): Promise<number> {
		return this.run(
			Effect.gen(function* () {
				const config = yield* getConfig();
				const hasKey = Boolean(config.profile.apiKey);

				if (!hasKey) {
					yield* warn("No Linear API key configured. Set LINEAR_API_KEY or configure a profile.");
					return 1;
				}

				yield* success("Linear CLI ready", {
					profile: config.activeProfile,
					apiHost: config.profile.apiHost,
					defaults: config.profile.defaults,
				});

				return 0;
			}),
			{ requireApiKey: false },
		);
	}
}

const cli = new Cli({
	binaryLabel: "Linear CLI",
	binaryName: "linear-sh",
	binaryVersion: packageJson.version ?? "0.0.0",
});

const commandClasses = [
	CompactHelpCommand,
	DetailedHelpCommand,
	RootCommand,
	// Issue commands
	IssueViewCommand,
	IssueListCommand,
	IssueIdCommand,
	IssueTitleCommand,
	IssueUrlCommand,
	IssueCreateCommand,
	IssueUpdateCommand,
	IssueStartCommand,
	IssuePrCommand,
	// Profile commands
	ProfileAddCommand,
	ProfileListCommand,
	ProfileRemoveCommand,
	ProfileShowCommand,
	ProfileUseCommand,
	// Discovery commands
	TeamListCommand,
	StateListCommand,
	UserListCommand,
];

for (const commandClass of commandClasses) {
	cli.register(commandClass);
}

const rawArgs = process.argv.slice(2);
const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;

void cli.runExit(args, {
	stdin: process.stdin,
	stdout: process.stdout,
	stderr: process.stderr,
});
