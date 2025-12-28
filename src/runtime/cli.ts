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

function toError(cause: unknown): Error {
	if (cause instanceof Error) {
		return cause;
	}
	if (typeof cause === "object" && cause !== null && "message" in cause) {
		const err = new Error(String((cause as { message: unknown }).message));
		if ("_tag" in cause) {
			err.name = String((cause as { _tag: unknown })._tag);
		}
		return err;
	}
	return new Error(String(cause));
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
