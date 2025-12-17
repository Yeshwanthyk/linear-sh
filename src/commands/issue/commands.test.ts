import { afterEach, describe, expect, test } from "bun:test";

import { LinearApiErrorClass as LinearApiError } from "../../errors";
import type { IssueDetails, IssueSummary } from "../../linear/client";
import { BaseCommand } from "../base-command";
import type { CommandContext } from "../base-command";
import { IssueCreateCommand } from "./create";
import { IssueIdCommand } from "./id";
import { IssueListCommand } from "./list";
import { IssuePrCommand } from "./pr";
import { IssueStartCommand } from "./start";
import { IssueTitleCommand } from "./title";
import { IssueUpdateCommand } from "./update";
import { IssueUrlCommand } from "./url";
import { IssueViewCommand } from "./view";

afterEach(() => {
	BaseCommand.setContextFactory(undefined);
});

describe("IssueViewCommand", () => {
	test("prints issue details", async () => {
		const { context, writes } = createTestContext({
			service: {
				getIssueDetails: () => Promise.resolve(createIssueDetails()),
			},
		});

		BaseCommand.setContextFactory(() => Promise.resolve(context));
		const command = new IssueViewCommand();
		command.issueRef = "ENG-1";

		const result = await command.execute();
		expect(result).toBe(0);
		expect(writes.join("\n")).toContain("ENG-1");
	});
});

describe("IssueListCommand", () => {
	test("outputs JSON list", async () => {
		const issues: IssueSummary[] = [
			{
				id: "1",
				identifier: "ENG-1",
				title: "First",
				url: "",
				description: null,
				branchName: null,
				stateId: "state-1",
				assigneeId: "user-1",
				teamId: "team-1",
				labelIds: [],
				priorityLabel: null,
				updatedAt: null,
				createdAt: null,
			},
		];

		const { context, writes } = createTestContext({
			service: {
				listIssues: () => Promise.resolve(issues),
				getWorkflowStates: () =>
					Promise.resolve([
						{ id: "state-1", name: "In Progress", teamId: "team-1" },
					]),
				getUsers: () =>
					Promise.resolve([
						{ id: "user-1", name: "Alice", email: "alice@example.com" },
					]),
			},
		});

		BaseCommand.setContextFactory(() => Promise.resolve(context));
		const command = new IssueListCommand();
		command.json = true;

		const result = await command.execute();
		expect(result).toBe(0);
		expect(JSON.parse(writes[0]).issues[0].identifier).toBe("ENG-1");
	});

	test("uses config default team when no --team flag provided", async () => {
		const callsToListIssues: unknown[] = [];
		const { context, writes } = createTestContext({
			config: {
				defaults: {
					teamId: "config-team-1",
				},
			},
			service: {
				listIssues: (options: unknown) => {
					callsToListIssues.push(options);
					return Promise.resolve([]);
				},
				getWorkflowStates: () => Promise.resolve([]),
				getUsers: () => Promise.resolve([]),
			},
		});

		BaseCommand.setContextFactory(() => Promise.resolve(context));
		const command = new IssueListCommand();
		command.json = true;

		const result = await command.execute();
		expect(result).toBe(0);
		expect(
			(callsToListIssues[0] as { teamId: string | undefined }).teamId,
		).toBe("config-team-1");
	});

	test("uses config default state when no --state flag provided", async () => {
		const callsToListIssues: unknown[] = [];
		const { context, writes } = createTestContext({
			config: {
				defaults: {
					teamId: "config-team-1",
					workflowStateId: "config-state-1",
				},
			},
			service: {
				listIssues: (options: unknown) => {
					callsToListIssues.push(options);
					return Promise.resolve([]);
				},
				getWorkflowStates: () => Promise.resolve([]),
				getUsers: () => Promise.resolve([]),
			},
		});

		BaseCommand.setContextFactory(() => Promise.resolve(context));
		const command = new IssueListCommand();
		command.json = true;

		const result = await command.execute();
		expect(result).toBe(0);
		expect(
			(callsToListIssues[0] as { stateId: string | undefined }).stateId,
		).toBe("config-state-1");
	});

	test("overrides config default team when --team flag provided", async () => {
		const callsToListIssues: unknown[] = [];
		const { context, writes } = createTestContext({
			config: {
				defaults: {
					teamId: "config-team-1",
				},
			},
			service: {
				listIssues: (options: unknown) => {
					callsToListIssues.push(options);
					return Promise.resolve([]);
				},
				getWorkflowStates: () => Promise.resolve([]),
				getUsers: () => Promise.resolve([]),
			},
		});

		BaseCommand.setContextFactory(() => Promise.resolve(context));
		const command = new IssueListCommand();
		command.team = "explicit-team-1";
		command.json = true;

		const result = await command.execute();
		expect(result).toBe(0);
		expect(
			(callsToListIssues[0] as { teamId: string | undefined }).teamId,
		).toBe("explicit-team-1");
	});

	test("surfaces list failures", async () => {
		const { context, writes } = createTestContext({
			service: {
				listIssues: () => Promise.reject(new LinearApiError("List boom", 429)),
			},
		});

		BaseCommand.setContextFactory(() => Promise.resolve(context));
		const command = new IssueListCommand();

		const result = await command.execute();
		expect(result).toBe(1);
		expect(writes[writes.length - 1]).toContain(
			"ERROR:LinearApiError: List boom",
		);
	});
});

describe("Mutation commands", () => {
	test("IssueCreateCommand sends payload", async () => {
		const calls: unknown[] = [];
		const { context } = createTestContext({
			service: {
				createIssue: (input: unknown) => {
					calls.push(input);
					return Promise.resolve(createIssueSummary());
				},
			},
			config: {
				defaults: {
					teamId: "team-1",
				},
			},
		});

		BaseCommand.setContextFactory(() => Promise.resolve(context));
		const command = new IssueCreateCommand();
		command.title = "New feature";
		command.description = "Details";

		const result = await command.execute();
		expect(result).toBe(0);
		expect((calls[0] as { teamId: string }).teamId).toBe("team-1");
	});

	test("IssueCreateCommand surfaces service failures", async () => {
		const { context, writes } = createTestContext({
			service: {
				createIssue: () =>
					Promise.reject(new LinearApiError("Linear explosion", 500)),
			},
			config: {
				defaults: {
					teamId: "team-1",
				},
			},
		});

		BaseCommand.setContextFactory(() => Promise.resolve(context));
		const command = new IssueCreateCommand();
		command.title = "Failing issue";
		command.description = "Fails on purpose";

		const result = await command.execute();
		expect(result).toBe(1);
		expect(writes[writes.length - 1]).toContain(
			"ERROR:LinearApiError: Linear explosion",
		);
	});

	test("IssueUpdateCommand resolves fields", async () => {
		const updates: unknown[] = [];
		const { context } = createTestContext({
			service: {
				getIssue: () => Promise.resolve(createIssueSummary()),
				updateIssue: (_id: string, payload: unknown) => {
					updates.push(payload);
					return Promise.resolve(createIssueSummary());
				},
				createComment: () => Promise.resolve("comment-1"),
				getWorkflowStates: () =>
					Promise.resolve([
						{ id: "state-1", name: "In Progress", teamId: "team-1" },
					]),
				getUsers: () =>
					Promise.resolve([
						{ id: "user-1", name: "Alice", email: "alice@example.com" },
					]),
			},
		});

		BaseCommand.setContextFactory(() => Promise.resolve(context));
		const command = new IssueUpdateCommand();
		command.issueRef = "ENG-1";
		command.status = "In Progress";
		command.comment = "Starting";

		const result = await command.execute();
		expect(result).toBe(0);
		expect((updates[0] as { stateId: string }).stateId).toBe("state-1");
	});

	test("IssueStartCommand creates branch and updates issue", async () => {
		const updates: unknown[] = [];
		const { context } = createTestContext({
			service: {
				getIssue: () => Promise.resolve(createIssueSummary()),
				updateIssue: (_id: string, payload: unknown) => {
					updates.push(payload);
					return Promise.resolve(createIssueSummary());
				},
				getWorkflowStates: () =>
					Promise.resolve([
						{ id: "state-1", name: "In Progress", teamId: "team-1" },
					]),
				getUsers: () =>
					Promise.resolve([
						{ id: "user-1", name: "Alice", email: "alice@example.com" },
					]),
			},
		});

		const gitCalls: string[] = [];
		const originalGit = { ...IssueStartCommand.git };
		IssueStartCommand.git.branchExists = () => false;
		IssueStartCommand.git.createBranch = (branch) => {
			gitCalls.push(`create:${branch}`);
		};
		IssueStartCommand.git.checkoutBranch = (branch) => {
			gitCalls.push(`checkout:${branch}`);
		};

		BaseCommand.setContextFactory(() => Promise.resolve(context));
		const command = new IssueStartCommand();
		command.issueRef = "ENG-1";
		command.assign = true;

		const result = await command.execute();
		expect(result).toBe(0);
		expect(gitCalls[0]).toMatch(/create/);
		expect((updates[0] as { stateId: string }).stateId).toBe("state-1");

		IssueStartCommand.git.branchExists = originalGit.branchExists;
		IssueStartCommand.git.createBranch = originalGit.createBranch;
		IssueStartCommand.git.checkoutBranch = originalGit.checkoutBranch;
	});

	test("IssueStartCommand surfaces git failures", async () => {
		const { context, writes } = createTestContext({
			service: {
				getIssue: () => Promise.resolve(createIssueSummary()),
			},
		});

		const originalGit = { ...IssueStartCommand.git };
		IssueStartCommand.git.branchExists = () => false;
		IssueStartCommand.git.createBranch = () => {
			throw new Error("git blow up");
		};

		BaseCommand.setContextFactory(() => Promise.resolve(context));
		const command = new IssueStartCommand();
		command.issueRef = "ENG-1";

		const result = await command.execute();
		expect(result).toBe(1);
		expect(writes[writes.length - 1]).toContain("ERROR:Error: git blow up");

		IssueStartCommand.git.branchExists = originalGit.branchExists;
		IssueStartCommand.git.createBranch = originalGit.createBranch;
		IssueStartCommand.git.checkoutBranch = originalGit.checkoutBranch;
	});

	test("IssuePrCommand invokes gh", async () => {
		const invocations: string[][] = [];
		const originalRunGh = IssuePrCommand.runGh;
		IssuePrCommand.runGh = (args) => {
			invocations.push(args);
			return { status: 0 } as unknown as ReturnType<
				typeof IssuePrCommand.runGh
			>;
		};

		const { context } = createTestContext({
			service: {
				getIssueDetails: () => Promise.resolve(createIssueDetails()),
			},
		});

		BaseCommand.setContextFactory(() => Promise.resolve(context));
		const command = new IssuePrCommand();
		command.issueRef = "ENG-1";

		const result = await command.execute();
		expect(result).toBe(0);
		expect(invocations[0][0]).toBe("pr");

		IssuePrCommand.runGh = originalRunGh;
	});
});

describe("Scalar commands", () => {
	test("IssueIdCommand outputs identifier", async () => {
		const { context, writes } = createTestContext({
			service: {
				getIssue: () => Promise.resolve(createIssueSummary()),
			},
		});
		BaseCommand.setContextFactory(() => Promise.resolve(context));
		const command = new IssueIdCommand();
		command.issueRef = "ENG-1";
		command.json = false;

		await command.execute();
		expect(writes[0]).toBe("ENG-1");
	});

	test("IssueTitleCommand outputs title", async () => {
		const { context, writes } = createTestContext({
			service: {
				getIssue: () => Promise.resolve(createIssueSummary()),
			},
		});
		BaseCommand.setContextFactory(() => Promise.resolve(context));
		const command = new IssueTitleCommand();
		command.issueRef = "ENG-1";
		command.json = false;

		await command.execute();
		expect(writes[0]).toBe("Sample issue");
	});

	test("IssueUrlCommand outputs URL", async () => {
		const { context, writes } = createTestContext({
			service: {
				getIssue: () => Promise.resolve(createIssueSummary()),
			},
		});
		BaseCommand.setContextFactory(() => Promise.resolve(context));
		const command = new IssueUrlCommand();
		command.issueRef = "ENG-1";

		await command.execute();
		expect(writes[0]).toContain("https://linear.app");
	});
});

function createTestContext(
	overrides: {
		service?: Record<string, unknown>;
		config?: Partial<CommandContext["config"]>;
	} = {},
) {
	const writes: string[] = [];
	const output = {
		format: "plain" as const,
		write: (payload: unknown) => {
			writes.push(
				typeof payload === "string" ? payload : JSON.stringify(payload),
			);
		},
		success: (_message: string, data?: unknown) => {
			writes.push(JSON.stringify(data ?? {}));
		},
		info: (_message: string, data?: unknown) => {
			writes.push(JSON.stringify(data ?? {}));
		},
		warn: (message: string, data?: unknown) => {
			writes.push(`WARN:${message}` + (data ? JSON.stringify(data) : ""));
		},
		error: (error: unknown) => {
			writes.push(`ERROR:${String(error)}`);
		},
	};

	const logger = {
		debug: () => {},
		info: () => {},
		warn: () => {},
		error: () => {},
		child: () => logger,
	};

	const config = {
		apiKey: "test-key",
		apiHost: "https://api.linear.app/graphql",
		output: "plain" as const,
		defaults: {},
		paths: {},
		...(overrides.config ?? {}),
	};

	const service = {
		getIssueDetails: () => Promise.resolve(createIssueDetails()),
		getIssue: () => Promise.resolve(createIssueSummary()),
		listIssues: () => Promise.resolve([] as IssueSummary[]),
		createIssue: () => Promise.resolve(createIssueSummary()),
		updateIssue: () => Promise.resolve(createIssueSummary()),
		createComment: () => Promise.resolve("comment"),
		getWorkflowStates: () => Promise.resolve([]),
		getUsers: () => Promise.resolve([]),
		transitionIssue: () => Promise.resolve(createIssueSummary()),
		...((overrides.service ?? {}) as object),
	} as unknown as CommandContext["service"];

	const context: CommandContext = {
		config,
		output,
		logger: logger as never,
		service,
	};

	return { context, writes };
}

function createIssueSummary(
	overrides: Partial<IssueSummary> = {},
): IssueSummary {
	return {
		id: "issue-1",
		identifier: "ENG-1",
		title: "Sample issue",
		url: "https://linear.app/issue/ENG-1",
		description: "Description",
		branchName: "eng-1-sample-issue",
		stateId: "state-1",
		assigneeId: "user-1",
		teamId: "team-1",
		labelIds: [],
		priorityLabel: "High",
		updatedAt: null,
		createdAt: null,
		...overrides,
	};
}

function createIssueDetails(
	overrides: Partial<IssueDetails> = {},
): IssueDetails {
	return {
		...createIssueSummary(overrides),
		labels: [],
		stateName: "In Progress",
		assigneeName: "Alice",
		teamName: "Engineering",
		...overrides,
	};
}
