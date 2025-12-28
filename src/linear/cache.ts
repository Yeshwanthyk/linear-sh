import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { CacheErrorClass as CacheError } from "../errors";

export interface MetadataCacheOptions {
	readonly homeDir?: string;
	readonly ttlMs?: number;
	readonly enabled?: boolean;
	readonly fileName?: string;
}

interface CacheRecord<T> {
	readonly value: T;
	readonly expiresAt: number;
}

type CacheStore = Record<string, CacheRecord<unknown>>;

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_FILE_NAME = "metadata-cache.json";

export class MetadataCache {
	private readonly cacheDir: string;
	private readonly filePath: string;
	private readonly ttlMs: number;
	private readonly enabled: boolean;
	private loaded = false;
	private data: CacheStore = {};

	constructor(options: MetadataCacheOptions = {}) {
		const homeDir = options.homeDir ?? os.homedir();
		this.cacheDir = path.join(homeDir, ".cache", "linear-sh");
		this.filePath = path.join(this.cacheDir, options.fileName ?? DEFAULT_FILE_NAME);
		this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
		this.enabled = options.enabled ?? true;
	}

	async get<T>(key: string): Promise<T | undefined> {
		if (!this.enabled) {
			return undefined;
		}

		await this.ensureLoaded();
		const entry = this.data[key];
		if (!entry) {
			return undefined;
		}

		if (entry.expiresAt < Date.now()) {
			delete this.data[key];
			await this.persist();
			return undefined;
		}

		return entry.value as T;
	}

	async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
		if (!this.enabled) {
			return;
		}

		await this.ensureLoaded();
		const expiresAt = Date.now() + (ttlMs ?? this.ttlMs);
		this.data[key] = { value, expiresAt };
		await this.persist();
	}

	async invalidate(key: string): Promise<void> {
		if (!this.enabled) {
			return;
		}

		await this.ensureLoaded();
		delete this.data[key];
		await this.persist();
	}

	async clear(): Promise<void> {
		if (!this.enabled) {
			return;
		}

		this.data = {};
		this.loaded = true;
		await rm(this.filePath, { force: true });
	}

	private async ensureLoaded(): Promise<void> {
		if (this.loaded) {
			return;
		}

		try {
			const raw = await readFile(this.filePath, "utf8");
			const parsed = JSON.parse(raw) as CacheStore;
			this.data = parsed ?? {};
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
				throw new CacheError(`Failed to read cache file: ${String(error)}`);
			}
			this.data = {};
		}

		this.loaded = true;
	}

	private async persist(): Promise<void> {
		await mkdir(this.cacheDir, { recursive: true });
		await writeFile(this.filePath, JSON.stringify(this.data, null, 2), "utf8");
	}
}
