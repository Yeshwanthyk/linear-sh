import { describe, expect, test } from "bun:test";

import { sanitizeBranchName } from "./git";

describe("git utilities", () => {
	test("sanitizeBranchName normalizes strings", () => {
		expect(sanitizeBranchName("New Feature!")).toBe("new-feature");
		expect(sanitizeBranchName("  Multiple   Spaces  ")).toBe("multiple-spaces");
		expect(sanitizeBranchName("Already-clean")).toBe("already-clean");
		expect(sanitizeBranchName("ENG-123 Some Title")).toBe("eng-123-some-title");
	});

	test("sanitizeBranchName handles edge cases", () => {
		expect(sanitizeBranchName("")).toBe("");
		expect(sanitizeBranchName("---")).toBe("");
		expect(sanitizeBranchName("  ")).toBe("");
		expect(sanitizeBranchName("a---b")).toBe("a-b");
	});
});
