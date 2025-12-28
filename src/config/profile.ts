import { LinearClient } from "@linear/sdk";
import { Effect } from "effect";

import { ConfigError, LinearApiError, type LinearError } from "../errors";
import {
	type ConfigFile,
	type Profile,
	type ProfileDefaults,
	DEFAULT_API_HOST,
	emptyConfigFile,
} from "./schema";
import {
	getConfigPaths,
	readActiveProfile,
	readConfigFile,
	writeActiveProfile,
	writeConfigFile,
} from "./loader";

// -----------------------------------------------------------------------------
// Profile Operations
// -----------------------------------------------------------------------------

export interface ProfileSummary {
	readonly name: string;
	readonly orgName?: string;
	readonly orgId?: string;
	readonly isActive: boolean;
	readonly hasApiKey: boolean;
}

export function listProfiles(homeDir?: string): ProfileSummary[] {
	const paths = getConfigPaths(homeDir);
	const config = readConfigFile(paths.configFile) ?? emptyConfigFile();
	const active = readActiveProfile(paths.activeProfileFile) ?? config.activeProfile ?? "default";

	return Object.entries(config.profiles).map(([name, profile]) => ({
		name,
		orgName: profile.orgName,
		orgId: profile.orgId,
		isActive: name === active,
		hasApiKey: Boolean(profile.apiKey),
	}));
}

export function getProfile(name: string, homeDir?: string): Profile | undefined {
	const paths = getConfigPaths(homeDir);
	const config = readConfigFile(paths.configFile) ?? emptyConfigFile();
	return config.profiles[name];
}

export function setActiveProfile(name: string, homeDir?: string): Effect.Effect<void, LinearError> {
	return Effect.try({
		try: () => {
			const paths = getConfigPaths(homeDir);
			const config = readConfigFile(paths.configFile) ?? emptyConfigFile();

			if (!config.profiles[name]) {
				throw new Error(`Profile "${name}" does not exist`);
			}

			writeActiveProfile(paths.activeProfileFile, name);
		},
		catch: (error) => ConfigError(error instanceof Error ? error.message : String(error)),
	});
}

export interface AddProfileOptions {
	readonly name: string;
	readonly apiKey: string;
	readonly apiHost?: string;
	readonly defaults?: ProfileDefaults;
	readonly setActive?: boolean;
}

export function addProfile(
	options: AddProfileOptions,
	homeDir?: string,
): Effect.Effect<Profile, LinearError> {
	return Effect.gen(function* () {
		const paths = getConfigPaths(homeDir);
		const config: ConfigFile = readConfigFile(paths.configFile) ?? emptyConfigFile();

		// Fetch org info from API
		const orgInfo = yield* fetchOrgInfo(options.apiKey, options.apiHost);

		const profile: Profile = {
			apiKey: options.apiKey,
			apiHost: options.apiHost ?? DEFAULT_API_HOST,
			orgId: orgInfo.id,
			orgName: orgInfo.name,
			defaults: options.defaults ?? {},
		};

		config.profiles[options.name] = profile;

		yield* Effect.try({
			try: () => writeConfigFile(paths.configFile, config),
			catch: (error) => ConfigError(`Failed to write config: ${String(error)}`),
		});

		if (options.setActive) {
			yield* setActiveProfile(options.name, homeDir);
		}

		return profile;
	});
}

export function removeProfile(name: string, homeDir?: string): Effect.Effect<void, LinearError> {
	return Effect.try({
		try: () => {
			const paths = getConfigPaths(homeDir);
			const config: ConfigFile = readConfigFile(paths.configFile) ?? emptyConfigFile();

			if (!config.profiles[name]) {
				throw new Error(`Profile "${name}" does not exist`);
			}

			const active = readActiveProfile(paths.activeProfileFile) ?? config.activeProfile;
			if (active === name) {
				throw new Error(`Cannot remove active profile "${name}". Switch to another profile first.`);
			}

			delete config.profiles[name];
			writeConfigFile(paths.configFile, config);

			// Optionally: clean up cache for this profile's orgId
		},
		catch: (error) => ConfigError(error instanceof Error ? error.message : String(error)),
	});
}

// -----------------------------------------------------------------------------
// API Helpers
// -----------------------------------------------------------------------------

interface OrgInfo {
	readonly id: string;
	readonly name: string;
}

function fetchOrgInfo(apiKey: string, apiHost?: string): Effect.Effect<OrgInfo, LinearError> {
	return Effect.tryPromise({
		try: async () => {
			const client = new LinearClient({
				apiKey,
				apiUrl: apiHost ?? DEFAULT_API_HOST,
			});

			const viewer = await client.viewer;
			const org = await viewer.organization;

			if (!org) {
				throw new Error("Could not fetch organization info");
			}

			return {
				id: org.id,
				name: org.name,
			};
		},
		catch: (error) =>
			LinearApiError(
				`Failed to fetch organization: ${error instanceof Error ? error.message : String(error)}`,
				undefined,
				"fetchOrgInfo",
			),
	});
}
