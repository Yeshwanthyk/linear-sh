import { describe, expect, test } from "bun:test";

import { extractIssueKeyFromBranch, sanitizeBranchName } from "./branch";

describe("branch utilities", () => {
	test("extractIssueKeyFromBranch finds identifier", () => {
		expect(extractIssueKeyFromBranch("feature/eng-1234-linear-cli")).toBe(
			"ENG-1234",
		);
		expect(extractIssueKeyFromBranch("fix/ENG-99")).toBe("ENG-99");
		expect(extractIssueKeyFromBranch("no-key")).toBeNull();
	});

	test("sanitizeBranchName normalizes strings", () => {
		expect(sanitizeBranchName("New Feature!")).toBe("new-feature");
		expect(sanitizeBranchName("  Multiple   Spaces  ")).toBe("multiple-spaces");
		expect(sanitizeBranchName("Already-clean")).toBe("already-clean");
	});
});
