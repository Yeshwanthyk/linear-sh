import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Context, Effect, Layer } from "effect";

import type { LinearError } from "../errors";
import { ConfigService, getCacheDir } from "./config";

// -----------------------------------------------------------------------------
// Service Interface
// -----------------------------------------------------------------------------

export interface CacheService {
	/** Get a cached value by key */
	readonly get: <T>(key: string) => Effect.Effect<T | undefined, LinearError>;

	/** Set a cached value */
	readonly set: <T>(key: string, value: T, ttlMs?: number) => Effect.Effect<void, LinearError>;

	/** Invalidate a specific key */
	readonly invalidate: (key: string) => Effect.Effect<void, LinearError>;

	/** Clear all cached data */
	readonly clear: () => Effect.Effect<void, LinearError>;
}

// -----------------------------------------------------------------------------
// Context Tag
// -----------------------------------------------------------------------------

export const CacheService = Context.GenericTag<CacheService>("linear-sh/services/CacheService");

// -----------------------------------------------------------------------------
// Cache Entry Type
// -----------------------------------------------------------------------------

interface CacheEntry<T> {
	value: T;
	expiresAt: number;
}

interface CacheData {
	[key: string]: CacheEntry<unknown>;
}

// -----------------------------------------------------------------------------
// Live Implementation
// -----------------------------------------------------------------------------

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const CacheServiceLive: Layer.Layer<CacheService, LinearError, ConfigService> = Layer.effect(
	CacheService,
	Effect.gen(function* () {
		const cacheDir = yield* getCacheDir();
		const cacheFile = path.join(cacheDir, "metadata-cache.json");

		const ensureDir = (): void => {
			if (!existsSync(cacheDir)) {
				mkdirSync(cacheDir, { recursive: true });
			}
		};

		const readCache = (): CacheData => {
			if (!existsSync(cacheFile)) {
				return {};
			}
			try {
				const content = readFileSync(cacheFile, "utf8");
				return JSON.parse(content) as CacheData;
			} catch {
				return {};
			}
		};

		const writeCache = (data: CacheData): void => {
			ensureDir();
			writeFileSync(cacheFile, JSON.stringify(data, null, 2), "utf8");
		};

		return CacheService.of({
			get: <T>(key: string): Effect.Effect<T | undefined, LinearError> =>
				Effect.sync(() => {
					const data = readCache();
					const entry = data[key] as CacheEntry<T> | undefined;
					if (!entry) {
						return undefined;
					}
					if (Date.now() > entry.expiresAt) {
						// Expired - clean up
						delete data[key];
						writeCache(data);
						return undefined;
					}
					return entry.value;
				}),

			set: <T>(
				key: string,
				value: T,
				ttlMs: number = DEFAULT_TTL_MS,
			): Effect.Effect<void, LinearError> =>
				Effect.sync(() => {
					const data = readCache();
					data[key] = {
						value,
						expiresAt: Date.now() + ttlMs,
					};
					writeCache(data);
				}),

			invalidate: (key: string): Effect.Effect<void, LinearError> =>
				Effect.sync(() => {
					const data = readCache();
					delete data[key];
					writeCache(data);
				}),

			clear: (): Effect.Effect<void, LinearError> =>
				Effect.sync(() => {
					writeCache({});
				}),
		});
	}),
);

// -----------------------------------------------------------------------------
// Accessor functions
// -----------------------------------------------------------------------------

export const cacheGet = <T>(key: string): Effect.Effect<T | undefined, LinearError, CacheService> =>
	Effect.flatMap(CacheService, (service) => service.get<T>(key));

export const cacheSet = <T>(
	key: string,
	value: T,
	ttlMs?: number,
): Effect.Effect<void, LinearError, CacheService> =>
	Effect.flatMap(CacheService, (service) => service.set(key, value, ttlMs));

export const cacheInvalidate = (key: string): Effect.Effect<void, LinearError, CacheService> =>
	Effect.flatMap(CacheService, (service) => service.invalidate(key));

export const cacheClear = (): Effect.Effect<void, LinearError, CacheService> =>
	Effect.flatMap(CacheService, (service) => service.clear());
