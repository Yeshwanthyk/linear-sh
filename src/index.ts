#!/usr/bin/env bun
import { Cli, Command } from "clipanion";

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
  
  - Plain mode logs \"Linear CLI ready\" with API host + defaults.
  - --json still works globally and affects any subcommand.
`,
  });

  async execute(): Promise<number> {
    return this.withContext((context) => {
      const hasKey = Boolean(context.config.apiKey);

      if (!hasKey) {
        context.output.warn(
          "No Linear API key configured. Set LINEAR_API_KEY or provide config files.",
        );
        return Promise.resolve(1);
      }

      context.output.success("Linear CLI ready", {
        apiHost: context.config.apiHost,
        defaults: context.config.defaults,
      });

      return Promise.resolve(0);
    }, { requireApiKey: false });
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
  IssueViewCommand,
  IssueListCommand,
  IssueIdCommand,
  IssueTitleCommand,
  IssueUrlCommand,
  IssueCreateCommand,
  IssueUpdateCommand,
  IssueStartCommand,
  IssuePrCommand,
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
