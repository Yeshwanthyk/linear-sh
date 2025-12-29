import { Cause, Effect, Exit, Layer } from "effect";

import {
	CacheService,
	ConfigService,
	GitService,
	LinearClientService,
	LoggerService,
	OutputService,
	type ResolvedConfig,
} from "../services";
import { noopCacheService } from "./mocks/cache";
import { defaultMockGitService } from "./mocks/git";
import { mockLinearClientService, type MockLinearClientOptions } from "./mocks/linear";

// -----------------------------------------------------------------------------
// Default Mock Config
// -----------------------------------------------------------------------------

export const mockConfig: ResolvedConfig = {
	activeProfile: "test",
	profile: {
		apiKey: "test-api-key",
		apiHost: "https://api.linear.app/graphql",
		orgId: "org-test-123",
		orgName: "Test Organization",
		defaults: {
			teamId: "team-eng",
		},
	},
	output: "plain",
	paths: {
		configDir: "/tmp/linear-sh-test",
		configFile: "/tmp/linear-sh-test/config.json",
		cacheDir: "/tmp/linear-sh-test/cache",
		activeProfileFile: "/tmp/linear-sh-test/active-profile",
	},
};

// -----------------------------------------------------------------------------
// Individual Mock Layers
// -----------------------------------------------------------------------------

export function MockConfigLayer(config: ResolvedConfig = mockConfig): Layer.Layer<ConfigService> {
	return Layer.succeed(
		ConfigService,
		ConfigService.of({
			getConfig: () => Effect.succeed(config),
			getProfile: () => Effect.succeed(config.profile),
			getDefaults: () => Effect.succeed(config.profile.defaults),
			getApiKey: () => Effect.succeed(config.profile.apiKey),
			getCacheDir: () => Effect.succeed(config.paths.cacheDir),
			getActiveProfileName: () => Effect.succeed(config.activeProfile),
		}),
	);
}

export function MockCacheLayer(): Layer.Layer<CacheService> {
	return Layer.succeed(CacheService, noopCacheService());
}

export function MockGitLayer(): Layer.Layer<GitService> {
	return Layer.succeed(GitService, defaultMockGitService());
}

export function MockLinearClientLayer(
	options?: MockLinearClientOptions,
): Layer.Layer<LinearClientService> {
	return Layer.succeed(LinearClientService, mockLinearClientService(options));
}

export function MockLoggerLayer(): Layer.Layer<LoggerService> {
	const noop = () => Effect.void;
	return Layer.succeed(
		LoggerService,
		LoggerService.of({
			debug: noop,
			info: noop,
			warn: noop,
			error: noop,
		}),
	);
}

export interface MockOutputCapture {
	readonly writes: unknown[];
	readonly successes: Array<{ message: string; data?: unknown }>;
	readonly infos: Array<{ message: string; data?: unknown }>;
	readonly warnings: Array<{ message: string; data?: unknown }>;
	readonly errors: unknown[];
}

export function createMockOutputCapture(): MockOutputCapture {
	return {
		writes: [],
		successes: [],
		infos: [],
		warnings: [],
		errors: [],
	};
}

export function MockOutputLayer(capture?: MockOutputCapture): Layer.Layer<OutputService> {
	const output = capture ?? createMockOutputCapture();

	return Layer.succeed(
		OutputService,
		OutputService.of({
			write: (payload) => {
				output.writes.push(payload);
				return Effect.void;
			},
			success: (message, data) => {
				output.successes.push({ message, data });
				return Effect.void;
			},
			info: (message, data) => {
				output.infos.push({ message, data });
				return Effect.void;
			},
			warn: (message, data) => {
				output.warnings.push({ message, data });
				return Effect.void;
			},
			error: (err) => {
				output.errors.push(err);
				return Effect.void;
			},
			getFormat: () => Effect.succeed("plain" as const),
		}),
	);
}

// -----------------------------------------------------------------------------
// Complete Test Layer
// -----------------------------------------------------------------------------

export interface TestLayerOptions {
	config?: ResolvedConfig;
	linearClient?: MockLinearClientOptions;
	outputCapture?: MockOutputCapture;
}

export type TestServices =
	| ConfigService
	| CacheService
	| GitService
	| LinearClientService
	| LoggerService
	| OutputService;

export function TestLayer(options: TestLayerOptions = {}): Layer.Layer<TestServices> {
	return Layer.mergeAll(
		MockConfigLayer(options.config),
		MockCacheLayer(),
		MockGitLayer(),
		MockLinearClientLayer(options.linearClient),
		MockLoggerLayer(),
		MockOutputLayer(options.outputCapture),
	);
}

// -----------------------------------------------------------------------------
// Test Runner
// -----------------------------------------------------------------------------

export async function runTest<A, E>(
	effect: Effect.Effect<A, E, TestServices>,
	options: TestLayerOptions = {},
): Promise<A> {
	const layer = TestLayer(options);
	return Effect.runPromise(Effect.provide(effect, layer));
}

export async function runTestExit<A, E>(
	effect: Effect.Effect<A, E, TestServices>,
	options: TestLayerOptions = {},
): Promise<{ success: boolean; value?: A; error?: E }> {
	const layer = TestLayer(options);
	const exit = await Effect.runPromiseExit(Effect.provide(effect, layer));

	return Exit.match(exit, {
		onSuccess: (value: A) => ({ success: true as const, value }),
		onFailure: (cause) => ({
			success: false as const,
			error: Cause.squash(cause) as E,
		}),
	});
}
