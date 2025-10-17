import { execFileSync, spawnSync } from "node:child_process";

import { GitIntegrationError } from "../errors";

const ISSUE_KEY_REGEX = /([A-Za-z]+-\d+)/i;
const BRANCH_SANITIZE_REGEX = /[^a-z0-9/_-]+/g;

export interface GitOptions {
  readonly cwd?: string;
}

export function getCurrentBranch(options: GitOptions = {}): string {
  try {
    const result = execFileSync(
      "git",
      ["rev-parse", "--abbrev-ref", "HEAD"],
      {
        cwd: options.cwd,
        encoding: "utf8",
      },
    );
    return result.trim();
  } catch (error) {
    throw new GitIntegrationError(
      `Unable to determine current Git branch: ${String(error)}`,
    );
  }
}

export function extractIssueKeyFromBranch(branch: string): string | null {
  const normalized = branch.replace(/\//g, "-");
  const match = ISSUE_KEY_REGEX.exec(normalized);
  if (!match) {
    return null;
  }
  return match[1].toUpperCase();
}

export function inferIssueKeyFromRepository(options: GitOptions = {}): string | null {
  const branch = getCurrentBranch(options);
  return extractIssueKeyFromBranch(branch);
}

export function branchExists(branch: string, options: GitOptions = {}): boolean {
  const result = spawnSync(
    "git",
    ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`],
    { cwd: options.cwd, stdio: "ignore" },
  );
  return result.status === 0;
}

export function createBranch(
  branch: string,
  options: GitOptions = {},
): void {
  const result = spawnSync("git", ["checkout", "-b", branch], {
    cwd: options.cwd,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new GitIntegrationError(
      `Failed to create branch ${branch}`,
    );
  }
}

export function checkoutBranch(
  branch: string,
  options: GitOptions = {},
): void {
  const result = spawnSync("git", ["checkout", branch], {
    cwd: options.cwd,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new GitIntegrationError(`Failed to checkout branch ${branch}`);
  }
}

export function sanitizeBranchName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(BRANCH_SANITIZE_REGEX, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
