import { describe, expect, test } from "bun:test";
import { Writable } from "node:stream";

import { LinearApiErrorClass as LinearApiError } from "../errors";
import { createOutput } from "./output";

class MemoryWritable extends Writable {
	private readonly chunks: Buffer[] = [];

	_write(
		chunk: Buffer,
		_encoding: string,
		callback: (error?: Error | null) => void,
	) {
		this.chunks.push(Buffer.from(chunk));
		callback();
	}

	toString(): string {
		return Buffer.concat(this.chunks).toString("utf8");
	}
}

describe("createOutput", () => {
	test("renders error envelope in json format", () => {
		const stdout = new MemoryWritable();
		const stderr = new MemoryWritable();
		const output = createOutput({ format: "json", stdout, stderr });
		output.error(new LinearApiError("Request failed", 429), {
			code: "RATE_LIMIT",
			details: { retryAfter: 30 },
		});

		const parsed = JSON.parse(stderr.toString()) as {
			status: string;
			error: { message: string; code?: string };
		};
		expect(parsed.status).toBe("error");
		expect(parsed.error.message).toContain("Request failed");
		expect(parsed.error.code).toBe("RATE_LIMIT");
	});

	test("renders error message in plain format", () => {
		const stdout = new MemoryWritable();
		const stderr = new MemoryWritable();
		const output = createOutput({ format: "plain", stdout, stderr });
		output.error(new LinearApiError("Forbidden", 403), {
			code: "LINEAR_API_ERROR",
		});

		expect(stderr.toString().trim()).toBe(
			"Error: [LINEAR_API_ERROR] Forbidden",
		);
		expect(stdout.toString()).toBe("");
	});
});
