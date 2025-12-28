import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
	ConfigError,
	REPO_CONFIG_FILENAME,
	USER_CONFIG_RELATIVE_PATH,
	loadLinearConfig,
} from "./config";

let tempDir: string;

beforeEach(() => {
	tempDir = mkdtempSync(path.join(os.tmpdir(), "linear-config-"));
});

afterEach(() => {
	rmSync(tempDir, { recursive: true, force: true });
});

describe("loadLinearConfig", () => {
	test("merges config sources with correct precedence", () => {
		const homeDir = path.join(tempDir, "home");
		const userConfigPath = path.join(homeDir, USER_CONFIG_RELATIVE_PATH);
		writeFileRecursive(
			userConfigPath,
			JSON.stringify({
				apiKey: "user-key",
				output: "json",
				defaults: {
					teamId: "user-team",
					workflowStateId: "user-state",
				},
			}),
		);

		const projectRoot = path.join(tempDir, "project");
		const nestedCwd = path.join(projectRoot, "packages", "cli");
		mkdirSync(nestedCwd, { recursive: true });
		writeFileRecursive(
			path.join(projectRoot, REPO_CONFIG_FILENAME),
			JSON.stringify({
				apiKey: "repo-key",
				defaults: {
					teamId: "repo-team",
					workflowStateId: "repo-state",
				},
			}),
		);

		const env: NodeJS.ProcessEnv = {
			LINEAR_API_KEY: "env-key",
			LINEAR_DEFAULT_ASSIGNEE_ID: "env-assignee",
			LINEAR_OUTPUT: "plain",
		};

		const config = loadLinearConfig({
			cwd: nestedCwd,
			env,
			homeDir,
			requireApiKey: false,
		});

		expect(config.apiKey).toBe("env-key");
		expect(config.output).toBe("plain");
		expect(config.apiHost).toBe("https://api.linear.app/graphql");
		expect(config.defaults).toEqual({
			teamId: "repo-team",
			workflowStateId: "repo-state",
			assigneeId: "env-assignee",
		});
		expect(config.paths.userFile).toBe(userConfigPath);
		expect(config.paths.repoFile).toBe(path.join(projectRoot, REPO_CONFIG_FILENAME));
	});

	test("throws when API key missing and requireApiKey is true", () => {
		expect(() =>
			loadLinearConfig({
				cwd: tempDir,
				homeDir: tempDir,
				env: {},
				requireApiKey: true,
			}),
		).toThrow(ConfigError);
	});

	test("raises ConfigError on invalid JSON file", () => {
		const homeDir = path.join(tempDir, "home-invalid");
		const badConfig = path.join(homeDir, USER_CONFIG_RELATIVE_PATH);
		writeFileRecursive(badConfig, "{ not-json");

		expect(() =>
			loadLinearConfig({
				cwd: tempDir,
				homeDir,
				env: {},
				requireApiKey: false,
			}),
		).toThrow(ConfigError);
	});
});

function writeFileRecursive(filePath: string, contents: string) {
	const directory = path.dirname(filePath);
	mkdirSync(directory, { recursive: true });
	writeFileSync(filePath, contents, "utf8");
}
