import { LinearClient, LinearDocument, type PaginationOrderBy } from "@linear/sdk";
import { Context, Effect, Layer } from "effect";

import { getApiKey, getProfile, ConfigService } from "./config";
import { LinearApiError, type LinearError } from "../errors";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface IssueSummary {
	readonly id: string;
	readonly identifier: string;
	readonly title: string;
	readonly url: string;
	readonly description: string | null;
	readonly branchName: string | null;
	readonly stateId: string | null;
	readonly assigneeId: string | null;
	readonly teamId: string | null;
	readonly projectId: string | null;
	readonly labelIds: string[];
	readonly priorityLabel: string | null;
	readonly createdAt: string | null;
	readonly updatedAt: string | null;
}

export interface IssueLabelSummary {
	readonly id: string;
	readonly name: string;
	readonly color: string | null;
}

export interface IssueDetails extends IssueSummary {
	readonly stateName: string | null;
	readonly assigneeName: string | null;
	readonly teamName: string | null;
	readonly labels: IssueLabelSummary[];
}

export interface IssueCreateInput {
	readonly teamId: string;
	readonly title: string;
	readonly description?: string;
	readonly assigneeId?: string;
	readonly labelIds?: string[];
	readonly projectId?: string;
}

export interface IssueUpdateInput {
	readonly title?: string;
	readonly description?: string;
	readonly assigneeId?: string;
	readonly stateId?: string;
	readonly labelIds?: string[];
}

export interface CommentInput {
	readonly issueId: string;
	readonly body: string;
}

export interface IssueListOptions {
	readonly teamId?: string;
	readonly stateId?: string;
	readonly assigneeId?: string;
	readonly projectId?: string;
	readonly limit?: number;
}

export interface WorkflowStateSummary {
	readonly id: string;
	readonly name: string;
	readonly type: string;
	readonly teamId: string | null;
}

export interface UserSummary {
	readonly id: string;
	readonly name: string;
	readonly email: string | null;
}

export interface TeamSummary {
	readonly id: string;
	readonly name: string;
	readonly key: string;
}

// -----------------------------------------------------------------------------
// Internal types for SDK responses
// -----------------------------------------------------------------------------

interface LinearIssueEntity {
	id: string;
	identifier: string;
	title: string;
	url: string;
	description?: string | null;
	branchName?: string | null;
	stateId?: string | null;
	assigneeId?: string | null;
	teamId?: string | null;
	projectId?: string | null;
	labelIds: string[];
	priorityLabel?: string | null;
	createdAt?: Date;
	updatedAt?: Date;
	labels?: (vars?: Record<string, unknown>) => Promise<IssueLabelConnectionEntity>;
	team?: (vars?: Record<string, unknown>) => Promise<{ id: string; name: string } | null>;
	state?: (
		vars?: Record<string, unknown>,
	) => Promise<{ id: string; name: string; type: string } | null>;
	assignee?: (vars?: Record<string, unknown>) => Promise<{ id: string; name: string } | null>;
}

interface IssueLabelConnectionEntity {
	nodes?: Array<{ id: string; name: string; color?: string | null }>;
}

interface IssueCreateResponse {
	issueCreate?: {
		success: boolean;
		issue?: LinearIssueEntity | null;
	};
}

interface IssueUpdateResponse {
	issueUpdate?: {
		success: boolean;
		issue?: LinearIssueEntity | null;
	};
}

interface CommentCreateResponse {
	commentCreate?: {
		success: boolean;
		comment?: { id: string } | null;
	};
}

interface GraphqlRequester {
	request(document: unknown, variables: Record<string, unknown>): Promise<unknown>;
}

// -----------------------------------------------------------------------------
// Service Interface
// -----------------------------------------------------------------------------

export interface LinearClientService {
	readonly getIssue: (issueRef: string) => Effect.Effect<IssueSummary, LinearError>;
	readonly getIssueDetails: (issueRef: string) => Effect.Effect<IssueDetails, LinearError>;
	readonly listIssues: (options?: IssueListOptions) => Effect.Effect<IssueSummary[], LinearError>;
	readonly createIssue: (input: IssueCreateInput) => Effect.Effect<IssueSummary, LinearError>;
	readonly updateIssue: (
		issueId: string,
		input: IssueUpdateInput,
	) => Effect.Effect<IssueSummary, LinearError>;
	readonly transitionIssue: (
		issueId: string,
		stateId: string,
	) => Effect.Effect<IssueSummary, LinearError>;
	readonly createComment: (input: CommentInput) => Effect.Effect<string, LinearError>;
	readonly getWorkflowStates: (
		teamId?: string,
	) => Effect.Effect<WorkflowStateSummary[], LinearError>;
	readonly getUsers: (teamId?: string) => Effect.Effect<UserSummary[], LinearError>;
	readonly getTeams: () => Effect.Effect<TeamSummary[], LinearError>;
}

// -----------------------------------------------------------------------------
// Context Tag
// -----------------------------------------------------------------------------

export const LinearClientService = Context.GenericTag<LinearClientService>(
	"linear-sh/services/LinearClientService",
);

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const ISSUE_IDENTIFIER_REGEX = /^[A-Za-z]+-\d+$/i;
const DEFAULT_MAX_LIST_ITEMS = 50;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function mapIssue(issue: LinearIssueEntity): IssueSummary {
	return {
		id: issue.id,
		identifier: issue.identifier,
		title: issue.title,
		url: issue.url,
		description: issue.description ?? null,
		branchName: issue.branchName ?? null,
		stateId: issue.stateId ?? null,
		assigneeId: issue.assigneeId ?? null,
		teamId: issue.teamId ?? null,
		projectId: issue.projectId ?? null,
		labelIds: issue.labelIds ?? [],
		priorityLabel: issue.priorityLabel ?? null,
		createdAt: issue.createdAt?.toISOString() ?? null,
		updatedAt: issue.updatedAt?.toISOString() ?? null,
	};
}

function isLikelyLinearId(value: string): boolean {
	if (ISSUE_IDENTIFIER_REGEX.test(value)) {
		return false;
	}
	return value.includes("-");
}

function toLinearApiError(error: unknown, fallback: string, operation?: string): LinearError {
	if (typeof error === "object" && error !== null && "_tag" in error) {
		return error as LinearError;
	}

	if (error && typeof error === "object") {
		const record = error as Record<string, unknown>;
		let status: number | undefined;
		if (typeof record.status === "number") {
			status = record.status;
		} else {
			const response = record.response as { status?: number } | undefined;
			if (response && typeof response.status === "number") {
				status = response.status;
			}
		}

		let message = fallback;
		if (typeof record.message === "string" && record.message.length > 0) {
			message = record.message;
		} else {
			const errors = record.errors as Array<{ message?: string }> | undefined;
			const firstMessage = errors?.find((e) => e.message)?.message;
			if (firstMessage) {
				message = `${fallback}: ${firstMessage}`;
			}
		}

		return LinearApiError(message, status, operation);
	}

	return LinearApiError(`${fallback}: ${String(error)}`, undefined, operation);
}

// -----------------------------------------------------------------------------
// Live Implementation
// -----------------------------------------------------------------------------

export const LinearClientLive: Layer.Layer<LinearClientService, LinearError, ConfigService> =
	Layer.effect(
		LinearClientService,
		Effect.gen(function* () {
			const profile = yield* getProfile();
			const apiKey = yield* getApiKey();

			const client = new LinearClient({
				apiKey,
				apiUrl: profile.apiHost,
			});

			// Access the underlying graphql client for mutations
			const graphqlClient = (client as unknown as { client?: GraphqlRequester }).client;

			const fetchIssue = (issueRef: string): Effect.Effect<LinearIssueEntity, LinearError> =>
				Effect.tryPromise({
					try: async () => {
						const trimmed = issueRef.trim();

						// Try by ID first if it looks like a Linear ID
						if (isLikelyLinearId(trimmed)) {
							const byId = client.issue(trimmed);
							if (byId) {
								const issueById = await byId;
								if (issueById) {
									return issueById as unknown as LinearIssueEntity;
								}
							}
						}

						// Fall back to search
						const searchResponse = await client.searchIssues(trimmed, { first: 1 });
						const match = (searchResponse as unknown as { nodes?: LinearIssueEntity[] })
							?.nodes?.[0];
						if (match) {
							return match;
						}

						throw new Error(`Issue ${trimmed} not found`);
					},
					catch: (error) =>
						toLinearApiError(error, `Failed to fetch issue ${issueRef}`, "getIssue"),
				});

			const fetchLabels = (
				issue: LinearIssueEntity,
			): Effect.Effect<IssueLabelSummary[], LinearError> =>
				Effect.tryPromise({
					try: async () => {
						if (typeof issue.labels !== "function") {
							return [];
						}
						const connection = await issue.labels({ first: DEFAULT_MAX_LIST_ITEMS });
						const nodes = connection?.nodes ?? [];
						return nodes.map((label) => ({
							id: label.id,
							name: label.name,
							color: label.color ?? null,
						}));
					},
					catch: (error) => toLinearApiError(error, "Failed to load labels", "fetchLabels"),
				});

			const fetchTeam = (
				issue: LinearIssueEntity,
			): Effect.Effect<{ id: string; name: string } | null, LinearError> =>
				Effect.tryPromise({
					try: async () => {
						if (typeof issue.team !== "function") {
							return null;
						}
						return issue.team();
					},
					catch: (error) => toLinearApiError(error, "Failed to load team", "fetchTeam"),
				});

			const fetchState = (
				issue: LinearIssueEntity,
			): Effect.Effect<{ id: string; name: string } | null, LinearError> =>
				Effect.tryPromise({
					try: async () => {
						if (typeof issue.state !== "function") {
							return null;
						}
						return issue.state();
					},
					catch: (error) => toLinearApiError(error, "Failed to load state", "fetchState"),
				});

			const fetchAssignee = (
				issue: LinearIssueEntity,
			): Effect.Effect<{ id: string; name: string } | null, LinearError> =>
				Effect.tryPromise({
					try: async () => {
						if (typeof issue.assignee !== "function") {
							return null;
						}
						return issue.assignee();
					},
					catch: (error) => toLinearApiError(error, "Failed to load assignee", "fetchAssignee"),
				});

			return LinearClientService.of({
				getIssue: (issueRef) => fetchIssue(issueRef).pipe(Effect.map(mapIssue)),

				getIssueDetails: (issueRef) =>
					Effect.gen(function* () {
						const issue = yield* fetchIssue(issueRef);
						const summary = mapIssue(issue);

						const [labels, team, state, assignee] = yield* Effect.all([
							fetchLabels(issue),
							fetchTeam(issue),
							fetchState(issue),
							fetchAssignee(issue),
						]);

						return {
							...summary,
							stateName: state?.name ?? null,
							assigneeName: assignee?.name ?? null,
							teamName: team?.name ?? null,
							labels,
						};
					}),

				listIssues: (options = {}) =>
					Effect.tryPromise({
						try: async () => {
							const filter: Record<string, unknown> = {};
							if (options.teamId) {
								filter.team = { id: { eq: options.teamId } };
							}
							if (options.stateId) {
								filter.state = { id: { eq: options.stateId } };
							}
							if (options.assigneeId) {
								filter.assignee = { id: { eq: options.assigneeId } };
							}

							const limit = options.projectId
								? DEFAULT_MAX_LIST_ITEMS * 2
								: (options.limit ?? DEFAULT_MAX_LIST_ITEMS);

							const response = await client.issues({
								filter: Object.keys(filter).length > 0 ? filter : undefined,
								first: limit,
								orderBy: "updatedAt" as PaginationOrderBy,
							});

							const nodes = (response as unknown as { nodes?: LinearIssueEntity[] })?.nodes ?? [];
							let mapped = nodes.map(mapIssue);

							// Client-side project filtering
							if (options.projectId) {
								mapped = mapped.filter((issue) => issue.projectId === options.projectId);
							}

							if (options.limit) {
								mapped = mapped.slice(0, options.limit);
							}

							return mapped;
						},
						catch: (error) => toLinearApiError(error, "Failed to list issues", "listIssues"),
					}),

				createIssue: (input) =>
					Effect.tryPromise({
						try: async () => {
							if (!graphqlClient) {
								throw new Error("GraphQL client not available");
							}

							const response = (await graphqlClient.request(LinearDocument.CreateIssueDocument, {
								input: {
									teamId: input.teamId,
									title: input.title,
									description: input.description ?? null,
									assigneeId: input.assigneeId,
									labelIds: input.labelIds,
									projectId: input.projectId,
								},
							})) as IssueCreateResponse;

							if (!response?.issueCreate?.success || !response?.issueCreate?.issue) {
								throw new Error("Linear API did not return created issue");
							}

							return mapIssue(response.issueCreate.issue);
						},
						catch: (error) => toLinearApiError(error, "Failed to create issue", "createIssue"),
					}),

				updateIssue: (issueId, input) =>
					Effect.tryPromise({
						try: async () => {
							if (!graphqlClient) {
								throw new Error("GraphQL client not available");
							}

							const response = (await graphqlClient.request(LinearDocument.UpdateIssueDocument, {
								id: issueId,
								input: {
									title: input.title,
									description: input.description ?? undefined,
									assigneeId: input.assigneeId,
									stateId: input.stateId,
									labelIds: input.labelIds,
								},
							})) as IssueUpdateResponse;

							if (!response?.issueUpdate?.success || !response?.issueUpdate?.issue) {
								throw new Error(`Linear API did not return updated issue ${issueId}`);
							}

							return mapIssue(response.issueUpdate.issue);
						},
						catch: (error) =>
							toLinearApiError(error, `Failed to update issue ${issueId}`, "updateIssue"),
					}),

				transitionIssue: (issueId, stateId) =>
					Effect.tryPromise({
						try: async () => {
							if (!graphqlClient) {
								throw new Error("GraphQL client not available");
							}

							const response = (await graphqlClient.request(LinearDocument.UpdateIssueDocument, {
								id: issueId,
								input: { stateId },
							})) as IssueUpdateResponse;

							if (!response?.issueUpdate?.success || !response?.issueUpdate?.issue) {
								throw new Error(`Failed to transition issue ${issueId}`);
							}

							return mapIssue(response.issueUpdate.issue);
						},
						catch: (error) =>
							toLinearApiError(error, `Failed to transition issue ${issueId}`, "transitionIssue"),
					}),

				createComment: (input) =>
					Effect.tryPromise({
						try: async () => {
							if (!graphqlClient) {
								throw new Error("GraphQL client not available");
							}

							const response = (await graphqlClient.request(LinearDocument.CreateCommentDocument, {
								input: {
									issueId: input.issueId,
									body: input.body,
								},
							})) as CommentCreateResponse;

							if (!response?.commentCreate?.success || !response?.commentCreate?.comment) {
								throw new Error("Failed to create comment");
							}

							return response.commentCreate.comment.id;
						},
						catch: (error) =>
							toLinearApiError(
								error,
								`Failed to comment on issue ${input.issueId}`,
								"createComment",
							),
					}),

				getWorkflowStates: (teamId) =>
					Effect.tryPromise({
						try: async () => {
							const response = await client.workflowStates({
								first: DEFAULT_MAX_LIST_ITEMS,
								filter: teamId ? { team: { id: { eq: teamId } } } : undefined,
							});

							interface WorkflowStateNode {
								id: string;
								name: string;
								type: string;
								team?: { id: string } | null;
							}

							const nodes = (response as unknown as { nodes?: WorkflowStateNode[] })?.nodes ?? [];
							return nodes.map((node) => ({
								id: node.id,
								name: node.name,
								type: node.type,
								teamId: node.team?.id ?? null,
							}));
						},
						catch: (error) =>
							toLinearApiError(error, "Failed to load workflow states", "getWorkflowStates"),
					}),

				getUsers: (_teamId) =>
					Effect.tryPromise({
						try: async () => {
							// Note: The Linear SDK doesn't support direct team filtering for users via the API
							// Users are fetched for the entire org and filtered client-side if needed
							const response = await client.users({
								first: DEFAULT_MAX_LIST_ITEMS,
							});

							interface UserNode {
								id: string;
								name: string;
								email?: string | null;
							}

							const nodes = (response as unknown as { nodes?: UserNode[] })?.nodes ?? [];
							return nodes.map((node) => ({
								id: node.id,
								name: node.name,
								email: node.email ?? null,
							}));
						},
						catch: (error) => toLinearApiError(error, "Failed to load users", "getUsers"),
					}),

				getTeams: () =>
					Effect.tryPromise({
						try: async () => {
							const response = await client.teams({ first: DEFAULT_MAX_LIST_ITEMS });

							interface TeamNode {
								id: string;
								name: string;
								key: string;
							}

							const nodes = (response as unknown as { nodes?: TeamNode[] })?.nodes ?? [];
							return nodes.map((node) => ({
								id: node.id,
								name: node.name,
								key: node.key,
							}));
						},
						catch: (error) => toLinearApiError(error, "Failed to load teams", "getTeams"),
					}),
			});
		}),
	);

// -----------------------------------------------------------------------------
// Accessor functions
// -----------------------------------------------------------------------------

export const getIssue = (
	issueRef: string,
): Effect.Effect<IssueSummary, LinearError, LinearClientService> =>
	Effect.flatMap(LinearClientService, (service) => service.getIssue(issueRef));

export const getIssueDetails = (
	issueRef: string,
): Effect.Effect<IssueDetails, LinearError, LinearClientService> =>
	Effect.flatMap(LinearClientService, (service) => service.getIssueDetails(issueRef));

export const listIssues = (
	options?: IssueListOptions,
): Effect.Effect<IssueSummary[], LinearError, LinearClientService> =>
	Effect.flatMap(LinearClientService, (service) => service.listIssues(options));

export const createIssue = (
	input: IssueCreateInput,
): Effect.Effect<IssueSummary, LinearError, LinearClientService> =>
	Effect.flatMap(LinearClientService, (service) => service.createIssue(input));

export const updateIssue = (
	issueId: string,
	input: IssueUpdateInput,
): Effect.Effect<IssueSummary, LinearError, LinearClientService> =>
	Effect.flatMap(LinearClientService, (service) => service.updateIssue(issueId, input));

export const transitionIssue = (
	issueId: string,
	stateId: string,
): Effect.Effect<IssueSummary, LinearError, LinearClientService> =>
	Effect.flatMap(LinearClientService, (service) => service.transitionIssue(issueId, stateId));

export const createComment = (
	input: CommentInput,
): Effect.Effect<string, LinearError, LinearClientService> =>
	Effect.flatMap(LinearClientService, (service) => service.createComment(input));

export const getWorkflowStates = (
	teamId?: string,
): Effect.Effect<WorkflowStateSummary[], LinearError, LinearClientService> =>
	Effect.flatMap(LinearClientService, (service) => service.getWorkflowStates(teamId));

export const getUsers = (
	teamId?: string,
): Effect.Effect<UserSummary[], LinearError, LinearClientService> =>
	Effect.flatMap(LinearClientService, (service) => service.getUsers(teamId));

export const getTeams = (): Effect.Effect<TeamSummary[], LinearError, LinearClientService> =>
	Effect.flatMap(LinearClientService, (service) => service.getTeams());
