import { Context, Effect, Layer } from "effect";

import type { OutputFormat } from "../config/index";

// -----------------------------------------------------------------------------
// Service Interface
// -----------------------------------------------------------------------------

export interface OutputService {
	/** Write output (respects format) */
	readonly write: (data: unknown) => Effect.Effect<void, never>;

	/** Write success message */
	readonly success: (message: string, data?: unknown) => Effect.Effect<void, never>;

	/** Write info message */
	readonly info: (message: string, data?: unknown) => Effect.Effect<void, never>;

	/** Write warning */
	readonly warn: (message: string, data?: unknown) => Effect.Effect<void, never>;

	/** Write error */
	readonly error: (error: unknown, meta?: { code?: string }) => Effect.Effect<void, never>;

	/** Get current format */
	readonly getFormat: () => Effect.Effect<OutputFormat, never>;
}

// -----------------------------------------------------------------------------
// Context Tag
// -----------------------------------------------------------------------------

export const OutputService = Context.GenericTag<OutputService>("linear-sh/services/OutputService");

// -----------------------------------------------------------------------------
// Live Implementation
// -----------------------------------------------------------------------------

export interface OutputServiceOptions {
	readonly format?: OutputFormat;
	readonly stdout?: NodeJS.WritableStream;
	readonly stderr?: NodeJS.WritableStream;
}

export const makeOutputServiceLive = (
	options: OutputServiceOptions = {},
): Layer.Layer<OutputService, never> => {
	const format = options.format ?? "plain";
	const stdout = options.stdout ?? process.stdout;
	const stderr = options.stderr ?? process.stderr;

	const writeLine = (stream: NodeJS.WritableStream, line: string): void => {
		stream.write(`${line}\n`);
	};

	return Layer.succeed(
		OutputService,
		OutputService.of({
			write: (data: unknown): Effect.Effect<void, never> =>
				Effect.sync(() => {
					if (format === "json") {
						writeLine(stdout, JSON.stringify(data));
					} else if (typeof data === "string") {
						writeLine(stdout, data);
					} else {
						writeLine(stdout, JSON.stringify(data, null, 2));
					}
				}),

			success: (message: string, data?: unknown): Effect.Effect<void, never> =>
				Effect.sync(() => {
					if (format === "json") {
						writeLine(
							stdout,
							JSON.stringify({ success: true, message, ...((data ?? {}) as object) }),
						);
					} else {
						writeLine(stdout, `✓ ${message}`);
						if (data && typeof data === "object") {
							for (const [key, value] of Object.entries(data)) {
								writeLine(stdout, `  ${key}: ${String(value)}`);
							}
						}
					}
				}),

			info: (message: string, data?: unknown): Effect.Effect<void, never> =>
				Effect.sync(() => {
					if (format === "json") {
						writeLine(stdout, JSON.stringify({ info: message, ...((data ?? {}) as object) }));
					} else {
						writeLine(stdout, `ℹ ${message}`);
						if (data && typeof data === "object") {
							for (const [key, value] of Object.entries(data)) {
								writeLine(stdout, `  ${key}: ${String(value)}`);
							}
						}
					}
				}),

			warn: (message: string, data?: unknown): Effect.Effect<void, never> =>
				Effect.sync(() => {
					if (format === "json") {
						writeLine(stderr, JSON.stringify({ warning: message, ...((data ?? {}) as object) }));
					} else {
						writeLine(stderr, `⚠ ${message}`);
						if (data && typeof data === "object") {
							for (const [key, value] of Object.entries(data)) {
								writeLine(stderr, `  ${key}: ${String(value)}`);
							}
						}
					}
				}),

			error: (error: unknown, meta?: { code?: string }): Effect.Effect<void, never> =>
				Effect.sync(() => {
					const message = error instanceof Error ? error.message : String(error);
					const code = meta?.code ?? (error instanceof Error ? error.name : "Error");

					if (format === "json") {
						writeLine(stderr, JSON.stringify({ error: { message, code } }));
					} else {
						writeLine(stderr, `✗ ${message}`);
					}
				}),

			getFormat: (): Effect.Effect<OutputFormat, never> => Effect.succeed(format),
		}),
	);
};

export const OutputServiceLive: Layer.Layer<OutputService, never> = makeOutputServiceLive();

// -----------------------------------------------------------------------------
// Accessor functions
// -----------------------------------------------------------------------------

export const write = (data: unknown): Effect.Effect<void, never, OutputService> =>
	Effect.flatMap(OutputService, (service) => service.write(data));

export const success = (
	message: string,
	data?: unknown,
): Effect.Effect<void, never, OutputService> =>
	Effect.flatMap(OutputService, (service) => service.success(message, data));

export const info = (message: string, data?: unknown): Effect.Effect<void, never, OutputService> =>
	Effect.flatMap(OutputService, (service) => service.info(message, data));

export const warn = (message: string, data?: unknown): Effect.Effect<void, never, OutputService> =>
	Effect.flatMap(OutputService, (service) => service.warn(message, data));

export const outputError = (
	error: unknown,
	meta?: { code?: string },
): Effect.Effect<void, never, OutputService> =>
	Effect.flatMap(OutputService, (service) => service.error(error, meta));

export const getFormat = (): Effect.Effect<OutputFormat, never, OutputService> =>
	Effect.flatMap(OutputService, (service) => service.getFormat());
