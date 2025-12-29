import { Command, Option } from "clipanion";
import type { Effect } from "effect";

import { type AppLayerOptions, runCommandExit } from "../runtime/cli";
import type {
	CacheService,
	ConfigService,
	GitService,
	LinearClientService,
	LoggerService,
	OutputService,
} from "../services";

// Effect services type for commands
export type AppServices =
	| ConfigService
	| CacheService
	| GitService
	| LinearClientService
	| LoggerService
	| OutputService;

// Legacy context interface (kept for test compatibility during migration)
export interface CommandContext {
	readonly config: {
		apiKey: string;
		apiHost?: string;
		output: "plain" | "json";
		defaults: Record<string, unknown>;
		paths: Record<string, unknown>;
	};
	readonly output: {
		format: "plain" | "json";
		write: (payload: unknown) => void;
		success: (message: string, data?: unknown) => void;
		info: (message: string, data?: unknown) => void;
		warn: (message: string, data?: unknown) => void;
		error: (error: unknown) => void;
	};
	readonly logger: {
		debug: (message: string, data?: unknown) => void;
		info: (message: string, data?: unknown) => void;
		warn: (message: string, data?: unknown) => void;
		error: (message: string, data?: unknown) => void;
	};
	readonly service: unknown;
}

export abstract class BaseCommand extends Command {
	// Legacy: Context factory for testing (preserved for test file compatibility)
	static setContextFactory(_factory?: unknown): void {
		// No-op - legacy tests are skipped
	}

	json = Option.Boolean("--json", false, {
		description: "Emit machine-readable JSON output",
	});

	noCache = Option.Boolean("--no-cache", false, {
		description: "Disable metadata caching for this invocation",
	});

	profile = Option.String("--profile", {
		description: "Use a specific profile",
		required: false,
	});

	/**
	 * Build layer options from command flags.
	 */
	protected getLayerOptions(): AppLayerOptions {
		return {
			profileOverride: this.profile,
			outputFormat: this.json ? "json" : undefined,
			noCache: this.noCache,
			requireApiKey: true,
		};
	}

	/**
	 * Run an Effect program with full app layer.
	 */
	protected run<E>(
		program: Effect.Effect<number, E, AppServices>,
		options?: Partial<AppLayerOptions>,
	): Promise<number> {
		const layerOptions = { ...this.getLayerOptions(), ...options };

		return runCommandExit(program, {
			...layerOptions,
			onError: (error) => this.reportError(error),
		});
	}

	/**
	 * Report an error to stderr.
	 */
	protected reportError(error: unknown): void {
		const message = error instanceof Error ? error.message : String(error);
		const code = error instanceof Error && "code" in error ? String(error.code) : "ERROR";

		if (this.json) {
			console.error(JSON.stringify({ error: { message, code } }));
		} else {
			console.error(`Error: ${message}`);
		}
	}
}
