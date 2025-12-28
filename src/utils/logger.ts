import type { Writable } from "node:stream";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
	readonly debug: LogMethod;
	readonly info: LogMethod;
	readonly warn: LogMethod;
	readonly error: LogMethod;
	readonly child: (context: LogContext) => Logger;
}

export interface LoggerOptions {
	readonly level?: LogLevel;
	readonly json?: boolean;
	readonly context?: LogContext;
	readonly stdout?: Writable;
	readonly stderr?: Writable;
}

export type LogContext = Record<string, unknown>;
type LogMethod = (message: string, metadata?: LogContext) => void;

const LEVEL_WEIGHT: Record<LogLevel, number> = {
	debug: 10,
	info: 20,
	warn: 30,
	error: 40,
};

const DEFAULT_LEVEL: LogLevel = "info";

export function createLogger(options: LoggerOptions = {}): Logger {
	const level = options.level ?? DEFAULT_LEVEL;
	const json = options.json ?? false;
	const baseContext = { ...options.context };
	const stdout = options.stdout ?? process.stdout;
	const stderr = options.stderr ?? process.stderr;

	const threshold = LEVEL_WEIGHT[level] ?? LEVEL_WEIGHT[DEFAULT_LEVEL];

	const write = (target: Writable, payload: string) => {
		target.write(`${payload}\n`);
	};

	const serialize = (levelName: LogLevel, message: string, metadata?: LogContext): string => {
		if (json) {
			const payload = {
				level: levelName,
				message,
				...baseContext,
				...metadata,
				timestamp: new Date().toISOString(),
			};
			return JSON.stringify(payload);
		}

		const contextEntries = Object.entries({ ...baseContext, ...metadata })
			.map(([key, value]) => `${key}=${String(value)}`)
			.join(" ");

		const suffix = contextEntries.length > 0 ? ` ${contextEntries}` : "";
		return `[${levelName.toUpperCase()}] ${message}${suffix}`;
	};

	const makeMethod =
		(levelName: LogLevel, target: Writable): LogMethod =>
		(message, metadata) => {
			if (LEVEL_WEIGHT[levelName] < threshold) {
				return;
			}
			write(target, serialize(levelName, message, metadata));
		};

	const logger: Logger = {
		debug: makeMethod("debug", stdout),
		info: makeMethod("info", stdout),
		warn: makeMethod("warn", stderr),
		error: makeMethod("error", stderr),
		child(childContext: LogContext) {
			return createLogger({
				level,
				json,
				context: { ...baseContext, ...childContext },
				stdout,
				stderr,
			});
		},
	};

	return logger;
}
