import { Context, Effect, Layer } from "effect";
import { $ } from "zx";

import { GitError, type LinearError } from "../errors";

// -----------------------------------------------------------------------------
// Service Interface
// -----------------------------------------------------------------------------

export interface GitService {
	/** Get the current branch name */
	readonly getCurrentBranch: () => Effect.Effect<string, LinearError>;

	/** Create a new branch */
	readonly createBranch: (name: string) => Effect.Effect<void, LinearError>;

	/** Checkout a branch */
	readonly checkoutBranch: (name: string) => Effect.Effect<void, LinearError>;

	/** Check if a branch exists */
	readonly branchExists: (name: string) => Effect.Effect<boolean, LinearError>;

	/** Infer issue key from current branch */
	readonly inferIssueKey: () => Effect.Effect<string | null, LinearError>;
}

// -----------------------------------------------------------------------------
// Context Tag
// -----------------------------------------------------------------------------

export const GitService = Context.GenericTag<GitService>("linear-sh/services/GitService");

// -----------------------------------------------------------------------------
// Branch Pattern
// -----------------------------------------------------------------------------

const ISSUE_KEY_PATTERN = /\b([a-z]+-\d+)\b/i;

function extractIssueKey(branch: string): string | null {
	const match = ISSUE_KEY_PATTERN.exec(branch);
	if (!match || !match[1]) {
		return null;
	}
	return match[1].toUpperCase();
}

// -----------------------------------------------------------------------------
// Live Implementation
// -----------------------------------------------------------------------------

export const GitServiceLive: Layer.Layer<GitService, never> = Layer.succeed(
	GitService,
	GitService.of({
		getCurrentBranch: (): Effect.Effect<string, LinearError> =>
			Effect.tryPromise({
				try: async () => {
					$.quiet = true;
					const result = await $`git rev-parse --abbrev-ref HEAD`;
					return result.stdout.trim();
				},
				catch: (error) =>
					GitError(
						`Failed to get current branch: ${error instanceof Error ? error.message : String(error)}`,
					),
			}),

		createBranch: (name: string): Effect.Effect<void, LinearError> =>
			Effect.tryPromise({
				try: async () => {
					$.quiet = true;
					await $`git checkout -b ${name}`;
				},
				catch: (error) =>
					GitError(
						`Failed to create branch ${name}: ${error instanceof Error ? error.message : String(error)}`,
					),
			}),

		checkoutBranch: (name: string): Effect.Effect<void, LinearError> =>
			Effect.tryPromise({
				try: async () => {
					$.quiet = true;
					await $`git checkout ${name}`;
				},
				catch: (error) =>
					GitError(
						`Failed to checkout branch ${name}: ${error instanceof Error ? error.message : String(error)}`,
					),
			}),

		branchExists: (name: string): Effect.Effect<boolean, LinearError> =>
			Effect.tryPromise({
				try: async () => {
					$.quiet = true;
					const result = await $`git show-ref --verify --quiet refs/heads/${name}`.exitCode;
					return result === 0;
				},
				catch: () => Effect.succeed(false),
			}).pipe(Effect.catchAll(() => Effect.succeed(false))),

		inferIssueKey: (): Effect.Effect<string | null, LinearError> =>
			Effect.tryPromise({
				try: async () => {
					$.quiet = true;
					const result = await $`git rev-parse --abbrev-ref HEAD`;
					return extractIssueKey(result.stdout.trim());
				},
				catch: (error) =>
					GitError(
						`Failed to infer issue key: ${error instanceof Error ? error.message : String(error)}`,
					),
			}),
	}),
);

// -----------------------------------------------------------------------------
// Accessor functions
// -----------------------------------------------------------------------------

export const getCurrentBranch = (): Effect.Effect<string, LinearError, GitService> =>
	Effect.flatMap(GitService, (service) => service.getCurrentBranch());

export const createBranch = (name: string): Effect.Effect<void, LinearError, GitService> =>
	Effect.flatMap(GitService, (service) => service.createBranch(name));

export const checkoutBranch = (name: string): Effect.Effect<void, LinearError, GitService> =>
	Effect.flatMap(GitService, (service) => service.checkoutBranch(name));

export const branchExists = (name: string): Effect.Effect<boolean, LinearError, GitService> =>
	Effect.flatMap(GitService, (service) => service.branchExists(name));

export const inferIssueKey = (): Effect.Effect<string | null, LinearError, GitService> =>
	Effect.flatMap(GitService, (service) => service.inferIssueKey());
