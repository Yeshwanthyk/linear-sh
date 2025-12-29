import { Cause, Effect, Exit, Layer } from "effect";
import {
	CacheService,
	CacheServiceLive,
	ConfigService,
	GitService,
	GitServiceLive,
	LinearClientService,
	LinearClientLive,
	LoggerService,
	LoggerServiceLive,
	makeConfigServiceLive,
	makeOutputServiceLive,
	OutputService,
	type OutputServiceOptions,
} from "../services";

// -----------------------------------------------------------------------------
// App Layer Composition
// -----------------------------------------------------------------------------

export interface AppLayerOptions {
	readonly profileOverride?: string;
	readonly outputFormat?: "plain" | "json";
	readonly noCache?: boolean;
	readonly requireApiKey?: boolean;
}

export type AppServices =
	| ConfigService
	| CacheService
	| GitService
	| LinearClientService
	| LoggerService
	| OutputService;

export function makeAppLayer(options: AppLayerOptions = {}) {
	const configLayer = makeConfigServiceLive({
		profileOverride: options.profileOverride,
		requireApiKey: options.requireApiKey,
	});

	const noCacheLayer = Layer.succeed(CacheService, {
		get: () => Effect.succeed(undefined),
		set: () => Effect.void,
		invalidate: () => Effect.void,
		clear: () => Effect.void,
	});

	// CacheServiceLive depends on ConfigService, so provide it
	const cacheLayer = options.noCache
		? noCacheLayer
		: CacheServiceLive.pipe(Layer.provide(configLayer));

	const outputOptions: OutputServiceOptions = {
		format: options.outputFormat,
	};
	const outputLayer = makeOutputServiceLive(outputOptions);

	// LinearClientLive depends on ConfigService
	const linearClientLayer = LinearClientLive.pipe(Layer.provide(configLayer));

	// Merge all layers
	return Layer.mergeAll(
		configLayer,
		cacheLayer,
		GitServiceLive,
		linearClientLayer,
		LoggerServiceLive,
		outputLayer,
	);
}

// -----------------------------------------------------------------------------
// Error Conversion
// -----------------------------------------------------------------------------

interface LinearErrorShape {
	readonly _tag: string;
	readonly message: string;
}

function isLinearError(cause: unknown): cause is LinearErrorShape {
	return (
		typeof cause === "object" &&
		cause !== null &&
		"_tag" in cause &&
		"message" in cause &&
		typeof (cause as Record<string, unknown>)._tag === "string" &&
		typeof (cause as Record<string, unknown>).message === "string"
	);
}

function tagToCode(tag: string): string {
	switch (tag) {
		case "ConfigError":
			return "CONFIG_ERROR";
		case "LinearApiError":
			return "LINEAR_API_ERROR";
		case "CacheError":
			return "CACHE_ERROR";
		case "GitError":
			return "GIT_ERROR";
		case "ValidationError":
			return "VALIDATION_ERROR";
		case "ResolverError":
			return "RESOLVER_ERROR";
		default:
			return "ERROR";
	}
}

interface CliError extends Error {
	code: string;
	tag: string;
}

function toError(cause: unknown): CliError {
	if (isLinearError(cause)) {
		const err = new Error(cause.message) as CliError;
		err.name = cause._tag;
		err.tag = cause._tag;
		err.code = tagToCode(cause._tag);
		return err;
	}
	if (cause instanceof Error) {
		const err = cause as CliError;
		err.code = err.code ?? "ERROR";
		err.tag = err.name;
		return err;
	}
	const err = new Error(String(cause)) as CliError;
	err.code = "ERROR";
	err.tag = "Error";
	return err;
}

// -----------------------------------------------------------------------------
// Command Runner
// -----------------------------------------------------------------------------

export interface RunOptions extends AppLayerOptions {
	readonly onError?: (error: Error) => void;
}

export async function runCommand<E, A>(
	program: Effect.Effect<A, E, AppServices>,
	options: RunOptions = {},
): Promise<A> {
	const layer = makeAppLayer(options);

	const runnable = Effect.provide(program, layer);

	const exit = await Effect.runPromiseExit(runnable);

	return Exit.match(exit, {
		onSuccess: (value) => value,
		onFailure: (cause) => {
			const squashed = Cause.squash(cause);
			const error = toError(squashed);
			if (options.onError) {
				options.onError(error);
			}
			throw error;
		},
	});
}

export function runCommandExit<E>(
	program: Effect.Effect<number, E, AppServices>,
	options: RunOptions = {},
): Promise<number> {
	return runCommand(program, options).catch(() => 1);
}
