import { Effect } from "effect";

import type { CacheService } from "../../services";

// -----------------------------------------------------------------------------
// In-Memory Mock Cache
// -----------------------------------------------------------------------------

export interface MockCacheOptions {
	initialData?: Map<string, unknown>;
}

export function mockCacheService(options: MockCacheOptions = {}): CacheService {
	const store = new Map<string, unknown>(options.initialData);

	return {
		get: <T>(key: string) => Effect.succeed(store.get(key) as T | undefined),

		set: <T>(key: string, value: T) => {
			store.set(key, value);
			return Effect.void;
		},

		invalidate: (key: string) => {
			store.delete(key);
			return Effect.void;
		},

		clear: () => {
			store.clear();
			return Effect.void;
		},
	};
}

// -----------------------------------------------------------------------------
// No-op Cache (for tests that shouldn't cache)
// -----------------------------------------------------------------------------

export function noopCacheService(): CacheService {
	return {
		get: <T>(_key: string) => Effect.succeed(undefined as T | undefined),
		set: <T>(_key: string, _value: T) => Effect.void,
		invalidate: (_key: string) => Effect.void,
		clear: () => Effect.void,
	};
}
