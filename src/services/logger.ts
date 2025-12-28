import { Context, Effect, Layer } from "effect";

// -----------------------------------------------------------------------------
// Service Interface
// -----------------------------------------------------------------------------

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LoggerService {
	readonly debug: (message: string, meta?: Record<string, unknown>) => Effect.Effect<void, never>;
	readonly info: (message: string, meta?: Record<string, unknown>) => Effect.Effect<void, never>;
	readonly warn: (message: string, meta?: Record<string, unknown>) => Effect.Effect<void, never>;
	readonly error: (message: string, meta?: Record<string, unknown>) => Effect.Effect<void, never>;
}

// -----------------------------------------------------------------------------
// Context Tag
// -----------------------------------------------------------------------------

export const LoggerService = Context.GenericTag<LoggerService>("linear-sh/services/LoggerService");

// -----------------------------------------------------------------------------
// Live Implementation
// -----------------------------------------------------------------------------

export interface LoggerServiceOptions {
	readonly level?: LogLevel;
	readonly json?: boolean;
	readonly stderr?: NodeJS.WritableStream;
}

const LEVEL_WEIGHT: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

export const makeLoggerServiceLive = (
	options: LoggerServiceOptions = {},
): Layer.Layer<LoggerService, never> => {
	const minLevel = options.level ?? "info";
	const json = options.json ?? false;
	const stderr = options.stderr ?? process.stderr;
	const threshold = LEVEL_WEIGHT[minLevel];

	const shouldLog = (level: LogLevel): boolean => LEVEL_WEIGHT[level] >= threshold;

	const formatMessage = (
		level: LogLevel,
		message: string,
		meta?: Record<string, unknown>,
	): string => {
		if (json) {
			return JSON.stringify({
				level,
				message,
				...meta,
				timestamp: new Date().toISOString(),
			});
		}
		const metaStr = meta
			? ` ${Object.entries(meta)
					.map(([k, v]) => `${k}=${String(v)}`)
					.join(" ")}`
			: "";
		return `[${level.toUpperCase()}] ${message}${metaStr}`;
	};

	const log =
		(level: LogLevel) =>
		(message: string, meta?: Record<string, unknown>): Effect.Effect<void, never> =>
			Effect.sync(() => {
				if (shouldLog(level)) {
					stderr.write(`${formatMessage(level, message, meta)}\n`);
				}
			});

	return Layer.succeed(
		LoggerService,
		LoggerService.of({
			debug: log("debug"),
			info: log("info"),
			warn: log("warn"),
			error: log("error"),
		}),
	);
};

export const LoggerServiceLive: Layer.Layer<LoggerService, never> = makeLoggerServiceLive();

export const LoggerServiceSilent: Layer.Layer<LoggerService, never> = Layer.succeed(
	LoggerService,
	LoggerService.of({
		debug: () => Effect.void,
		info: () => Effect.void,
		warn: () => Effect.void,
		error: () => Effect.void,
	}),
);

// -----------------------------------------------------------------------------
// Accessor functions
// -----------------------------------------------------------------------------

export const logDebug = (
	message: string,
	meta?: Record<string, unknown>,
): Effect.Effect<void, never, LoggerService> =>
	Effect.flatMap(LoggerService, (service) => service.debug(message, meta));

export const logInfo = (
	message: string,
	meta?: Record<string, unknown>,
): Effect.Effect<void, never, LoggerService> =>
	Effect.flatMap(LoggerService, (service) => service.info(message, meta));

export const logWarn = (
	message: string,
	meta?: Record<string, unknown>,
): Effect.Effect<void, never, LoggerService> =>
	Effect.flatMap(LoggerService, (service) => service.warn(message, meta));

export const logError = (
	message: string,
	meta?: Record<string, unknown>,
): Effect.Effect<void, never, LoggerService> =>
	Effect.flatMap(LoggerService, (service) => service.error(message, meta));
