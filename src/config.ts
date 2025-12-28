import { readFileSync } from "node:fs";
import { existsSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { ConfigErrorClass as ConfigError } from "./errors";
export { ConfigErrorClass as ConfigError } from "./errors";

export interface ConfigPaths {
	readonly repoFile?: string;
	readonly userFile?: string;
}

export type OutputFormat = "plain" | "json";

export interface LinearConfigDefaults {
	teamId?: string;
	assigneeId?: string;
	workflowStateId?: string;
	projectId?: string;
}

export interface LinearConfig {
	apiKey: string;
	apiHost: string;
	output: OutputFormat;
	defaults: LinearConfigDefaults;
	paths: ConfigPaths;
}

export interface LoadConfigOptions {
	readonly cwd?: string;
	readonly env?: NodeJS.ProcessEnv;
	readonly homeDir?: string;
	readonly requireApiKey?: boolean;
}

type PartialConfig = Partial<Omit<LinearConfig, "defaults" | "paths">> & {
	defaults?: LinearConfigDefaults;
};

const DEFAULT_CONFIG: LinearConfig = {
	apiKey: "",
	apiHost: "https://api.linear.app/graphql",
	output: "plain",
	defaults: {},
	paths: {},
};

function isOutputFormat(value: unknown): value is OutputFormat {
	return value === "plain" || value === "json";
}

export const REPO_CONFIG_FILENAME = ".linearrc.json";
export const USER_CONFIG_RELATIVE_PATH = path.join(".config", "linear-sh", "config.json");

export function loadLinearConfig(options: LoadConfigOptions = {}): LinearConfig {
	const cwd = options.cwd ?? process.cwd();
	const env = options.env ?? process.env;
	const homeDir = options.homeDir ?? os.homedir();

	const { config: userConfig, filePath: userPath } = readConfigFile(
		path.join(homeDir, USER_CONFIG_RELATIVE_PATH),
	);
	const { config: repoConfig, filePath: repoPath } = readRepoConfig(cwd);
	const envConfig = configFromEnv(env);

	const merged = mergeConfigs(DEFAULT_CONFIG, userConfig, repoConfig, envConfig);
	merged.paths = { userFile: userPath, repoFile: repoPath };

	if (!merged.apiKey && options.requireApiKey !== false) {
		throw new ConfigError(
			[
				"Linear API key is required.",
				"Set LINEAR_API_KEY or provide it via ~/.config/linear-sh/config.json or .linearrc.json.",
			].join(" "),
		);
	}

	return merged;
}

function mergeConfigs(...configs: Array<PartialConfig | undefined>): LinearConfig {
	return configs.reduce<LinearConfig>(
		(acc, current) => {
			if (!current) {
				return acc;
			}

			if (typeof current.apiHost === "string" && current.apiHost.length > 0) {
				acc.apiHost = current.apiHost;
			}

			if (typeof current.apiKey === "string") {
				acc.apiKey = current.apiKey;
			}

			if (isOutputFormat(current.output)) {
				acc.output = current.output;
			}

			if (current.defaults) {
				acc.defaults = {
					...acc.defaults,
					...Object.fromEntries(
						Object.entries(current.defaults).filter(
							([, value]) => typeof value === "string" && value.length > 0,
						),
					),
				};
			}

			return acc;
		},
		{
			...DEFAULT_CONFIG,
			defaults: { ...DEFAULT_CONFIG.defaults },
			paths: { ...DEFAULT_CONFIG.paths },
		},
	);
}

function readRepoConfig(startDir: string): {
	readonly config?: PartialConfig;
	readonly filePath?: string;
} {
	let directory = path.resolve(startDir);
	const root = path.parse(directory).root;

	while (true) {
		const candidate = path.join(directory, REPO_CONFIG_FILENAME);
		if (existsSync(candidate)) {
			const result = readConfigFile(candidate);
			return { config: result.config, filePath: candidate };
		}

		if (directory === root) {
			return { config: undefined, filePath: undefined };
		}

		directory = path.dirname(directory);
	}
}

function readConfigFile(filePath: string): {
	readonly config?: PartialConfig;
	readonly filePath?: string;
} {
	if (!existsSync(filePath)) {
		return { config: undefined, filePath: undefined };
	}

	try {
		const content = readFileSync(filePath, "utf8");
		const parsed = JSON.parse(content) as PartialConfig;
		return { config: normaliseParsedConfig(parsed), filePath };
	} catch (error) {
		throw new ConfigError(`Failed to parse configuration file at ${filePath}: ${String(error)}`);
	}
}

function normaliseParsedConfig(config: PartialConfig): PartialConfig {
	const normalised: PartialConfig = {};

	if (typeof config.apiKey === "string") {
		normalised.apiKey = config.apiKey;
	}

	if (typeof config.apiHost === "string") {
		normalised.apiHost = config.apiHost;
	}

	if (isOutputFormat(config.output)) {
		normalised.output = config.output;
	}

	if (config.defaults && typeof config.defaults === "object") {
		normalised.defaults = {};

		for (const [key, value] of Object.entries(config.defaults)) {
			if (typeof value === "string") {
				normalised.defaults[key as keyof LinearConfigDefaults] = value;
			}
		}
	}

	return normalised;
}

function configFromEnv(env: NodeJS.ProcessEnv): PartialConfig {
	const defaults: LinearConfigDefaults = {};

	const teamId = env.LINEAR_DEFAULT_TEAM_ID ?? env.LINEAR_TEAM_ID;
	if (teamId) {
		defaults.teamId = teamId;
	}

	if (env.LINEAR_DEFAULT_ASSIGNEE_ID) {
		defaults.assigneeId = env.LINEAR_DEFAULT_ASSIGNEE_ID;
	}

	if (env.LINEAR_DEFAULT_WORKFLOW_STATE_ID) {
		defaults.workflowStateId = env.LINEAR_DEFAULT_WORKFLOW_STATE_ID;
	}

	if (env.LINEAR_DEFAULT_PROJECT_ID) {
		defaults.projectId = env.LINEAR_DEFAULT_PROJECT_ID;
	}

	const output = env.LINEAR_OUTPUT_FORMAT ?? env.LINEAR_OUTPUT;
	const format = isOutputFormat(output) ? output : undefined;

	const apiHost = env.LINEAR_API_HOST ?? env.LINEAR_API_BASE ?? undefined;

	return {
		apiKey: env.LINEAR_API_KEY ?? undefined,
		apiHost,
		output: format,
		defaults,
	};
}

export function ensureUserConfigPath(homeDir = os.homedir()): string {
	const directory = path.join(homeDir, path.dirname(USER_CONFIG_RELATIVE_PATH));
	if (!existsSync(directory)) {
		mkdirSync(directory, { recursive: true });
	}

	return path.join(homeDir, USER_CONFIG_RELATIVE_PATH);
}
