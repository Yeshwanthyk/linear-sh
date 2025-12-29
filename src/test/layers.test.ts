import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { getConfig, getIssue, getTeams, listIssues } from "../services";
import {
	createMockOutputCapture,
	mockConfig,
	mockIssueSummary,
	runTest,
	runTestExit,
} from "./index";

describe("Test Infrastructure", () => {
	test("runTest executes effects with mocked services", async () => {
		const result = await runTest(
			Effect.gen(function* () {
				const config = yield* getConfig();
				return config.activeProfile;
			}),
		);

		expect(result).toBe("test");
	});

	test("MockLinearClientLayer provides mock issue data", async () => {
		const result = await runTest(
			Effect.gen(function* () {
				const issues = yield* listIssues();
				return issues;
			}),
		);

		expect(result.length).toBeGreaterThan(0);
		expect(result[0]?.identifier).toBeDefined();
	});

	test("MockLinearClientLayer can be customized", async () => {
		const customIssue = mockIssueSummary({
			id: "custom-123",
			identifier: "CUSTOM-1",
			title: "Custom Issue",
		});

		const result = await runTest(
			Effect.gen(function* () {
				const issue = yield* getIssue("custom-123");
				return issue;
			}),
			{
				linearClient: {
					issues: [customIssue],
				},
			},
		);

		expect(result.identifier).toBe("CUSTOM-1");
		expect(result.title).toBe("Custom Issue");
	});

	test("runTestExit captures failures", async () => {
		const result = await runTestExit(
			Effect.gen(function* () {
				const issue = yield* getIssue("nonexistent-issue");
				return issue;
			}),
		);

		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});

	test("MockOutputLayer captures output", async () => {
		const capture = createMockOutputCapture();

		// The capture object gets populated when OutputService methods are called
		// This just verifies the capture setup works
		expect(capture.writes).toBeDefined();
		expect(capture.successes).toBeDefined();
		expect(capture.errors).toBeDefined();
	});

	test("config can be customized", async () => {
		const customConfig = {
			...mockConfig,
			activeProfile: "custom-profile",
		};

		const result = await runTest(
			Effect.gen(function* () {
				const config = yield* getConfig();
				return config.activeProfile;
			}),
			{ config: customConfig },
		);

		expect(result).toBe("custom-profile");
	});

	test("teams mock returns default teams", async () => {
		const result = await runTest(
			Effect.gen(function* () {
				const teams = yield* getTeams();
				return teams;
			}),
		);

		expect(result.length).toBeGreaterThan(0);
		expect(result[0]?.key).toBe("ENG");
	});
});
