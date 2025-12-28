import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Effect } from "effect";

import { ConfigError, type LinearError } from "../errors";
import {
	type ConfigFile,
	type ConfigPaths,
	type Profile,
	type ResolvedConfig,
	DEFAULT_API_HOST,
	DEFAULT_OUTPUT,
	DEFAULT_PROFILE_NAME,
	emptyConfigFile,
	emptyProfile,
} from "./schema";

// -----------------------------------------------------------------------------
// Path Resolution
// -----------------------------------------------------------------------------

export function getConfigPaths(
	homeDir = os.homedir(),
): Omit<ConfigPaths, "cacheDir"> & { baseCacheDir: string } {
	const configDir = path.join(homeDir, ".config", "linear-sh");
	return {
		configDir,
		configFile: path.join(configDir, "config.json"),
		activeProfileFile: path.join(configDir, "active-profile"),
		baseCacheDir: path.join(homeDir, ".cache", "linear-sh"),
	};
}

export function getCacheDir(baseCacheDir: string, orgId?: string): string {
	return orgId ? path.join(baseCacheDir, orgId) : baseCacheDir;
}

// -----------------------------------------------------------------------------
// File Operations
// -----------------------------------------------------------------------------

export function readConfigFile(filePath: string): ConfigFile | undefined {
	if (!existsSync(filePath)) {
		return undefined;
	}
	try {
		const content = readFileSync(filePath, "utf8");
		return JSON.parse(content) as ConfigFile;
	} catch {
		return undefined;
	}
}

export function writeConfigFile(filePath: string, config: ConfigFile): void {
	const dir = path.dirname(filePath);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
	writeFileSync(filePath, JSON.stringify(config, null, 2), "utf8");
}

export function readActiveProfile(filePath: string): string | undefined {
	if (!existsSync(filePath)) {
		return undefined;
	}
	try {
		return readFileSync(filePath, "utf8").trim() || undefined;
	} catch {
		return undefined;
	}
}

export function writeActiveProfile(filePath: string, profileName: string): void {
	const dir = path.dirname(filePath);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
	writeFileSync(filePath, profileName, "utf8");
}

// -----------------------------------------------------------------------------
// Environment Merging
// -----------------------------------------------------------------------------

interface EnvOverrides {
	apiKey?: string;
	apiHost?: string;
	profile?: string;
	output?: "plain" | "json";
	defaults: Partial<Profile["defaults"]>;
}

export function getEnvOverrides(env = process.env): EnvOverrides {
	return {
		apiKey: env["LINEAR_API_KEY"],
		apiHost: env["LINEAR_API_HOST"] ?? env["LINEAR_API_BASE"],
		profile: env["LINEAR_PROFILE"],
		output:
			env["LINEAR_OUTPUT_FORMAT"] === "json"
				? "json"
				: env["LINEAR_OUTPUT_FORMAT"] === "plain"
					? "plain"
					: undefined,
		defaults: {
			teamId: env["LINEAR_DEFAULT_TEAM_ID"] ?? env["LINEAR_TEAM_ID"],
			assigneeId: env["LINEAR_DEFAULT_ASSIGNEE_ID"],
			workflowStateId: env["LINEAR_DEFAULT_WORKFLOW_STATE_ID"],
			projectId: env["LINEAR_DEFAULT_PROJECT_ID"],
		},
	};
}

// -----------------------------------------------------------------------------
// Legacy Config Migration
// -----------------------------------------------------------------------------

interface LegacyConfigFile {
	apiKey?: string;
	apiHost?: string;
	output?: "plain" | "json";
	defaults?: {
		teamId?: string;
		assigneeId?: string;
		workflowStateId?: string;
		projectId?: string;
	};
}

function migrateLegacyConfig(legacy: LegacyConfigFile): ConfigFile {
	// Convert old flat config to new profile-based config
	const defaultProfile: Profile = {
		apiKey: legacy.apiKey ?? "",
		apiHost: legacy.apiHost ?? DEFAULT_API_HOST,
		defaults: legacy.defaults ?? {},
	};

	return {
		activeProfile: DEFAULT_PROFILE_NAME,
		output: legacy.output,
		profiles: {
			[DEFAULT_PROFILE_NAME]: defaultProfile,
		},
	};
}

function isLegacyConfig(config: unknown): config is LegacyConfigFile {
	if (typeof config !== "object" || config === null) {
		return false;
	}
	const obj = config as Record<string, unknown>;
	// Legacy config has apiKey at root level, not in profiles
	return "apiKey" in obj && !("profiles" in obj);
}

function normalizeConfigFile(raw: unknown): ConfigFile {
	if (!raw || typeof raw !== "object") {
		return emptyConfigFile();
	}

	if (isLegacyConfig(raw)) {
		return migrateLegacyConfig(raw);
	}

	// Ensure profiles exists
	const config = raw as Partial<ConfigFile>;
	return {
		activeProfile: config.activeProfile,
		output: config.output,
		profiles: config.profiles ?? {},
	};
}

// -----------------------------------------------------------------------------
// Config Resolution
// -----------------------------------------------------------------------------

export interface LoadConfigOptions {
	readonly homeDir?: string;
	readonly env?: NodeJS.ProcessEnv;
	readonly profileOverride?: string;
	readonly requireApiKey?: boolean;
}

export function loadConfig(
	options: LoadConfigOptions = {},
): Effect.Effect<ResolvedConfig, LinearError> {
	return Effect.try({
		try: () => loadConfigSync(options),
		catch: (error) => ConfigError(error instanceof Error ? error.message : String(error)),
	});
}

export function loadConfigSync(options: LoadConfigOptions = {}): ResolvedConfig {
	const homeDir = options.homeDir ?? os.homedir();
	const env = options.env ?? process.env;

	const paths = getConfigPaths(homeDir);
	const envOverrides = getEnvOverrides(env);

	// Load config file and normalize (handles legacy format)
	const rawConfig = readConfigFile(paths.configFile);
	const configFile = normalizeConfigFile(rawConfig);

	// Determine active profile
	const activeProfile =
		options.profileOverride ??
		envOverrides.profile ??
		readActiveProfile(paths.activeProfileFile) ??
		configFile.activeProfile ??
		DEFAULT_PROFILE_NAME;

	// Get profile, creating empty if doesn't exist
	const baseProfile = configFile.profiles[activeProfile] ?? emptyProfile();

	// Merge env overrides into profile
	const profile: Profile = {
		apiKey: envOverrides.apiKey ?? baseProfile.apiKey,
		apiHost: envOverrides.apiHost ?? baseProfile.apiHost ?? DEFAULT_API_HOST,
		orgId: baseProfile.orgId,
		orgName: baseProfile.orgName,
		defaults: {
			...baseProfile.defaults,
			...Object.fromEntries(
				Object.entries(envOverrides.defaults).filter(([, v]) => v !== undefined),
			),
		},
	};

	// Validate
	if (options.requireApiKey !== false && !profile.apiKey) {
		throw new Error("Linear API key is required. Set LINEAR_API_KEY or configure a profile.");
	}

	const cacheDir = getCacheDir(paths.baseCacheDir, profile.orgId);

	return {
		activeProfile,
		profile,
		output: envOverrides.output ?? configFile.output ?? DEFAULT_OUTPUT,
		paths: {
			configDir: paths.configDir,
			configFile: paths.configFile,
			cacheDir,
			activeProfileFile: paths.activeProfileFile,
		},
	};
}
