import { describe, expect, test } from "bun:test";

import { LinearApiErrorClass as LinearApiError } from "../errors";
import { MetadataCache } from "./cache";
import type { IssueLabelSummary, LinearServiceOptions } from "./client";
import {
	type CommentInput,
	type IssueCreateInput,
	type IssueListOptions,
	type IssueUpdateInput,
	LinearService,
} from "./client";

interface MockIssue {
	labels?: (variables?: Record<string, unknown>) => Promise<{ nodes: IssueLabelSummary[] }>;
	team?: () => Promise<{ id: string; name: string } | null>;
	id: string;
	identifier: string;
	title: string;
	url: string;
	description?: string | null;
	branchName?: string | null;
	stateId?: string | null;
	assigneeId?: string | null;
	teamId?: string | null;
	labelIds: string[];
	priorityLabel?: string | null;
	createdAt?: Date;
	updatedAt?: Date;
}

class MockLinearClient {
	issueResponses = new Map<string, MockIssue>();
	searchQueue: Array<{ nodes: MockIssue[] }> = [];
	issuesQueue: Array<{ nodes: MockIssue[] }> = [];
	issueCreateQueue: Array<{ success: boolean; issue?: MockIssue | null }> = [];
	issueUpdateQueue: Array<{ success: boolean; issue?: MockIssue | null }> = [];
	commentCreateQueue: Array<{
		success: boolean;
		comment?: { id: string } | null;
	}> = [];
	workflowStatesQueue: Array<{
		nodes: Array<{ id: string; name: string; team?: { id: string } | null }>;
	}> = [];
	usersQueue: Array<{
		nodes: Array<{ id: string; name: string; email?: string | null }>;
	}> = [];
	issueFilterCalls: IssueListOptions[] = [];

	issueCalls: string[] = [];
	issueSearchCalls: Array<Record<string, unknown>> = [];

	issue(id: string) {
		this.issueCalls.push(id);
		const value = this.issueResponses.get(id);
		if (!value) {
			return undefined;
		}
		return Promise.resolve(value);
	}

	issueSearch(variables: Record<string, unknown>) {
		this.issueSearchCalls.push(variables);
		const next = this.searchQueue.shift() ?? { nodes: [] };
		return Promise.resolve(next);
	}

	searchIssues(query: string, variables?: Record<string, unknown>) {
		this.issueSearchCalls.push({ query, ...variables });
		const next = this.searchQueue.shift() ?? { nodes: [] };
		return Promise.resolve(next);
	}

	issues(variables: Record<string, unknown>) {
		this.issueFilterCalls.push({
			teamId: (variables.filter as { team?: { id?: { eq?: string } } })?.team?.id?.eq,
			stateId: (variables.filter as { state?: { id?: { eq?: string } } })?.state?.id?.eq,
			assigneeId: (variables.filter as { assignee?: { id?: { eq?: string } } })?.assignee?.id?.eq,
			limit: variables.first as number | undefined,
		});
		const next = this.issuesQueue.shift() ?? { nodes: [] };
		return Promise.resolve(next);
	}

	issueCreate(variables: { input: Record<string, unknown> }) {
		const next = this.issueCreateQueue.shift() ?? { success: false };
		if (next.success && !next.issue) {
			next.issue = createMockIssue({
				id: "created-1",
				identifier: "ENG-100",
				title: variables.input.title as string,
				teamId: variables.input.teamId as string,
			});
		}
		return Promise.resolve(next);
	}

	issueUpdate(variables: { id: string; input: Record<string, unknown> }) {
		const next = this.issueUpdateQueue.shift() ?? {
			success: true,
			issue: createMockIssue({
				id: variables.id,
				identifier: "ENG-1",
				title: "updated",
			}),
		};
		return Promise.resolve(next);
	}

	commentCreate(variables: { input: Record<string, unknown> }) {
		const next = this.commentCreateQueue.shift() ?? {
			success: true,
			comment: { id: `comment-${variables.input.issueId as string}` },
		};
		return Promise.resolve(next);
	}

	workflowStates() {
		const next = this.workflowStatesQueue.shift() ?? { nodes: [] };
		return Promise.resolve(next);
	}

	users() {
		const next = this.usersQueue.shift() ?? { nodes: [] };
		return Promise.resolve(next);
	}

	request(document: unknown, variables: Record<string, unknown>) {
		// Handle GraphQL mutations based on the document type
		// Check the document object for mutation name
		const docName =
			(document as { definitions?: Array<{ name?: { value?: string } }> })?.definitions?.[0]?.name
				?.value ?? "";

		const input = variables.input as Record<string, unknown> | undefined;

		if (docName === "createIssue") {
			const next = this.issueCreateQueue.shift() ?? { success: false };
			if (next.success && !next.issue) {
				next.issue = createMockIssue({
					id: "created-1",
					identifier: "ENG-100",
					title: input?.title as string,
					teamId: input?.teamId as string,
				});
			}
			return Promise.resolve({ issueCreate: next });
		}

		if (docName === "updateIssue") {
			const next = this.issueUpdateQueue.shift() ?? {
				success: true,
				issue: createMockIssue({
					id: variables.id as string,
					identifier: "ENG-1",
					title: "updated",
				}),
			};
			return Promise.resolve({ issueUpdate: next });
		}

		if (docName === "createComment") {
			const next = this.commentCreateQueue.shift() ?? {
				success: true,
				comment: { id: `comment-${input?.issueId as string}` },
			};
			return Promise.resolve({ commentCreate: next });
		}

		return Promise.resolve({});
	}
}

const MOCK_ISSUE_ID = "8b242793-5945-4e9a-9dd1-1234567890ab";

function createMockIssue(overrides: Partial<MockIssue> = {}): MockIssue {
	return {
		id: MOCK_ISSUE_ID,
		identifier: "ENG-1",
		title: "Sample issue",
		url: "https://linear.app/issue/ENG-1",
		description: "Description",
		branchName: "eng-1-sample-issue",
		stateId: "state-1",
		assigneeId: "user-1",
		teamId: "team-1",
		labelIds: ["label-1"],
		priorityLabel: "High",
		createdAt: new Date("2024-01-01T00:00:00Z"),
		updatedAt: new Date("2024-01-02T00:00:00Z"),
		...overrides,
	};
}

function createService(overrides: Partial<{ cache: MetadataCache | null }> = {}) {
	const client = new MockLinearClient();
	const service = new LinearService({
		config: {
			apiKey: "test",
			apiHost: "https://api.linear.app/graphql",
			output: "json",
			defaults: {},
			paths: {},
		},
		cache: overrides.cache ?? null,
		client: client as unknown as LinearServiceOptions["client"],
		maxListItems: 25,
	});

	return { service, client };
}

describe("LinearService", () => {
	test("getIssue returns mapped summary", async () => {
		const { service, client } = createService();
		const mockIssue = createMockIssue();
		client.issueResponses.set(MOCK_ISSUE_ID, mockIssue);

		const result = await service.getIssue(MOCK_ISSUE_ID);
		expect(result.title).toBe("Sample issue");
	});

	test("getIssue falls back to search", async () => {
		const { service, client } = createService();
		const mockIssue = createMockIssue({ identifier: "ENG-99" });
		client.searchQueue.push({ nodes: [mockIssue] });

		const result = await service.getIssue("ENG-99");
		expect(client.issueSearchCalls[0]).toMatchObject({ query: "ENG-99" });
		expect(result.identifier).toBe("ENG-99");
	});

	test("getIssueDetails resolves labels and names", async () => {
		const cacheHome = new MetadataCache({ enabled: false });
		const { service, client } = createService({ cache: cacheHome });
		const mockIssue = createMockIssue();
		mockIssue.labels = () =>
			Promise.resolve({
				nodes: [{ id: "label-1", name: "Bug", color: "#ff0000" }],
			});
		mockIssue.team = () => Promise.resolve({ id: "team-1", name: "Engineering" });
		client.issueResponses.set(MOCK_ISSUE_ID, mockIssue);
		client.workflowStatesQueue.push({
			nodes: [{ id: "state-1", name: "In Progress", team: { id: "team-1" } }],
		});
		client.usersQueue.push({
			nodes: [{ id: "user-1", name: "Alice", email: "alice@example.com" }],
		});

		const details = await service.getIssueDetails(MOCK_ISSUE_ID);
		expect(details.stateName).toBe("In Progress");
		expect(details.assigneeName).toBe("Alice");
		expect(details.labels[0]).toEqual({
			id: "label-1",
			name: "Bug",
			color: "#ff0000",
		});
		expect(details.teamName).toBe("Engineering");
	});

	test("listIssues applies filters", async () => {
		const { service, client } = createService();
		client.issuesQueue.push({ nodes: [createMockIssue()] });

		const options: IssueListOptions = {
			teamId: "team-2",
			stateId: "state-5",
			assigneeId: "user-3",
			limit: 10,
		};
		const results = await service.listIssues(options);
		expect(results).toHaveLength(1);
		expect(client.issueFilterCalls[0]).toMatchObject(options);
	});

	test("createIssue forwards payload", async () => {
		const { service, client } = createService();
		const input: IssueCreateInput = {
			teamId: "team-1",
			title: "New issue",
			description: "body",
			assigneeId: "user-1",
		};
		client.issueCreateQueue.push({
			success: true,
			issue: createMockIssue({ title: "New issue" }),
		});

		const created = await service.createIssue(input);
		expect(created.title).toBe("New issue");
	});

	test("updateIssue returns updated summary", async () => {
		const { service, client } = createService();
		const input: IssueUpdateInput = { title: "Updated" };
		client.issueUpdateQueue.push({
			success: true,
			issue: createMockIssue({ title: "Updated" }),
		});

		const updated = await service.updateIssue(MOCK_ISSUE_ID, input);
		expect(updated.title).toBe("Updated");
	});

	test("createComment returns comment id", async () => {
		const { service } = createService();
		const input: CommentInput = { issueId: MOCK_ISSUE_ID, body: "Hello" };

		const commentId = await service.createComment(input);
		expect(commentId).toBe(`comment-${input.issueId}`);
	});

	test("getIssue throws when issue missing", () => {
		const { service, client } = createService();
		client.searchQueue.push({ nodes: [] });

		return expect(service.getIssue("unknown")).rejects.toBeInstanceOf(LinearApiError);
	});
});
