import { Effect } from "effect";

import type { GitService } from "../../services";

// -----------------------------------------------------------------------------
// Mock Git Service
// -----------------------------------------------------------------------------

export interface MockGitOptions {
	currentBranch?: string;
	existingBranches?: string[];
	inferredIssueKey?: string | null;
	onCreateBranch?: (name: string) => void;
	onCheckoutBranch?: (name: string) => void;
}

export function mockGitService(options: MockGitOptions = {}): GitService {
	const branches = new Set(options.existingBranches ?? ["main", "develop"]);
	let currentBranch = options.currentBranch ?? "main";

	return {
		getCurrentBranch: () => Effect.succeed(currentBranch),

		createBranch: (name: string) => {
			options.onCreateBranch?.(name);
			branches.add(name);
			return Effect.void;
		},

		checkoutBranch: (name: string) => {
			options.onCheckoutBranch?.(name);
			currentBranch = name;
			return Effect.void;
		},

		branchExists: (name: string) => Effect.succeed(branches.has(name)),

		inferIssueKey: () => Effect.succeed(options.inferredIssueKey ?? null),
	};
}

// -----------------------------------------------------------------------------
// Default Mock (no branch inference, main branch)
// -----------------------------------------------------------------------------

export function defaultMockGitService(): GitService {
	return mockGitService({
		currentBranch: "main",
		existingBranches: ["main"],
		inferredIssueKey: null,
	});
}
