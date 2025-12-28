import { Context, Effect, Layer } from "effect";

import {
	type LoadConfigOptions,
	type Profile,
	type ProfileDefaults,
	type ResolvedConfig,
	loadConfig,
} from "../config/index";
import { ConfigError, type LinearError } from "../errors";

// -----------------------------------------------------------------------------
// Service Interface
// -----------------------------------------------------------------------------

export interface ConfigService {
	/** Get the full resolved configuration */
	readonly getConfig: () => Effect.Effect<ResolvedConfig, LinearError>;

	/** Get the active profile */
	readonly getProfile: () => Effect.Effect<Profile, LinearError>;

	/** Get just the defaults section */
	readonly getDefaults: () => Effect.Effect<ProfileDefaults, LinearError>;

	/** Get the API key, failing if not present */
	readonly getApiKey: () => Effect.Effect<string, LinearError>;

	/** Get cache directory (org-namespaced) */
	readonly getCacheDir: () => Effect.Effect<string, LinearError>;

	/** Get active profile name */
	readonly getActiveProfileName: () => Effect.Effect<string, LinearError>;
}

// -----------------------------------------------------------------------------
// Context Tag
// -----------------------------------------------------------------------------

export const ConfigService = Context.GenericTag<ConfigService>("linear-sh/services/ConfigService");

// -----------------------------------------------------------------------------
// Live Implementation
// -----------------------------------------------------------------------------

export const makeConfigServiceLive = (
	options: LoadConfigOptions = {},
): Layer.Layer<ConfigService, LinearError> =>
	Layer.effect(
		ConfigService,
		loadConfig(options).pipe(
			Effect.map((config) =>
				ConfigService.of({
					getConfig: () => Effect.succeed(config),

					getProfile: () => Effect.succeed(config.profile),

					getDefaults: () => Effect.succeed(config.profile.defaults),

					getApiKey: () =>
						config.profile.apiKey
							? Effect.succeed(config.profile.apiKey)
							: Effect.fail(
									ConfigError(
										"Linear API key is required. Set LINEAR_API_KEY or configure a profile.",
									),
								),

					getCacheDir: () => Effect.succeed(config.paths.cacheDir),

					getActiveProfileName: () => Effect.succeed(config.activeProfile),
				}),
			),
		),
	);

export const ConfigServiceLive: Layer.Layer<ConfigService, LinearError> = makeConfigServiceLive({
	requireApiKey: false,
});

// -----------------------------------------------------------------------------
// Accessor functions
// -----------------------------------------------------------------------------

export const getConfig = (): Effect.Effect<ResolvedConfig, LinearError, ConfigService> =>
	Effect.flatMap(ConfigService, (service) => service.getConfig());

export const getProfile = (): Effect.Effect<Profile, LinearError, ConfigService> =>
	Effect.flatMap(ConfigService, (service) => service.getProfile());

export const getDefaults = (): Effect.Effect<ProfileDefaults, LinearError, ConfigService> =>
	Effect.flatMap(ConfigService, (service) => service.getDefaults());

export const getApiKey = (): Effect.Effect<string, LinearError, ConfigService> =>
	Effect.flatMap(ConfigService, (service) => service.getApiKey());

export const getCacheDir = (): Effect.Effect<string, LinearError, ConfigService> =>
	Effect.flatMap(ConfigService, (service) => service.getCacheDir());

export const getActiveProfileName = (): Effect.Effect<string, LinearError, ConfigService> =>
	Effect.flatMap(ConfigService, (service) => service.getActiveProfileName());
