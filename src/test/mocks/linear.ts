import { Effect } from "effect";

import type {
	CommentInput,
	IssueCreateInput,
	IssueDetails,
	IssueLabelSummary,
	IssueListOptions,
	IssueSummary,
	IssueUpdateInput,
	LinearClientService,
	TeamSummary,
	UserSummary,
	WorkflowStateSummary,
} from "../../services";

// -----------------------------------------------------------------------------
// Mock Data Factories
// -----------------------------------------------------------------------------

export interface MockIssueOverrides {
	id?: string;
	identifier?: string;
	title?: string;
	url?: string;
	description?: string | null;
	branchName?: string | null;
	stateId?: string | null;
	assigneeId?: string | null;
	teamId?: string | null;
	projectId?: string | null;
	labelIds?: string[];
	priorityLabel?: string | null;
	createdAt?: string | null;
	updatedAt?: string | null;
}

export function mockIssueSummary(overrides: MockIssueOverrides = {}): IssueSummary {
	return {
		id: overrides.id ?? "issue-123",
		identifier: overrides.identifier ?? "TEST-123",
		title: overrides.title ?? "Test Issue Title",
		url: overrides.url ?? "https://linear.app/test/issue/TEST-123",
		description: overrides.description ?? "Test issue description",
		branchName: overrides.branchName ?? "test-123-test-issue-title",
		stateId: overrides.stateId ?? "state-in-progress",
		assigneeId: overrides.assigneeId ?? "user-alice",
		teamId: overrides.teamId ?? "team-eng",
		projectId: overrides.projectId ?? null,
		labelIds: overrides.labelIds ?? [],
		priorityLabel: overrides.priorityLabel ?? "Medium",
		createdAt: overrides.createdAt ?? "2024-01-01T00:00:00.000Z",
		updatedAt: overrides.updatedAt ?? "2024-01-02T00:00:00.000Z",
	};
}

export function mockIssueDetails(
	overrides: MockIssueOverrides & {
		stateName?: string | null;
		assigneeName?: string | null;
		teamName?: string | null;
		labels?: IssueLabelSummary[];
	} = {},
): IssueDetails {
	return {
		...mockIssueSummary(overrides),
		stateName: overrides.stateName ?? "In Progress",
		assigneeName: overrides.assigneeName ?? "Alice",
		teamName: overrides.teamName ?? "Engineering",
		labels: overrides.labels ?? [],
	};
}

export function mockWorkflowState(
	overrides: Partial<WorkflowStateSummary> = {},
): WorkflowStateSummary {
	return {
		id: overrides.id ?? "state-1",
		name: overrides.name ?? "In Progress",
		type: overrides.type ?? "started",
		teamId: overrides.teamId ?? "team-eng",
	};
}

export function mockUser(overrides: Partial<UserSummary> = {}): UserSummary {
	return {
		id: overrides.id ?? "user-alice",
		name: overrides.name ?? "Alice",
		email: overrides.email ?? "alice@test.com",
	};
}

export function mockTeam(overrides: Partial<TeamSummary> = {}): TeamSummary {
	return {
		id: overrides.id ?? "team-eng",
		name: overrides.name ?? "Engineering",
		key: overrides.key ?? "ENG",
	};
}

// -----------------------------------------------------------------------------
// Default Mock Data Sets
// -----------------------------------------------------------------------------

export const defaultMockIssues: IssueSummary[] = [
	mockIssueSummary({ id: "issue-1", identifier: "ENG-1", title: "First Issue" }),
	mockIssueSummary({ id: "issue-2", identifier: "ENG-2", title: "Second Issue" }),
	mockIssueSummary({ id: "issue-3", identifier: "ENG-3", title: "Third Issue" }),
];

export const defaultMockWorkflowStates: WorkflowStateSummary[] = [
	mockWorkflowState({ id: "state-backlog", name: "Backlog", type: "backlog" }),
	mockWorkflowState({ id: "state-in-progress", name: "In Progress", type: "started" }),
	mockWorkflowState({ id: "state-done", name: "Done", type: "completed" }),
	mockWorkflowState({ id: "state-cancelled", name: "Cancelled", type: "canceled" }),
];

export const defaultMockUsers: UserSummary[] = [
	mockUser({ id: "user-alice", name: "Alice", email: "alice@test.com" }),
	mockUser({ id: "user-bob", name: "Bob", email: "bob@test.com" }),
	mockUser({ id: "user-charlie", name: "Charlie", email: "charlie@test.com" }),
];

export const defaultMockTeams: TeamSummary[] = [
	mockTeam({ id: "team-eng", name: "Engineering", key: "ENG" }),
	mockTeam({ id: "team-design", name: "Design", key: "DES" }),
];

// -----------------------------------------------------------------------------
// Mock Service Factory
// -----------------------------------------------------------------------------

export interface MockLinearClientOptions {
	issues?: IssueSummary[];
	issueDetails?: IssueDetails;
	workflowStates?: WorkflowStateSummary[];
	users?: UserSummary[];
	teams?: TeamSummary[];
	onGetIssue?: (issueRef: string) => IssueSummary;
	onGetIssueDetails?: (issueRef: string) => IssueDetails;
	onListIssues?: (options?: IssueListOptions) => IssueSummary[];
	onCreateIssue?: (input: IssueCreateInput) => IssueSummary;
	onUpdateIssue?: (issueId: string, input: IssueUpdateInput) => IssueSummary;
	onTransitionIssue?: (issueId: string, stateId: string) => IssueSummary;
	onCreateComment?: (input: CommentInput) => string;
}

export function mockLinearClientService(
	options: MockLinearClientOptions = {},
): LinearClientService {
	const issues = options.issues ?? defaultMockIssues;
	const workflowStates = options.workflowStates ?? defaultMockWorkflowStates;
	const users = options.users ?? defaultMockUsers;
	const teams = options.teams ?? defaultMockTeams;

	return {
		getIssue: (issueRef) => {
			if (options.onGetIssue) {
				return Effect.succeed(options.onGetIssue(issueRef));
			}
			const found = issues.find((i) => i.id === issueRef || i.identifier === issueRef);
			return found
				? Effect.succeed(found)
				: Effect.fail({
						_tag: "LinearApiError",
						message: `Issue ${issueRef} not found`,
					} as const);
		},

		getIssueDetails: (issueRef) => {
			if (options.onGetIssueDetails) {
				return Effect.succeed(options.onGetIssueDetails(issueRef));
			}
			if (options.issueDetails) {
				return Effect.succeed(options.issueDetails);
			}
			const found = issues.find((i) => i.id === issueRef || i.identifier === issueRef);
			return found
				? Effect.succeed(mockIssueDetails(found))
				: Effect.fail({
						_tag: "LinearApiError",
						message: `Issue ${issueRef} not found`,
					} as const);
		},

		listIssues: (listOptions) => {
			if (options.onListIssues) {
				return Effect.succeed(options.onListIssues(listOptions));
			}
			let result = [...issues];
			if (listOptions?.teamId) {
				result = result.filter((i) => i.teamId === listOptions.teamId);
			}
			if (listOptions?.stateId) {
				result = result.filter((i) => i.stateId === listOptions.stateId);
			}
			if (listOptions?.limit) {
				result = result.slice(0, listOptions.limit);
			}
			return Effect.succeed(result);
		},

		createIssue: (input) => {
			if (options.onCreateIssue) {
				return Effect.succeed(options.onCreateIssue(input));
			}
			return Effect.succeed(
				mockIssueSummary({
					id: `issue-new-${Date.now()}`,
					identifier: `${input.teamId.toUpperCase()}-999`,
					title: input.title,
					teamId: input.teamId,
					description: input.description,
					assigneeId: input.assigneeId,
				}),
			);
		},

		updateIssue: (issueId, input) => {
			if (options.onUpdateIssue) {
				return Effect.succeed(options.onUpdateIssue(issueId, input));
			}
			const existing = issues.find((i) => i.id === issueId);
			return Effect.succeed(
				mockIssueSummary({
					...existing,
					id: issueId,
					...input,
				}),
			);
		},

		transitionIssue: (issueId, stateId) => {
			if (options.onTransitionIssue) {
				return Effect.succeed(options.onTransitionIssue(issueId, stateId));
			}
			const existing = issues.find((i) => i.id === issueId);
			return Effect.succeed(
				mockIssueSummary({
					...existing,
					id: issueId,
					stateId,
				}),
			);
		},

		createComment: (input) => {
			if (options.onCreateComment) {
				return Effect.succeed(options.onCreateComment(input));
			}
			return Effect.succeed(`comment-${Date.now()}`);
		},

		getWorkflowStates: (teamId) => {
			let result = workflowStates;
			if (teamId) {
				result = result.filter((s) => s.teamId === teamId || s.teamId === null);
			}
			return Effect.succeed(result);
		},

		getUsers: (_teamId) => {
			// Linear API doesn't actually filter by team for users
			return Effect.succeed(users);
		},

		getTeams: () => {
			return Effect.succeed(teams);
		},
	};
}
