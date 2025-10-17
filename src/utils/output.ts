import type { Writable } from "node:stream";

import type { OutputFormat } from "../config";

export interface OutputOptions {
	readonly format: OutputFormat;
	readonly stdout?: Writable;
	readonly stderr?: Writable;
}

export interface OutputHandlers {
	readonly format: OutputFormat;
	readonly write: (payload: unknown) => void;
	readonly success: (message: string, data?: unknown) => void;
	readonly info: (message: string, data?: unknown) => void;
	readonly warn: (message: string, data?: unknown) => void;
	readonly error: (error: unknown, meta?: ErrorMetadata) => void;
}

export interface ErrorMetadata {
	readonly code?: string;
	readonly details?: unknown;
}

interface JsonEnvelope {
	readonly status: "success" | "error" | "info" | "warn";
	readonly message?: string;
	readonly data?: unknown;
	readonly error?: {
		readonly name: string;
		readonly message: string;
		readonly code?: string;
		readonly details?: unknown;
	};
}

export function createOutput(options: OutputOptions): OutputHandlers {
	const stdout = options.stdout ?? process.stdout;
	const stderr = options.stderr ?? process.stderr;
	const format = options.format;

	const writeLine = (target: Writable, content: string) => {
		target.write(`${content}\n`);
	};

	const toJson = (envelope: JsonEnvelope): string =>
		JSON.stringify({
			...envelope,
			timestamp: new Date().toISOString(),
		});

	const writeSuccess = (
		status: "success" | "info" | "warn",
		message: string,
		data?: unknown,
	) => {
		const useStdout = status === "success" || status === "info";
		const target = useStdout ? stdout : stderr;

		if (format === "json") {
			const payload: JsonEnvelope = {
				status,
				message,
				data,
			};
			writeLine(target, toJson(payload));
			return;
		}

		const suffix = data ? ` ${stringifyData(data)}` : "";
		writeLine(target, `${message}${suffix}`);
	};

	const writeError = (error: unknown, meta?: ErrorMetadata) => {
		if (format === "json") {
			const payload: JsonEnvelope = {
				status: "error",
				error: {
					name: error instanceof Error ? error.name : "Error",
					message: error instanceof Error ? error.message : String(error),
					code: meta?.code,
					details: meta?.details,
				},
			};
			writeLine(stderr, toJson(payload));
			return;
		}

		const message = error instanceof Error ? error.message : String(error);
		const codeSuffix = meta?.code ? ` [${meta.code}]` : "";
		const detailsSuffix =
			meta?.details !== undefined ? ` ${stringifyData(meta.details)}` : "";
		writeLine(stderr, `Error:${codeSuffix} ${message}${detailsSuffix}`);
	};

	return {
		format,
		write(payload) {
			if (format === "json") {
				writeLine(stdout, toJson({ status: "info", data: payload }));
				return;
			}
			writeLine(stdout, stringifyData(payload));
		},
		success(message, data) {
			writeSuccess("success", message, data);
		},
		info(message, data) {
			writeSuccess("info", message, data);
		},
		warn(message, data) {
			writeSuccess("warn", message, data);
		},
		error(error, meta) {
			writeError(error, meta);
		},
	};
}

function stringifyData(value: unknown): string {
	if (typeof value === "string") {
		return value;
	}

	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}
