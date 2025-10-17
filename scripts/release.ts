#!/usr/bin/env bun
import { $, chalk } from "zx";

interface ReleaseOptions {
  readonly dryRun: boolean;
}

async function ensureCleanWorkingTree() {
  const status = (await $`git status --porcelain`).stdout.trim();
  if (status.length > 0) {
    throw new Error("Working tree has uncommitted changes");
  }
}

async function runRelease(options: ReleaseOptions) {
  await ensureCleanWorkingTree();

  console.log(chalk.cyan("→ Building project"));
  await $`bun run build`;

  console.log(chalk.cyan("→ Running tests"));
  await $`bun test`;

  console.log(chalk.cyan("→ Linting"));
  await $`bun run lint`;

  const publishCommand = options.dryRun
    ? $`bun publish --dry-run`
    : $`bun publish`;

  console.log(chalk.cyan(`→ Publishing (${options.dryRun ? "dry run" : "live"})`));
  await publishCommand;

  console.log(chalk.green("Release workflow complete."));
  console.log(chalk.gray("Tip: run 'bun link' to expose the CLI locally."));
}

function parseArgs(): ReleaseOptions {
  const dryRun = process.argv.includes("--dry-run");
  return { dryRun };
}

runRelease(parseArgs()).catch((error) => {
  console.error(chalk.red("Release failed:"), error);
  process.exitCode = 1;
});
