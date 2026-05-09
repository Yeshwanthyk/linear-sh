import { describe, expect, test } from "bun:test";

import {
	getIssueDetails,
	listIssues,
	createIssue,
	updateIssue,
	getLabels,
	type IssueCreateInput,
	type IssueUpdateInput,
} from "../../services";
import { IssueCreateCommand } from "./create";
import { runTest, runTestExit } from "../../test/layers";
import { mockIssueSummary, mockIssueDetails, defaultMockIssues } from "../../test/mocks/linear";

// -----------------------------------------------------------------------------
// IssueViewCommand tests
// -----------------------------------------------------------------------------

describe("IssueViewCommand", () => {
	test("getIssueDetails returns issue with details", async () => {
		const result = await runTest(getIssueDetails("TEST-123"), {
			linearClient: {
				issueDetails: mockIssueDetails({
					identifier: "TEST-123",
					title: "Test Issue",
					stateName: "In Progress",
					assigneeName: "Alice",
				}),
			},
		});

		expect(result.identifier).toBe("TEST-123");
		expect(result.title).toBe("Test Issue");
		expect(result.stateName).toBe("In Progress");
		expect(result.assigneeName).toBe("Alice");
	});
});

// -----------------------------------------------------------------------------
// IssueListCommand tests
// -----------------------------------------------------------------------------

describe("IssueListCommand", () => {
	test("listIssues returns filtered issues by team", async () => {
		const testIssues = [
			mockIssueSummary({ identifier: "ENG-1", teamId: "team-eng" }),
			mockIssueSummary({ identifier: "DES-1", teamId: "team-design" }),
			mockIssueSummary({ identifier: "ENG-2", teamId: "team-eng" }),
		];

		const result = await runTest(listIssues({ teamId: "team-eng" }), {
			linearClient: { issues: testIssues },
		});

		expect(result).toHaveLength(2);
		expect(result.every((i) => i.teamId === "team-eng")).toBe(true);
	});

	test("listIssues returns filtered issues by state", async () => {
		const testIssues = [
			mockIssueSummary({ identifier: "ENG-1", stateId: "state-in-progress" }),
			mockIssueSummary({ identifier: "ENG-2", stateId: "state-done" }),
			mockIssueSummary({ identifier: "ENG-3", stateId: "state-in-progress" }),
		];

		const result = await runTest(listIssues({ stateId: "state-in-progress" }), {
			linearClient: { issues: testIssues },
		});

		expect(result).toHaveLength(2);
		expect(result.every((i) => i.stateId === "state-in-progress")).toBe(true);
	});

	test("listIssues respects limit", async () => {
		const result = await runTest(listIssues({ limit: 2 }), {
			linearClient: { issues: defaultMockIssues },
		});

		expect(result).toHaveLength(2);
	});

	test("listIssues returns empty array when no matches", async () => {
		const result = await runTest(listIssues({ teamId: "nonexistent" }), {
			linearClient: { issues: defaultMockIssues },
		});

		expect(result).toHaveLength(0);
	});
});

// -----------------------------------------------------------------------------
// IssueCreateCommand tests
// -----------------------------------------------------------------------------

describe("IssueCreateCommand", () => {
	test("createIssue sends correct payload", async () => {
		let capturedInput: IssueCreateInput | undefined;

		const result = await runTest(
			createIssue({
				teamId: "team-eng",
				title: "New Issue",
				description: "Test description",
			}),
			{
				linearClient: {
					onCreateIssue: (input) => {
						capturedInput = input;
						return mockIssueSummary({
							identifier: "ENG-999",
							title: input.title,
							teamId: input.teamId,
						});
					},
				},
			},
		);

		expect(capturedInput).toBeDefined();
		expect(capturedInput?.teamId).toBe("team-eng");
		expect(capturedInput?.title).toBe("New Issue");
		expect(result.identifier).toBe("ENG-999");
	});

	test("createIssue includes optional fields", async () => {
		let capturedInput: IssueCreateInput | undefined;

		await runTest(
			createIssue({
				teamId: "team-eng",
				title: "New Issue",
				assigneeId: "user-alice",
				labelIds: ["label-1", "label-2"],
				projectId: "project-1",
			}),
			{
				linearClient: {
					onCreateIssue: (input) => {
						capturedInput = input;
						return mockIssueSummary({ identifier: "ENG-999" });
					},
				},
			},
		);

		expect(capturedInput?.assigneeId).toBe("user-alice");
		expect(capturedInput?.labelIds).toEqual(["label-1", "label-2"]);
		expect(capturedInput?.projectId).toBe("project-1");
	});

	test("explicit different team does not inherit default project", async () => {
		const command = new IssueCreateCommand();
		command.title = "New Issue";
		command.description = "Test description";
		command.team = "team-support";

		const input = await runTest(
			(
				command as unknown as { collectInputEffect: () => ReturnType<typeof createIssue> }
			).collectInputEffect(),
			{
				config: {
					activeProfile: "test",
					profile: {
						apiKey: "test-api-key",
						apiHost: "https://api.linear.app/graphql",
						defaults: {
							teamId: "team-eng",
							projectId: "project-eng",
						},
					},
					output: "plain",
					paths: {
						configDir: "/tmp/linear-sh-test",
						configFile: "/tmp/linear-sh-test/config.json",
						cacheDir: "/tmp/linear-sh-test/cache",
						activeProfileFile: "/tmp/linear-sh-test/active-profile",
					},
				},
			},
		);

		expect(input.teamId).toBe("team-support");
		expect(input.projectId).toBeUndefined();
	});
});

// -----------------------------------------------------------------------------
// LabelListCommand behavior
// -----------------------------------------------------------------------------

describe("LabelListCommand", () => {
	const labels = [
		{ id: "label-workspace", name: "Sentry", color: "#000000", teamId: null },
		{ id: "label-eng", name: "Backend", color: "#111111", teamId: "team-eng" },
		{ id: "label-support", name: "Support", color: "#222222", teamId: "team-support" },
	];

	test("getLabels without team returns all labels", async () => {
		const result = await runTest(getLabels(), {
			linearClient: { labels },
		});

		expect(result.map((label) => label.id)).toEqual([
			"label-workspace",
			"label-eng",
			"label-support",
		]);
	});

	test("getLabels with team returns workspace and team labels", async () => {
		const result = await runTest(getLabels("team-support"), {
			linearClient: { labels },
		});

		expect(result.map((label) => label.id)).toEqual(["label-workspace", "label-support"]);
	});
});

// -----------------------------------------------------------------------------
// IssueUpdateCommand tests
// -----------------------------------------------------------------------------

describe("IssueUpdateCommand", () => {
	test("updateIssue updates fields correctly", async () => {
		let capturedId: string | undefined;
		let capturedInput: IssueUpdateInput | undefined;

		const result = await runTest(
			updateIssue("issue-123", {
				title: "Updated Title",
				stateId: "state-done",
			}),
			{
				linearClient: {
					onUpdateIssue: (issueId, input) => {
						capturedId = issueId;
						capturedInput = input;
						return mockIssueSummary({
							id: issueId,
							title: input.title ?? "Test",
							stateId: input.stateId ?? null,
						});
					},
				},
			},
		);

		expect(capturedId).toBe("issue-123");
		expect(capturedInput?.title).toBe("Updated Title");
		expect(capturedInput?.stateId).toBe("state-done");
		expect(result.title).toBe("Updated Title");
	});
});

// -----------------------------------------------------------------------------
// Error handling tests
// -----------------------------------------------------------------------------

describe("Error handling", () => {
	test("getIssueDetails fails for nonexistent issue", async () => {
		const result = await runTestExit(getIssueDetails("NONEXISTENT-999"), {
			linearClient: { issues: [] },
		});

		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});

	test("errors preserve _tag for type identification", async () => {
		const result = await runTestExit(getIssueDetails("NONEXISTENT-999"), {
			linearClient: { issues: [] },
		});

		expect(result.success).toBe(false);
		// The error should have a _tag property
		const error = result.error as { _tag?: string };
		expect(error._tag).toBe("LinearApiError");
	});
});

// -----------------------------------------------------------------------------
// Test helper exports (for reference in other tests)
// -----------------------------------------------------------------------------

export { mockIssueSummary, mockIssueDetails };
