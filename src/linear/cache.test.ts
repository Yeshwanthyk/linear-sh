import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { MetadataCache } from "./cache";

let tempDir: string;

beforeEach(() => {
	tempDir = mkdtempSync(path.join(os.tmpdir(), "linear-cache-"));
});

afterEach(() => {
	rmSync(tempDir, { recursive: true, force: true });
});

describe("MetadataCache", () => {
	test("stores and retrieves values within TTL", async () => {
		const cache = new MetadataCache({
			homeDir: tempDir,
			ttlMs: 1000,
			fileName: "test-cache.json",
		});

		await cache.set("workflowStates:team", [{ id: "state-1" }]);
		const value = await cache.get<Array<Record<string, string>>>(
			"workflowStates:team",
		);
		expect(value).toEqual([{ id: "state-1" }]);
	});

	test("returns undefined after TTL expires", async () => {
		const cache = new MetadataCache({
			homeDir: tempDir,
			ttlMs: 10,
			fileName: "test-cache.json",
		});

		await cache.set("users", [{ id: "user-1" }]);
		await new Promise((resolve) => setTimeout(resolve, 20));
		const value = await cache.get("users");
		expect(value).toBeUndefined();
	});

	test("persists values across instances", async () => {
		const options = {
			homeDir: tempDir,
			ttlMs: 1000,
			fileName: "test-cache.json",
		};
		const cache = new MetadataCache(options);
		await cache.set("key", { hello: "world" });

		const reloaded = new MetadataCache(options);
		const value = await reloaded.get<{ hello: string }>("key");
		expect(value).toEqual({ hello: "world" });
	});
});
