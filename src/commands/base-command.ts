import { Command, Option } from "clipanion";
import { Effect } from "effect";

import { ConfigError, type LinearConfig, loadLinearConfig } from "../config";
import { MetadataCache } from "../linear/cache";
import { LinearService } from "../linear/client";
import { type AppLayerOptions, runCommandExit } from "../runtime/cli";
import type {
	CacheService,
	ConfigService,
	GitService,
	LoggerService,
	OutputService,
} from "../services";
import type { Logger } from "../utils/logger";
import { createLogger } from "../utils/logger";
import type { OutputHandlers } from "../utils/output";
import { createOutput } from "../utils/output";

// Legacy context for backward compatibility
export interface CommandContext {
	readonly config: LinearConfig;
	readonly output: OutputHandlers;
	readonly logger: Logger;
	readonly service: LinearService;
}

type ContextFactory = (
	command: BaseCommand,
	options: { requireApiKey: boolean },
) => Promise<CommandContext>;

// Effect services type for new commands
export type AppServices = ConfigService | CacheService | GitService | LoggerService | OutputService;

export abstract class BaseCommand extends Command {
	// Legacy: Context factory for testing
	static setContextFactory(factory?: ContextFactory): void {
		BaseCommand.contextFactory = factory;
	}

	private static contextFactory?: ContextFactory;

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

	private contextPromise?: Promise<CommandContext>;

	// -------------------------------------------------------------------------
	// New Effect-based API
	// -------------------------------------------------------------------------

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

	// -------------------------------------------------------------------------
	// Legacy API (for backward compatibility during migration)
	// -------------------------------------------------------------------------

	protected async getContext(options: { requireApiKey?: boolean } = {}): Promise<CommandContext> {
		if (!this.contextPromise) {
			this.contextPromise = this.buildContext(options.requireApiKey ?? true);
		}
		return this.contextPromise;
	}

	protected async withContext<T = number>(
		fn: (context: CommandContext) => Promise<T>,
		options: { requireApiKey?: boolean } = {},
	): Promise<T | number> {
		try {
			const context = await this.getContext(options);
			try {
				return await fn(context);
			} catch (error) {
				this.reportError(error, context);
				return 1;
			}
		} catch (error) {
			this.reportError(error);
			return 1;
		}
	}

	protected resetContext(): void {
		this.contextPromise = undefined;
	}

	private buildContext(requireApiKey: boolean): Promise<CommandContext> {
		if (BaseCommand.contextFactory) {
			return BaseCommand.contextFactory(this, { requireApiKey });
		}

		const config = loadLinearConfig({
			requireApiKey,
		});

		const format = this.json ? "json" : config.output;
		const output = createOutput({ format });
		const logger = createLogger({
			level: format === "json" ? "warn" : "info",
			json: format === "json",
			context: { command: this.constructor.name },
		});

		const cache = this.noCache === true ? null : new MetadataCache();
		const service = new LinearService({
			config,
			cache,
		});
		return Promise.resolve({ config, output, logger, service });
	}

	protected reportError(error: unknown, context?: CommandContext): void {
		const output = context?.output ?? createOutput({ format: this.json ? "json" : "plain" });
		if (error instanceof ConfigError) {
			output.error(error, { code: "CONFIG_ERROR" });
			return;
		}
		if (error instanceof Error) {
			output.error(error);
			return;
		}
		output.error(new Error(String(error)));
	}
}
