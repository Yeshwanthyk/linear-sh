// Output format for CLI
export type OutputFormat = "plain" | "json";

// Defaults that are org-specific
export interface ProfileDefaults {
	readonly teamId?: string;
	readonly assigneeId?: string;
	readonly workflowStateId?: string;
	readonly projectId?: string;
}

// A single profile configuration
export interface Profile {
	readonly apiKey: string;
	readonly apiHost?: string;
	readonly orgId?: string; // Cached from viewer.organization.id
	readonly orgName?: string; // Cached for display
	readonly defaults: ProfileDefaults;
}

// Full config file structure
export interface ConfigFile {
	readonly activeProfile?: string;
	readonly output?: OutputFormat;
	readonly profiles: Record<string, Profile>;
}

// Resolved runtime config (after merging env, files, flags)
export interface ResolvedConfig {
	readonly activeProfile: string;
	readonly profile: Profile;
	readonly output: OutputFormat;
	readonly paths: ConfigPaths;
}

export interface ConfigPaths {
	readonly configDir: string; // ~/.config/linear-sh
	readonly configFile: string; // ~/.config/linear-sh/config.json
	readonly cacheDir: string; // ~/.cache/linear-sh/{orgId}
	readonly activeProfileFile: string; // ~/.config/linear-sh/active-profile
}

// Config file defaults
export const DEFAULT_PROFILE_NAME = "default";
export const DEFAULT_API_HOST = "https://api.linear.app/graphql";
export const DEFAULT_OUTPUT: OutputFormat = "plain";

export const emptyProfile = (): Profile => ({
	apiKey: "",
	apiHost: DEFAULT_API_HOST,
	defaults: {},
});

export const emptyConfigFile = (): ConfigFile => ({
	profiles: {},
});
