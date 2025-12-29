import { describe, expect, test } from "bun:test";

import { runTest, runTestExit } from "../../test/layers";
import { resolveStateIdEffect, resolveAssigneeIdEffect } from "./helpers";

describe("resolveStateIdEffect", () => {
	test("returns undefined for undefined input", async () => {
		const result = await runTest(resolveStateIdEffect(undefined));
		expect(result).toBeUndefined();
	});

	test("resolves by exact ID match", async () => {
		const result = await runTest(resolveStateIdEffect("state-in-progress"), {
			linearClient: {
				workflowStates: [
					{ id: "state-in-progress", name: "In Progress", type: "started", teamId: "team-eng" },
				],
			},
		});
		expect(result).toBe("state-in-progress");
	});

	test("resolves by name (case insensitive)", async () => {
		const result = await runTest(resolveStateIdEffect("in progress"), {
			linearClient: {
				workflowStates: [
					{ id: "state-in-progress", name: "In Progress", type: "started", teamId: "team-eng" },
				],
			},
		});
		expect(result).toBe("state-in-progress");
	});

	test("fails with ResolverError for unknown state", async () => {
		const result = await runTestExit(resolveStateIdEffect("nonexistent"), {
			linearClient: {
				workflowStates: [
					{ id: "state-in-progress", name: "In Progress", type: "started", teamId: "team-eng" },
				],
			},
		});
		expect(result.success).toBe(false);
		const error = result.error as { _tag?: string; message?: string };
		expect(error._tag).toBe("ResolverError");
		expect(error.message).toContain("Unknown workflow state");
	});
});

describe("resolveAssigneeIdEffect", () => {
	test("returns undefined for undefined input", async () => {
		const result = await runTest(resolveAssigneeIdEffect(undefined));
		expect(result).toBeUndefined();
	});

	test("resolves by exact ID match", async () => {
		const result = await runTest(resolveAssigneeIdEffect("user-alice"), {
			linearClient: {
				users: [{ id: "user-alice", name: "Alice", email: "alice@test.com" }],
			},
		});
		expect(result).toBe("user-alice");
	});

	test("resolves by name (case insensitive)", async () => {
		const result = await runTest(resolveAssigneeIdEffect("alice"), {
			linearClient: {
				users: [{ id: "user-alice", name: "Alice", email: "alice@test.com" }],
			},
		});
		expect(result).toBe("user-alice");
	});

	test("resolves by email (case insensitive)", async () => {
		const result = await runTest(resolveAssigneeIdEffect("ALICE@TEST.COM"), {
			linearClient: {
				users: [{ id: "user-alice", name: "Alice", email: "alice@test.com" }],
			},
		});
		expect(result).toBe("user-alice");
	});

	test("fails with ResolverError for unknown user", async () => {
		const result = await runTestExit(resolveAssigneeIdEffect("unknown-user"), {
			linearClient: {
				users: [{ id: "user-alice", name: "Alice", email: "alice@test.com" }],
			},
		});
		expect(result.success).toBe(false);
		const error = result.error as { _tag?: string; message?: string };
		expect(error._tag).toBe("ResolverError");
		expect(error.message).toContain("Unknown assignee");
	});
});

describe("normalizeOptionString", () => {
	// This is tested implicitly through other tests
});
